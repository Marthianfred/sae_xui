import { Controller, Post, Get, Logger } from '@nestjs/common';
import { CustomersSyncService } from './customers-sync.service';

@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly syncService: CustomersSyncService) {}

  /**
   * Endpoint Maestro: Ejecuta la migración desde los 16 fragmentos (Timeline) en el disco
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
