import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkXuiSettings() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.XUI_DB_HOST,
      user: process.env.XUI_DB_USER,
      password: process.env.XUI_DB_PASS,
      database: process.env.XUI_DB_NAME,
    });

    console.log('>> Consultando settings de XUI...');
    const [rows]: any[] = await connection.query('SELECT * FROM settings');
    
    // Filtramos por palabras clave
    const keywords = ['url', 'api', 'port', 'key'];
    const filtered = rows.filter((r: any) => 
      keywords.some(k => r.setting_key?.toLowerCase().includes(k))
    );

    console.log('📋 SETTINGS ENCONTRADAS:');
    console.log(JSON.stringify(filtered, null, 2));

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkXuiSettings();
