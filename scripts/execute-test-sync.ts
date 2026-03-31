import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { XuiClientsProcessor } from '../src/features/xui-clients/xui-clients.processor';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const processor = app.get(XuiClientsProcessor);

  const samysData = {
    id_contrato: 'CONT001',
    cedula: '21282820',
    nro_contrato: 'C7477',
    nombre_franq: 'FIBEX CARACAS',
    det_suscripcion: 'FTTH_600 EMPLEADO',
    nombrestatus: 'ACTIVO',
    email: 'SAMYJES4@GMAIL.COM'
  };

  console.log('\n--- SIMULANDO SINCRONIZACIÓN REAL: SAMYS (21282820) ---');
  try {
    // @ts-ignore - Accediendo a método privado para el test
    const result = await processor.syncCustomer(samysData);
    console.log('RESULTADO:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('ERROR EN SYNC:', error.message);
  }

  await app.close();
}

run();
