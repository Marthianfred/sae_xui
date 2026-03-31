import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function inspectLinesTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.XUI_DB_HOST,
      user: process.env.XUI_DB_USER,
      password: process.env.XUI_DB_PASS,
      database: process.env.XUI_DB_NAME,
    });

    const [columns] = await connection.query('SHOW COLUMNS FROM `lines`');
    console.log('📋 COLUMNAS DE LA TABLA lines:');
    console.log(JSON.stringify(columns, null, 2));

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

inspectLinesTable();
