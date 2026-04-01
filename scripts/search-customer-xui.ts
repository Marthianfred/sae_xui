import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function searchCustomerInXui() {
  const cedula = process.argv[2];
  const contractId = process.argv[3] || '';
  
  if (!cedula) {
    console.log('❌ Uso: npx ts-node scripts/search-customer-xui.ts <cedula> [contractId]');
    process.exit(1);
  }
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.XUI_DB_HOST,
      user: process.env.XUI_DB_USER,
      password: process.env.XUI_DB_PASS,
      database: process.env.XUI_DB_NAME,
      port: Number(process.env.XUI_DB_PORT) || 3306,
    });

    console.log(`>> Buscando en XUI - Cédula: ${cedula}, Contrato: ${contractId || 'N/A'}`);
    
    // Búsqueda inteligente: Si hay contrato, busca por ambos. Si no, solo por cédula.
    let query = 'SELECT * FROM `lines` WHERE username = ?';
    let params = [cedula];
    if (contractId) {
      query += ' OR admin_notes LIKE ?';
      params.push(`%${contractId}%`);
    }
    
    const [rows]: any[] = await connection.query(query, params);

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
