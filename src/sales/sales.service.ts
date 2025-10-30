import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from './sale.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private repo: Repository<Sale>,

    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,

    @InjectRepository(Client)
    private clientRepo: Repository<Client>,

    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ✅ Obtener todas las ventas (con relaciones)
  async findAll() {
    return this.repo.find({
      relations: ['vehicle', 'client', 'seller'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number) {
    const sale = await this.repo.findOne({
      where: { id },
      relations: ['vehicle', 'client', 'seller'],
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  // ✅ Crear una venta nueva + PDF automático
async create(dto: any): Promise<Sale> {
  try {
    console.log('🚀 DTO recibido en create():', dto);

    // 🔹 Buscar entidades relacionadas
    const vehicle = await this.vehicleRepo.findOne({ where: { id: dto.vehicleId } });
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    const seller = dto.sellerId
      ? await this.userRepo.findOne({ where: { id: dto.sellerId } })
      : null;

    if (!vehicle) throw new Error('Vehículo no encontrado');
    if (!client) throw new Error('Cliente no encontrado');

    // 🔹 Crear instancia de venta (usando tipado seguro)
    const sale = this.repo.create({
      vehicle,
      client,
      seller: seller ?? undefined,
      saleType: dto.saleType || 'contado',
      saleDate: dto.saleDate ? new Date(dto.saleDate) : new Date(),
      finalPrice: Number(dto.finalPrice ?? 0),
      downPayment: dto.downPayment ? Number(dto.downPayment) : null,
      installments: dto.installments ? Number(dto.installments) : null,
      installmentValue: dto.installmentValue ? Number(dto.installmentValue) : null,
      status: 'active',
    } as Partial<Sale>);

    // 🔹 Guardar venta (garantizado objeto, no array)
    const saved: Sale = await this.repo.save(sale);

    console.log('✅ Venta registrada correctamente con ID:', saved.id);

    // 🔹 Marcar vehículo como vendido
    vehicle.sold = true;
    vehicle.status = 'sold';
    await this.vehicleRepo.save(vehicle);

    // 🔹 Generar recibo PDF
    await this.generateReceiptPDF(saved);

    return saved;
  } catch (error) {
    console.error('❌ Error al registrar venta:', error);
    throw new Error(error.message || 'Error inesperado al registrar la venta');
  }
}

  // ✅ Generador de PDF de recibo profesional
  private async generateReceiptPDF(sale: Sale) {
    const receiptsDir = path.join(__dirname, '../../uploads/receipts');
    if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

    const filePath = path.join(receiptsDir, `receipt_${sale.id}.pdf`);
    const doc = new PDFDocument({ margin: 50 });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // --- Encabezado ---
    doc
      .fontSize(20)
      .text('DE GRAZIA AUTOMOTORES', { align: 'center' })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text('Recibo oficial de venta', { align: 'center' })
      .text(`Fecha de emisión: ${new Date().toLocaleString('es-AR')}`, {
        align: 'center',
      })
      .moveDown(1);

    doc
      .moveTo(50, 110)
      .lineTo(550, 110)
      .strokeColor('#00bfa5')
      .stroke();

    // --- Datos principales ---
    doc
      .fontSize(12)
      .text(`🧾 ID de Venta: ${sale.id}`)
      .text(
        `📅 Fecha de Venta: ${new Date(sale.saleDate).toLocaleDateString('es-AR')}`,
      )
      .text(`💳 Tipo de Venta: ${sale.saleType}`)
      .moveDown(1);

    // --- Cliente y Vendedor ---
    const clientName = sale.client
      ? `${sale.client.firstName} ${sale.client.lastName} (DNI: ${sale.client.dni})`
      : 'No registrado';
const sellerName = sale.seller
  ? sale.seller.name
  : 'No asignado';


    doc
      .text(`🧍‍♂️ Cliente: ${clientName}`)
      .text(`👨‍💼 Vendedor: ${sellerName}`)
      .moveDown(1);

    // --- Vehículo ---
    const vehiculo = sale.vehicle;
    doc
      .fontSize(12)
      .text('🚗 Detalles del Vehículo:')
      .moveDown(0.3)
      .fontSize(11)
      .text(`Marca: ${vehiculo.brand}`)
      .text(`Modelo: ${vehiculo.model}`)
      .text(`Versión: ${vehiculo.versionName}`)
      .text(`Patente: ${vehiculo.plate}`)
      .text(`Precio Base: $${vehiculo.price.toLocaleString('es-AR')}`)
      .moveDown(1);

    // --- Totales ---
    doc
      .fontSize(12)
      .text('💰 Resumen de la Venta:')
      .moveDown(0.3)
      .fontSize(11)
      .text(
        `Anticipo: ${
          sale.downPayment ? `$${sale.downPayment.toLocaleString('es-AR')}` : '-'
        }`,
      )
      .text(
        `Cantidad de Cuotas: ${
          sale.installments ? sale.installments : '-'
        }`,
      )
      .text(
        `Valor por Cuota: ${
          sale.installmentValue
            ? `$${sale.installmentValue.toLocaleString('es-AR')}`
            : '-'
        }`,
      )
      .moveDown(0.5)
      .fontSize(12)
      .fillColor('#00bfa5')
      .text(
        `💵 TOTAL FINAL: $${(sale.finalPrice || 0).toLocaleString('es-AR')}`,
        { align: 'right' },
      )
      .fillColor('black')
      .moveDown(1);

    // --- Pie de página ---
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(
        'De Grazia Automotores | Av. Siempre Viva 123 | Tel: (000) 123-4567',
        { align: 'center' },
      )
      .text('Este recibo es válido como comprobante interno de venta.', {
        align: 'center',
      });

    doc.end();

    return new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  }

  // ✅ Actualizar una venta
  async update(id: number, dto: any) {
    const sale = await this.findOne(id);
    Object.assign(sale, dto);
    return this.repo.save(sale);
  }

  // ✅ Eliminar una venta
  async remove(id: number) {
    const sale = await this.findOne(id);
    return this.repo.remove(sale);
  }
}
