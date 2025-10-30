import { IsInt, IsString, Length } from 'class-validator';

export class CreateModelDto {
  @IsString() @Length(1, 120)
  name: string;

  @IsInt()
  brandId: number;
}
