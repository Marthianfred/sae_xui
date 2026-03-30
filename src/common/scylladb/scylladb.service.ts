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
    const host = process.env.SCYLLA_HOST || process.env.SCYLLA_HOSTS || 'scylladb';
    const port = Number(process.env.SCYLLA_PORT) || 9042;
    const datacenter = process.env.SCYLLA_DATACENTER || 'datacenter1';
    
    // NOTA: Eliminamos keyspace de la conexión inicial para evitar errores si no existe
    const user = 'cassandra';
    const pass = 'cassandra';

    this.client = new Client({
      contactPoints: [host],
      localDataCenter: datacenter,
      queryOptions: { 
        consistency: types.consistencies.one,
        prepare: true 
      },
      authProvider: new auth.PlainTextAuthProvider(user, pass),
      protocolOptions: { port: port },
      socketOptions: {
        connectTimeout: 60000, // Aumentamos a 60s por el warm-up de Scylla
        readTimeout: 60000,
        keepAlive: true
      },
      policies: {
        loadBalancing: new policies.loadBalancing.DCAwareRoundRobinPolicy(datacenter)
      }
    });
  }

  async onModuleInit() {
    try {
      const targetHost = process.env.SCYLLA_HOST || process.env.SCYLLA_HOSTS || 'scylladb';
      this.logger.log(`Conectando a raíz de ScyllaDB en HOST: ${targetHost}...`);
      await this.client.connect();
      this.logger.log('ScyllaDB Service: ¡CONEXIÓN ESTABLECIDA! ✅🎯');
      
      // Intentar crear el keyspace si no existe
      await this.client.execute(
        "CREATE KEYSPACE IF NOT EXISTS sync_sae WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}"
      );
      this.logger.log('ScyllaDB Service: Keyspace sync_sae verificado/creado. ✨');
      
      // Ahora sí nos movemos al keyspace
      await this.client.execute("USE sync_sae");
      
    } catch (error) {
      this.logger.error('ScyllaDB Service: Error al conectar:', error.message);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown();
    }
  }

  async execute(query: string, params: any[] = [], options: any = {}) {
    try {
      // Si la query no especifica keyspace, usamos el nuestro
      return await this.client.execute(query, params, { prepare: true, ...options });
    } catch (error) {
      this.logger.error(`ScyllaDB Error: ${error.message}`);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }
}
