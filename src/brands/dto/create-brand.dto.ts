import { IsString, Length } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @Length(2, 100, { message: 'El nombre de la marca debe tener entre 2 y 100 caracteres.' })
  name: string;
}
