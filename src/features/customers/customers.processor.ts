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
    this.logger.log(`Iniciando sincronización masiva para ${apiConnect} con lotes de 3000`);
    
    // Forzar 3000 por lote para mayor eficiencia
    const batchSize = 3000;
    const result = await this.customersSync.syncMassive(apiConnect, 0, batchSize);
    
    if (result && result.totalPaginas > 0) {
      // 1 minuto 30 segundos entre consultas = 90000 ms
      const delayMs = 90000;
      
      for (let i = 1; i <= result.totalPaginas; i++) {
        await this.syncQueue.add('sync-page', {
          type: 'SYNC_PAGE',
          apiConnect,
          pagina: i,
          nro_registros: batchSize
        }, {
          delay: i * delayMs,
          priority: 1
        });
      }
      this.logger.log(`Encoladas ${result.totalPaginas} páginas de 3000 registros cada una con delay de 90s.`);
    }

    return result;
  }

  private async syncPage(apiConnect: string, pagina: number, nro_registros: number) {
    this.logger.log(`Sincronizando página ${pagina} de ${apiConnect}...`);
    const result = await this.customersSync.syncMassive(apiConnect, pagina, nro_registros);
    if (result) {
      this.logger.log(`Página ${pagina} completada. Registros procesados: ${result.count}`);
    }
    return result;
  }
}
