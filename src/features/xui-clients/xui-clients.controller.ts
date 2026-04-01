import { Controller, Post, Get, Param, Body, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { XuiClientsService } from './xui-clients.service';
import { XuiClientsRepository } from './xui-clients.repository';
import { SyncClientDto, MassiveSyncDto } from './dto/sync-client.dto';

@Controller('xui/clients')
export class XuiClientsController {
  private readonly logger = new Logger(XuiClientsController.name);

  constructor(
    private readonly xuiService: XuiClientsService,
    private readonly repository: XuiClientsRepository,
    @InjectQueue('xui-sync') private readonly xuiQueue: Queue,
  ) {}

  /**
   * Obtiene el estado de sincronización de un cliente por cédula
   */
  @Get(':cedula')
  async getStatus(@Param('cedula') cedula: string) {
    const customers = await this.repository.findByCedula(cedula);
    if (!customers || customers.length === 0) {
      return { success: false, message: 'Cliente no encontrado en ScyllaDB' };
    }

    const mappings = await Promise.all(
      customers.map((c) => this.repository.getMapping(c.id_contrato)),
    );

    return {
      success: true,
      customers,
      mappings: mappings.filter((m) => !!m),
    };
  }

  /**
   * Sincroniza un cliente individual por cédula (desde ScyllaDB -> XUI)
   */
  @Post('sync/:cedula')
  async syncIndividual(@Param('cedula') cedula: string) {
    this.logger.log(`Solicitud de sincronización individual: ${cedula}`);
    const customers = await this.repository.findByCedula(cedula);

    if (!customers || customers.length === 0) {
      return {
        success: false,
        message: 'No se encontró el cliente en ScyllaDB',
      };
    }

    for (const customer of customers) {
      await this.xuiQueue.add('sync-customer', {
        type: 'SYNC_CUSTOMER',
        customer,
      });
    }

    return {
      success: true,
      message: `Sincronización encolada para ${customers.length} contratos`,
    };
  }

  /**
   * Sincronización masiva de TODOS los clientes (Global)
   */
  @Post('sync/massive')
  async syncMassive() {
    this.logger.log('Solicitud de sincronización GLOBAL iniciada [SAE -> XUI]');
    await this.xuiQueue.add('start-global-sync', { type: 'START_GLOBAL_SYNC' });
    return {
      success: true,
      message: 'Proceso de sincronización global encolado',
    };
  }
}
