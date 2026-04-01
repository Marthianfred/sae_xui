import { Injectable, Logger } from '@nestjs/common';
import { CustomersSyncService } from '../customers-sync.service';

@Injectable()
export class CustomersQueryService {
  private readonly logger = new Logger(CustomersQueryService.name);

  constructor(private readonly sync: CustomersSyncService) {}

  async findByCedula(cedula: string, apiConnect: string) {
    this.logger.warn('Modo Migración: findByCedula redirigido a sync.');
    return await this.sync.syncByCedula(cedula, apiConnect);
  }
}
