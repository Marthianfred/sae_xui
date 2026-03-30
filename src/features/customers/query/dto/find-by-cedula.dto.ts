import { IsString, IsNotEmpty } from 'class-validator';

export class FindByCedulaDto {
  @IsString()
  @IsNotEmpty()
  cedula: string;
}
