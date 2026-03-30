import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CustomersSyncService } from './customers-sync.service';

@Processor('customers-sync')
export class CustomersProcessor extends WorkerHost {
  private readonly logger = new Logger(CustomersProcessor.name);

  constructor(
    private readonly customersSync: CustomersSyncService,
    @InjectQueue('customers-sync') private readonly syncQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { type, apiConnect, pagina, nro_registros } = job.data;

    try {
      if (type === 'START_MASSIVE_SYNC') {
        return await this.startMassiveSync(apiConnect, nro_registros);
      }

      if (type === 'SYNC_PAGE') {
        return await this.syncPage(apiConnect, pagina, nro_registros);
      }

      if (job.data.contractId) {
        await this.customersSync.syncByCedula(job.data.contractId, apiConnect);
      }
    } catch (error) {
      this.logger.error(`Error processing sync job [${type}]: ${error.message}`);
      throw error;
    }
  }

  private async startMassiveSync(apiConnect: string, nro_registros: number) {
    this.logger.log(`Iniciando cadena de migración REACTIVA para ${apiConnect}`);
    
    // 1. Procesar Página 0 inmediatamente
    const batchSize = 3000;
    const result = await this.customersSync.syncMassive(apiConnect, 0, batchSize);
    
    if (result && result.totalPaginas > 0) {
      this.logger.log(`Página 0 completada. Disparando disparador para página 1.`);
      
      // 2. Encolar SOLO la siguiente página (sin delay artificial largo)
      await this.syncQueue.add('sync-page', {
        type: 'SYNC_PAGE',
        apiConnect,
        pagina: 1,
        nro_registros: batchSize
      }, { priority: 1 });
    }

    return result;
  }

  private async syncPage(apiConnect: string, pagina: number, nro_registros: number) {
    this.logger.log(`>>> PROCESANDO PÁGINA ${pagina} (Reactiva) de ${apiConnect}...`);
    
    const result = await this.customersSync.syncMassive(apiConnect, pagina, nro_registros);
    
    if (result && pagina < result.totalPaginas) {
      const siguientePagina = pagina + 1;
      
      // VERIFICACIÓN DE PAUSA: No encolar la siguiente si el usuario pausó
      if (await this.syncQueue.isPaused()) {
        this.logger.warn(`Sincronización PAUSADA detectada. Deteniendo cadena reactiva en Página ${pagina}.`);
        return result;
      }

      // AUTO-ENCADENAMIENTO (Solo si no hay pausa)
      await this.syncQueue.add('sync-page', {
        type: 'SYNC_PAGE',
        apiConnect,
        pagina: siguientePagina,
        nro_registros,
      }, { 
        priority: 1,
        delay: 5000 
      });
      
      this.logger.log(`Página ${pagina} lista. Encolada siguiente: ${siguientePagina}`);
    } else {
      this.logger.log('--- MIGRACIÓN COMPLETADA EXITOSAMENTE ---');
    }


    return result;
  }
}

