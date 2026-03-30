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
    // HOST: Variable -> Docker Internal (scylladb) -> Localhost
    const host = process.env.SCYLLA_HOST || process.env.SCYLLA_HOSTS || 'scylladb';
    const port = Number(process.env.SCYLLA_PORT) || 9042;
    const datacenter = process.env.SCYLLA_DATACENTER || 'datacenter1';
    
    const user = process.env.SCYLLA_USER || 'cassandra';
    const pass = process.env.SCYLLA_PASS || 'cassandra';

    this.client = new Client({
      contactPoints: [host],
      localDataCenter: datacenter,
      queryOptions: { consistency: types.consistencies.one, prepare: true },
      authProvider: new auth.PlainTextAuthProvider(user, pass),
      protocolOptions: { port: port },
      socketOptions: {
        connectTimeout: 45000,
        readTimeout: 45000,
        keepAlive: true
      },
      policies: {
        loadBalancing: new policies.loadBalancing.DCAwareRoundRobinPolicy(datacenter)
      }
    });
  }

  async onModuleInit() {
    try {
      const host = process.env.SCYLLA_HOST || 'scylladb';
      this.logger.log(`Iniciando conexión con ScyllaDB Cluster en [${host}]...`);
      await this.client.connect();
      
      // Auto-Keyspace Initialization
      await this.client.execute(
        "CREATE KEYSPACE IF NOT EXISTS sync_sae WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}"
      );
      await this.client.execute("USE sync_sae");
      
      this.logger.log('ScyllaDB Service: ¡CONEXIÓN ESTABLECIDA CON ÉXITO! ✅🎯');
    } catch (error) {
      this.logger.error(`ScyllaDB: Fallo en el Handshake inicial: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown();
      this.logger.log('ScyllaDB: Desconectado.');
    }
  }

  async execute(query: string, params: any[] = [], options: any = {}) {
    return this.client.execute(query, params, { prepare: true, ...options });
  }

  getClient() {
    return this.client;
  }
}
