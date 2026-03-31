import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ScyllaService } from '../../common/scylladb/scylladb.service';
import { XuiClientsService } from './xui-clients.service';
import { XuiClientsMapper } from './xui-clients.mapper';
import { XuiClientsRepository } from './xui-clients.repository';

@Processor('xui-sync', { concurrency: 5 })
export class XuiClientsProcessor extends WorkerHost {
  private readonly logger = new Logger(XuiClientsProcessor.name);

  constructor(
    private readonly scyllaService: ScyllaService,
    private readonly xuiService: XuiClientsService,
    private readonly xuiMapper: XuiClientsMapper,
    private readonly xuiRepository: XuiClientsRepository,
    @InjectQueue('xui-sync') private readonly syncQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { type, customer } = job.data;

    try {
      if (type === 'SYNC_CUSTOMER') {
        return await this.syncCustomer(customer);
      }
      
      if (type === 'START_GLOBAL_SYNC') {
        return await this.startGlobalSync();
      }
    } catch (error) {
      this.logger.error(`Error en job [${type}]: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza un cliente individual SAE -> XUI
   */
  private async syncCustomer(customer: any) {
    if (this.xuiMapper.isWave(customer)) {
       return { status: 'SKIPPED_WAVE' };
    }

    const xuiData = this.xuiMapper.toXuiClient(customer);
    if (!xuiData) return { status: 'SKIPPED' };

    // Ejecutamos la sincronización directa vía MySQL
    const response = await this.xuiService.upsertLine(xuiData);
    
    // Si el estatus en SAE es diferente al de XUI (MySQL), lo ajustamos
    if (response.id) {
       await this.xuiService.setLineStatus(response.id, customer.nombrestatus === 'ACTIVO');
    }

    // Persistir mapeo en ScyllaDB para trazabilidad (DESACTIVADO PARA ALTA PERFORMANCE)
    /*
    try {
      await this.xuiRepository.upsertMapping(
        customer.id_contrato, 
        customer.cedula, 
        response.id, 
        response.action
      );
    } catch (e) {
      // skipping
    }
    */

    return { status: response.action, xuiId: response.id };
  }

  /**
   * Orquestador Masivo: Lee de ScyllaDB y pone en cola XUI por batches
   */
  private async startGlobalSync() {
    this.logger.log('Iniciando Sincronización Global SAE -> XUI...');
    
    // Aquí implementaremos un streaming de ScyllaDB para encolar miles de jobs de forma eficiente.
    // Usaremos pagination para evitar OOM.
    let pageState = null;
    let totalSynced = 0;

    do {
      const result = await this.scyllaService.execute(
        'SELECT * FROM marthianfred.customers', 
        [], 
        { fetchSize: 1000, pageState }
      );

      pageState = result.pageState;
      
      for (const row of result.rows) {
        // En lugar de procesar aquí, delegamos a trabajadores de BullMQ para paralelismo
        // @ts-ignore
        await this.syncQueue.add('sync-customer', {
           type: 'SYNC_CUSTOMER',
           customer: row
        });
        totalSynced++;
      }

      this.logger.log(`Batch encolado: ${totalSynced} registros hasta ahora...`);

    } while (pageState);

    return { totalEnqueued: totalSynced };
  }
}
