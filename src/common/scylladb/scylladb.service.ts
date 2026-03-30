import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Client, auth, types, policies } from 'cassandra-driver';

@Injectable()
export class ScyllaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScyllaService.name);
  private client: Client;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    // Configuración HÍBRIDA (Producción / Local)
    const host = process.env.SCYLLA_HOST || '127.0.0.1'; // Si hay ENV (Dokploy) usa scylladb, sino usa Tunnel
    const port = Number(process.env.SCYLLA_PORT) || 9042;
    const datacenter = process.env.SCYLLA_DATACENTER || 'datacenter1';
    const keyspace = process.env.SCYLLA_KEYSPACE || 'sync_sae';
    const user = process.env.SCYLLA_USER || 'cassandra';
    const pass = process.env.SCYLLA_PASS || 'cassandra';

    const contactPoint = `${host}:${port}`;

    this.client = new Client({
      contactPoints: [host],
      localDataCenter: datacenter,
      keyspace: keyspace,
      queryOptions: { 
        consistency: types.consistencies.one,
        prepare: true 
      },
      authProvider: new auth.PlainTextAuthProvider(user, pass),
      protocolOptions: { port: port },
      // Estrategia de Balanceo Inteligente
      policies: {
        loadBalancing: new policies.loadBalancing.AllowListPolicy(
          new policies.loadBalancing.DCAwareRoundRobinPolicy(datacenter),
          [contactPoint]
        )
      },
      pooling: {
        coreConnectionsPerHost: {
          [types.distance.local]: 1,
          [types.distance.remote]: 0
        }
      },
      socketOptions: {
        connectTimeout: 30000,
        readTimeout: 30000,
        keepAlive: true
      }
    });
  }

  async onModuleInit() {
    try {
      const mode = process.env.SCYLLA_HOST ? 'MODO DOKPLOY 🚀' : 'MODO TÚNEL SSH 🛡️';
      this.logger.log(`Iniciando conexión (${mode}) con ScyllaDB en ${process.env.SCYLLA_HOST || '127.0.0.1'}:9042...`);
      await this.client.connect();
      this.logger.log('ScyllaDB Service: ¡CONEXIÓN TOTAL ESTABLECIDA! ✅🎯');
    } catch (error) {
      this.logger.error('ScyllaDB Service: Error al conectar:', error.message);
      this.logger.warn('Revisa el Host en el .env o tu túnel SSH.');
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
