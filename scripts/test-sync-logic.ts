import { XuiClientsMapper } from '../src/features/xui-clients/xui-clients.mapper';

const mapper = new XuiClientsMapper();

const testCases = [
  {
    name: 'CASO 1: Samys (Normal)',
    data: {
      cedula: '21282820',
      nro_contrato: 'C7477',
      nombre_franq: 'FIBEX CARACAS',
      det_suscripcion: 'FTTH_600 EMPLEADO',
      email: 'SAMYJES4@GMAIL.COM',
      telef_casa: '04121234567'
    }
  },
  {
    name: 'CASO 2: Pto Cabello / Moron (Unificación)',
    data: {
      cedula: '30166928',
      nro_contrato: 'C52947',
      nombre_franq: 'FIBEX PTO CABELLO / MORON',
      det_suscripcion: 'FIBEX PLAY FULL 163 CANALES',
      email: 'JSOSA0702043@GMAIL.COM'
    }
  },
  {
    name: 'CASO 3: WAVE (Exclusión)',
    data: {
      cedula: '500765967',
      nro_contrato: 'WV000206',
      nombre_franq: 'FIBEX WAVE',
      det_suscripcion: 'PLAN 2025 FTTH 250',
      email: 'CORPORACIONWAVEREDDEVENEZUELA@GMAIL.COM'
    }
  }
];

console.log('--- TEST DE LÓGICA DE MAPEO XUI ---\n');

testCases.forEach(tc => {
  console.log(`PROBANDO: ${tc.name}`);
  const result = mapper.toXuiClient(tc.data);
  if (result) {
    console.log('✅ MAPEO EXITOSO:');
    console.log(`   - Username: ${result.username}`);
    console.log(`   - Admin Notes (Contrato): ${result.notes}`);
    console.log(`   - Reseller Notes (Región): ${result.reseller_notes}`);
    console.log(`   - Bouquets (Planes): ${JSON.stringify(result.bouquets_selected)}`);
  } else {
    console.log('🚫 CLIENTE EXCLUIDO (WAVE detectado)');
  }
  console.log('-----------------------------------\n');
});
