import { Client, auth } from 'cassandra-driver';

const host = '161.97.161.78';
const user = 'cassandra';
const pass = 'cassandra';
const datacenter = 'datacenter1';

async function testConnection() {
  const client = new Client({
    contactPoints: [host],
    localDataCenter: datacenter,
    socketOptions: {
      connectTimeout: 30000,
      readTimeout: 30000,
    }
  });

  try {
    console.log(`Intentando conectar a ScyllaDB en ${host} con DC "${datacenter}" (SIN AUTH)...`);
    await client.connect();
    console.log('✅ Conexión exitosa a ScyllaDB!');
    
    const result = await client.execute('SELECT cluster_name, release_version, data_center FROM system.local');
    console.log('Información del Cluster:', result.first());
    
    await client.shutdown();
  } catch (err) {
    console.error('❌ Error al conectar a ScyllaDB:', err.message);
    if (err.innerErrors) {
        console.error('Detalles de innerErrors:');
        for (const [host, innerErr] of Object.entries(err.innerErrors)) {
            console.error(`Host ${host}:`, innerErr);
        }
    }
    if (err.message.includes('No host was available')) {
        console.error('Sugerencia: Revisa si el datacenter es realmente "' + datacenter + '".');
    }
  }
}

testConnection();
