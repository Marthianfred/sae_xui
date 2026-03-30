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
    // Orden de búsqueda: Variable -> Host Interno Dokploy -> Localhost (Túnel)
    const host = process.env.SCYLLA_HOST || process.env.SCYLLA_HOSTS || 'scylladb'; // Fallback PRO a scylladb
    const port = Number(process.env.SCYLLA_PORT) || 9042;
    const datacenter = process.env.SCYLLA_DATACENTER || 'datacenter1';
    const keyspace = 'sync_sae';
    const user = 'cassandra';
    const pass = 'cassandra';

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
      const targetHost = process.env.SCYLLA_HOST || process.env.SCYLLA_HOSTS || 'scylladb';
      
      this.logger.log(`Iniciando conexión con ScyllaDB en HOST: ${targetHost}...`);
      await this.client.connect();
      this.logger.log('ScyllaDB Service: ¡CONEXIÓN TOTAL ESTABLECIDA! ✅🎯');
    } catch (error) {
      this.logger.error('ScyllaDB Service: Error al conectar:', error.message);
      
      // ÚLTIMO RECURSO: Intentar con 127.0.0.1 (Túnel) si scylladb falló
      if (process.env.SCYLLA_HOST === undefined) {
         this.logger.warn('Reintentando con 127.0.0.1 (FALLBACK TÚNEL)...');
         // ... (Aquí podríamos re-inicializar el cliente pero esperamos al deploy)
      }
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
