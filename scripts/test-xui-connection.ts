import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function testXui() {
  const host = process.env.XUI_HOST || '190.103.30.62';
  const apiKey = process.env.XUI_API_KEY || '924117D425B5785A28C9C33E7A515DDB';
  const url = `http://${host}/api?action=get_bouquets&api_key=${apiKey}`;

  console.log(`>> Probando conexión con XUI: ${url}`);
  try {
    const response = await axios.get(url);
    if (response.data && response.data.result !== false) {
      console.log('✅ Conexión Exitosa!');
      console.log('📦 Bouquets encontrados:', response.data.length || 0);
      console.log(JSON.stringify(response.data.slice(0, 3), null, 2));
    } else {
      console.error('❌ Error en el API de XUI:', response.data?.error || 'Sin mensaje de error');
    }
  } catch (error) {
    console.error('❌ Error de red con XUI:', error.message);
  }
}

testXui();
