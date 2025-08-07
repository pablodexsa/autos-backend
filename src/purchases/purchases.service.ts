import { Injectable } from '@nestjs/common';

export interface Purchase {
  id: number;
  vehicleId: number;             // ID del vehículo comprado
  purchaseDate: string;          // Fecha (YYYY-MM-DD)
  price: number;                  // Precio
  documentPath?: string | null;   // Documento opcional
}

@Injectable()
export class PurchasesService {
  private purchases: Purchase[] = [];

  create(data: Omit<Purchase, 'id'>) {
    const id = this.purchases.length + 1;
    const purchase: Purchase = { id, ...data };
    this.purchases.push(purchase);
    return purchase;
  }

  findAll(): Purchase[] {
    return this.purchases;
  }
}
