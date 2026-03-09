import { IsIn, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  @IsIn(['Aceptada', 'Cancelada'])
  status: 'Aceptada' | 'Cancelada';
}

// (Opcional) alias legacy por si en algún lado quedó usado el nombre anterior
export { UpdateStatusDto as UpdateReservationStatusDto };