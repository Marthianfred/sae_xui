import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function searchCustomerInXui() {
  const contractId = 'CONTA6EFA2A2FB951813';
  const username = 'SAMYJES4@GMAIL.COM';
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.XUI_DB_HOST,
      user: process.env.XUI_DB_USER,
      password: process.env.XUI_DB_PASS,
      database: process.env.XUI_DB_NAME,
    });

    console.log(`>> Buscando en XUI - Contrato: ${contractId}, Username: ${username}`);
    
    const [rows]: any[] = await connection.query(
      'SELECT * FROM `lines` WHERE admin_notes LIKE ? OR username = ?', 
      [`%${contractId}%`, username]
    );

    if (rows.length > 0) {
      console.log('✅ CLIENTE ENCONTRADO EN XUI:');
      console.log(JSON.stringify(rows, null, 2));
    } else {
      console.log('❌ Cliente no encontrado en la DB de XUI.');
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchCustomerInXui();
