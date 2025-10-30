import { IsInt, IsString, Length } from 'class-validator';

export class CreateVersionDto {
  @IsString() @Length(1, 150)
  name: string;

  @IsInt()
  modelId: number;
}
