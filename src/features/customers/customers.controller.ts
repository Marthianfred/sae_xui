import { Controller, Post, Get, Logger } from '@nestjs/common';
import { CustomersSyncService } from './customers-sync.service';
import { XuiClientsService } from '../xui-clients/xui-clients.service';

@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(
    private readonly syncService: CustomersSyncService,
    private readonly xuiService: XuiClientsService
  ) {}

  /**
   * 🏆 SINCRONIZADOR MAESTRO (SAE PLUS -> XUI ONE REALTIME)
   * Dispara la sincronización masiva de los 711,615 clientes de SAE a MySQL XUI.
   * POST /customers/sync/sae-xui
   */
  @Post('sync/sae-xui')
  async startSaeToXui() {
    this.logger.log('--- SOLICITUD DE SINCRONIZACIÓN MAESTRA (SAE -> XUI LIVE) ---');
    // Se ejecuta en background para no bloquear el request HTTP
    this.syncService.syncDirectlyFromDB(this.xuiService).catch(err => {
       this.logger.error(`Fallo en Sincronización Maestra: ${err.message}`);
    });
    return { 
      message: 'Sincronización Maestra (SAE -> XUI) iniciada en segundo plano.',
      expected_records: 711615,
      progress_logs: 'Ver terminal de Dokploy para barra de progreso.' 
    };
  }

  /**
   * Endpoint Maestro: Ejecuta la migración desde los  fragmentos (Timeline) en el disco
   */
  @Post('sync/timeline')
  async runTimelineMigration() {
    this.logger.log('--- INVOCANDO MIGRACIÓN CRONOLÓGICA (TIMELINE) ---');
    return this.syncService.runChunksInSequence();
  }

  /**
   * Endpoint de Emergencia: Migración Directa PG -> Scylla (Streaming)
   */
  @Post('sync/massive')
  async startMassiveSync() {
    this.logger.log('--- SOLICITUD DE MIGRACIÓN MASIVA DIRECTA ---');
    // Para simplificar llamar al nuevo motor de streaming
    return this.syncService.runChunksInSequence(); // Cambiado por defecto a Timeline
  }

  @Post('sync/reset')
  async resetSyncFile() {
    this.logger.log('Reset del archivo CQL solicitado.');
    // Solo un Placeholder
    return { message: 'Reset no disponible en modo Timeline.' };
  }
}
