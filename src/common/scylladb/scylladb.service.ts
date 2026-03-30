import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Client, auth } from 'cassandra-driver';

@Injectable()
export class ScyllaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScyllaService.name);
  private client: Client;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    // Configuración ScyllaDB - Recuperar de ENV (En Dokploy será 'scylladb')
    const host = process.env.SCYLLA_HOST || 'scylladb';
    const port = Number(process.env.SCYLLA_PORT) || 9042;
    const datacenter = process.env.SCYLLA_DATACENTER || 'datacenter1';
    const keyspace = process.env.SCYLLA_KEYSPACE || 'sync_sae';
    const user = process.env.SCYLLA_USER || 'cassandra';
    const pass = process.env.SCYLLA_PASS || 'cassandra';

    this.client = new Client({
      contactPoints: [host],
      localDataCenter: datacenter,
      keyspace: keyspace,
      queryOptions: { consistency: 1 },
      authProvider: new auth.PlainTextAuthProvider(user, pass),
      protocolOptions: { port: port }
    });
  }

  async onModuleInit() {
    try {
      this.logger.log(`Iniciando conexión con ScyllaDB (${process.env.SCYLLA_HOST || 'scylladb'})...`);
      await this.client.connect();
      this.logger.log('ScyllaDB Service: ¡CONEXIÓN ESTABLECIDA CON ÉXITO! ✅');
    } catch (error) {
      this.logger.error('ScyllaDB Service: Error al conectar:', error.message);
      this.logger.warn('Modo Degradado: Reintentando conexión en segundo plano...');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown();
      this.logger.log('ScyllaDB Service finalizado.');
    }
  }

  async execute(query: string, params: any[] = [], options: any = {}) {
    try {
      return await this.client.execute(query, params, { prepare: true, ...options });
    } catch (error) {
      this.logger.error(`ScyllaDB Error al ejecutar Query: ${error.message}`);
      throw error;
    }
  }

  async batch(queries: { query: string; params?: any[] }[], options: any = {}) {
    try {
      return await this.client.batch(queries, { prepare: true, ...options });
    } catch (error) {
      this.logger.error(`ScyllaDB Error al ejecutar Batch: ${error.message}`);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }
}
