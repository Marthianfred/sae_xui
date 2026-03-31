import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function exploreXuiDb() {
  console.log('>> Explorando DB de XUI...');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.XUI_DB_HOST || '190.103.30.62',
      port: Number(process.env.XUI_DB_PORT) || 3306,
      user: process.env.XUI_DB_USER || 'dbpruebas',
      password: process.env.XUI_DB_PASS || 'F1b3x123',
      database: process.env.XUI_DB_NAME || 'xui',
    });

    console.log('✅ Conexión Exitosa!');
    
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📦 TABLAS ENCONTRADAS:');
    console.log(JSON.stringify(tables, null, 2));

    await connection.end();
  } catch (error) {
    console.error('❌ Error conexión DB XUI:', error.message);
  }
}

exploreXuiDb();
