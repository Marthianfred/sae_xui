import axios from 'axios';

const host = '190.103.30.62';
const apiKey = '924117D425B5785A28C9C33E7A515DDB';
const action = 'get_bouquets';

const paths = [
  '/api',
  '/api.php',
  '/panel/api.php',
  '/admin/api.php',
  '/v2/api.php'
];

async function findApiPath() {
  for (const path of paths) {
    const url = `http://${host}${path}?action=${action}&api_key=${apiKey}`;
    process.stdout.write(`>> Probando: ${url} ... `);
    try {
      const response = await axios.get(url, { timeout: 3000 });
      console.log(`Bingo! Status: ${response.status}`);
      console.log(JSON.stringify(response.data).substring(0, 100));
      return;
    } catch (error) {
      console.log(`${error.response?.status || 'Error'}`);
    }
  }
}

findApiPath();
