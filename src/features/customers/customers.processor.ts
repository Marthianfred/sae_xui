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
    this.logger.log(`Iniciando cadena de migración REACTIVA para ${apiConnect} (Lotes de 1000)`);
    
    // Forzar 1000 por lote para mayor estabilidad y velocidad de respuesta API
    const batchSize = 1000;
    const result = await this.customersSync.syncMassive(apiConnect, 0, batchSize);
    
    if (result && result.totalPaginas > 0) {
      this.logger.log(`Página 0 completada. Total páginas estimadas: ${result.totalPaginas}.`);
      
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
    this.logger.log(`>>> PROCESANDO PÁGINA ${pagina}...`);
    const startTime = Date.now();
    
    const result = await this.customersSync.syncMassive(apiConnect, pagina, nro_registros);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result) {
      this.logger.log(`Archivo actualizado: Página ${pagina} inyectada en ${duration}s. [Lote: ${result.count}]`);
      
      if (pagina < result.totalPaginas) {
        const siguientePagina = pagina + 1;
        
        if (await this.syncQueue.isPaused()) {
          this.logger.warn(`Sincronización PAUSADA. Deteniendo cadena en Página ${pagina}.`);
          return result;
        }

        await this.syncQueue.add('sync-page', {
          type: 'SYNC_PAGE',
          apiConnect,
          pagina: siguientePagina,
          nro_registros,
        }, { 
          priority: 1,
          delay: 5000 
        });
        
        this.logger.log(`Siguiente página encolada: ${siguientePagina}`);
      } else {
        this.logger.log('--- MIGRACIÓN COMPLETADA EXITOSAMENTE ---');
      }
    }

    return result;
  }
}


