import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { XuiClientsProcessor } from '../src/features/xui-clients/xui-clients.processor';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const processor = app.get(XuiClientsProcessor);

  const ptoCabelloData = {
    id_contrato: 'CONT002',
    cedula: '30166928',
    nro_contrato: 'C52947',
    nombre_franq: 'FIBEX PTO CABELLO / MORON',
    det_suscripcion: 'FIBEX PLAY FULL 163 CANALES',
    nombrestatus: 'ACTIVO',
    email: 'JSOSA0702043@GMAIL.COM'
  };

  console.log('\n--- SIMULANDO SINCRONIZACIÓN REAL: PTO CABELLO / MORON (30166928) ---');
  try {
    // @ts-ignore
    const result = await processor.syncCustomer(ptoCabelloData);
    console.log('RESULTADO:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('ERROR EN SYNC:', error.message);
  }

  await app.close();
}

run();
