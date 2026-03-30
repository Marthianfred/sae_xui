import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class ScyllaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScyllaService.name);

  async onModuleInit() {
    this.logger.log('ScyllaDB Service inicializado en MODO OFFLINE (Migración).');
  }

  async onModuleDestroy() {
    this.logger.log('ScyllaDB Service finalizado.');
  }

  async execute(query: string, params: any[] = [], options: any = {}) {
    this.logger.debug('Modo Offline: No se ejecutó la query en DB.');
    return { rowLength: 0, rows: [] };
  }
}
