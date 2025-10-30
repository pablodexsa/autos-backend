export class CreateReservationDto {
  clientDni: string;     // o clientId (opcional)
  clientId?: number;
  plate: string;         // patente del vehículo
  amount?: number;       // si no viene, usar la config (ej. 500000)
  sellerId?: number;     // usuario logueado
  date?: string;         // ISO opcional
}
