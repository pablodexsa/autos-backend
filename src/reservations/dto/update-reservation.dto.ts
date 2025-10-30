export class UpdateReservationDto {
  status?: 'Vigente' | 'Vencida' | 'Aceptada' | 'Cancelada';
  // se pueden permitir extensiones manuales, etc.
}
