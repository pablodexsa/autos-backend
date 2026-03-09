import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

type UploadResult = { url: string; publicId: string };

type GuarantorDocOpts =
  | {
      buffer: Buffer;
      originalName: string;
      // MODO A (tu flujo actual)
      reservationId: number;
      dni: string;
      guarantorId?: never;
    }
  | {
      buffer: Buffer;
      originalName: string;
      // MODO B (si mañana subís después de crear el garante)
      guarantorId: number;
      reservationId?: number;
      dni?: never;
    };

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  // (Opcional) para detectar rápido envs faltantes en logs
  private assertConfig() {
    const required = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      throw new InternalServerErrorException(
        `Cloudinary: faltan variables de entorno: ${missing.join(', ')}`,
      );
    }
  }

  private sanitizeFilename(name: string) {
    return (name || 'file')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Sube un archivo "raw" (pdf, doc, etc.) a Cloudinary.
   * - Retorna URL segura + publicId.
   */
  async uploadRaw(opts: {
    buffer: Buffer;
    originalName: string;
    folder: string;
    filenameBase: string;
  }): Promise<UploadResult> {
    this.assertConfig();

    const { buffer, originalName, folder, filenameBase } = opts;

    const safeOriginal = this.sanitizeFilename(originalName);
    const safeBase = this.sanitizeFilename(filenameBase);

    try {
      const out = await new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'raw',
            use_filename: true,
            unique_filename: true,
            filename_override: `${safeBase}_${Date.now()}_${safeOriginal}`,
          },
          (error: unknown, result: any) => {
            if (error) return reject(error);

            const secureUrl = result?.secure_url as string | undefined;
            const publicId = result?.public_id as string | undefined;

            if (!secureUrl || !publicId) {
              return reject(new Error('Cloudinary: respuesta inválida'));
            }

            resolve({ url: secureUrl, publicId });
          },
        );

        uploadStream.end(buffer);
      });

      return out;
    } catch (e: any) {
      throw new InternalServerErrorException(
        e?.message ?? 'Error subiendo archivo a Cloudinary',
      );
    }
  }

  // ============================
  // CLIENTES
  // ============================
  uploadClientDni(opts: {
    buffer: Buffer;
    originalName: string;
    clientId: number;
  }) {
    return this.uploadRaw({
      buffer: opts.buffer,
      originalName: opts.originalName,
      folder: 'degrazia/client-dni',
      filenameBase: `client_${opts.clientId}_dni`,
    });
  }

  // ============================
  // VEHÍCULOS
  // ============================
  uploadVehicleDoc(opts: {
    buffer: Buffer;
    originalName: string;
    vehicleId: number;
  }) {
    return this.uploadRaw({
      buffer: opts.buffer,
      originalName: opts.originalName,
      folder: 'degrazia/vehicle-docs',
      filenameBase: `vehicle_${opts.vehicleId}_doc`,
    });
  }

  // ============================
  // RESERVAS / GARANTES
  // (fotocopia DNI + último recibo)
  // ============================

  private guarantorBaseFromOpts(opts: GuarantorDocOpts) {
    // MODO A: reservationId + dni
    if ('dni' in opts) {
      const safeDni = this.sanitizeFilename(String(opts.dni));
      return `res_${opts.reservationId}_dni_${safeDni}`;
    }

    // MODO B: guarantorId (+ opcional reservationId)
    const suffix = opts.reservationId ? `_res_${opts.reservationId}` : '';
    return `guarantor_${opts.guarantorId}${suffix}`;
  }

  uploadGuarantorDni(opts: GuarantorDocOpts) {
    const base = this.guarantorBaseFromOpts(opts);
    return this.uploadRaw({
      buffer: opts.buffer,
      originalName: opts.originalName,
      folder: 'degrazia/guarantors/dni',
      filenameBase: `${base}_dni`,
    });
  }

  uploadGuarantorPayslip(opts: GuarantorDocOpts) {
    const base = this.guarantorBaseFromOpts(opts);
    return this.uploadRaw({
      buffer: opts.buffer,
      originalName: opts.originalName,
      folder: 'degrazia/guarantors/payslips',
      filenameBase: `${base}_payslip`,
    });
  }
}