import { IsIn, IsString } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsString()
  @IsIn(['Aceptada', 'Cancelada'])
  status: 'Aceptada' | 'Cancelada';
}
