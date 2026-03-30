import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CustomersSyncService } from './customers-sync.service';

@Processor('customers-sync', { concurrency: 3 })
export class CustomersProcessor extends WorkerHost {
  private readonly logger = new Logger(CustomersProcessor.name);

  constructor(
    private readonly customersSync: CustomersSyncService,
    @InjectQueue('customers-sync') private readonly syncQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { type, apiConnect, pagina, nro_registros, desde, hasta } = job.data;

    try {
      if (type === 'START_MASSIVE_SYNC') {
        return await this.startMassiveSync(apiConnect, nro_registros);
      }

      if (type === 'SYNC_PAGE') {
        return await this.syncPage(apiConnect, pagina, nro_registros, desde, hasta);
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
    this.logger.log(`Iniciando MIGRACIÓN DIRECTA desde Postgres (High Performance)...`);
    
    // Ejecutamos la migración directa. 
    // Al ser un stream único, no necesitamos encolar cientos de jobs.
    try {
      const total = await this.customersSync.syncDirectlyFromDB();
      this.logger.log(`>> Proceso finalizado. Se han migrado ${total} registros.`);
      return { status: 'COMPLETED', total };
    } catch (error) {
      this.logger.error('Fallo en el motor de streaming:', error);
      throw error;
    }
  }

  private async syncPage(apiConnect: string, pagina: number, nro_registros: number, desde?: string, hasta?: string) {
    const rangeLog = desde ? ` [${desde} / ${hasta}]` : '';
    this.logger.log(`>>> PROCESANDO PÁGINA ${pagina}${rangeLog}...`);
    const startTime = Date.now();
    
    const result = await this.customersSync.syncMassive(apiConnect, pagina, nro_registros, desde || '', hasta || '');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result) {
      this.logger.log(`Inyectado: Página ${pagina}${rangeLog} en ${duration}s. [Items: ${result.count}]`);
      
      // SHORT-CIRCUIT: Si la página 0 no tiene items, no hay nada que buscar en este mes.
      if (pagina === 0 && result.count === 0) {
        this.logger.log(`Ventana ${rangeLog} vacía. Saltando al siguiente mes.`);
        return result;
      }

      if (pagina < result.totalPaginas) {
        const siguientePagina = pagina + 1;
        
        await this.syncQueue.add('sync-page', {
          type: 'SYNC_PAGE',
          apiConnect,
          pagina: siguientePagina,
          nro_registros,
          desde,
          hasta
        }, { 
          priority: 1,
          delay: 200 
        });
      }
    }

    return result;
  }
}


