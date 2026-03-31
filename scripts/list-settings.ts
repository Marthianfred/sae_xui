import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();
async function listAllSettings() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.XUI_DB_HOST,
      user: process.env.XUI_DB_USER,
      password: process.env.XUI_DB_PASS,
      database: process.env.XUI_DB_NAME,
    });
    const [rows]: any[] = await connection.query('SELECT * FROM settings');
    console.log(JSON.stringify(rows, null, 2));
    await connection.end();
  } catch (error) { console.error(error); }
}
listAllSettings();
