import { Controller, Post, Logger } from '@nestjs/common';
import { CustomersSyncService } from './customers-sync.service';
import { XuiClientsService } from '../xui-clients/xui-clients.service';

@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(
    private readonly syncService: CustomersSyncService,
    private readonly xuiService: XuiClientsService,
  ) {}

  /**
   * SINCRONIZADOR MAESTRO (SAE PLUS -> XUI ONE DIRECTO)
   * Dispara la sincronización masiva mediante streaming.
   * POST /customers/sync/sae-xui
   */
  @Post('sync/sae-xui')
  startSaeToXui() {
    this.logger.log('--- SOLICITUD DE SINCRONIZACIÓN DIRECTA (SAE -> XUI) ---');

    // Ejecución asíncrona
    this.syncService.syncDirectlyFromDB(this.xuiService).catch((err: Error) => {
      this.logger.error(`Fallo en Sincronización Directa: ${err.message}`);
    });

    return {
      message: 'Sincronización Directa (SAE -> XUI) iniciada.',
      expected_records: 711615,
    };
  }
}
