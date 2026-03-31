import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { XuiClientsProcessor } from '../src/features/xui-clients/xui-clients.processor';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const processor = app.get(XuiClientsProcessor);

  // Datos EXTRAÍDOS REALMENTE del archivo CQL (Línea 41291)
  const cqlData = {
    id_contrato: 'CONTC2E557976FD81830',
    nro_contrato: 'C52947',
    cedula: '30166928',
    nombre_franq: 'FIBEX CARACAS',
    det_suscripcion: 'CINEFILOS MEDIO CLUB FIBEX ORO 30$, CINEFILOS MEDIO FIBEX PLAY FULL 163 CANALES 8.99$, CINEFILOS MEDIO FTTH_300',
    nombrestatus: 'ACTIVO',
    email: 'JSOSA0702043@GMAIL.COM'
  };

  console.log('\n--- SINCRONIZACIÓN REAL DESDE CQL: 30166928 ---');
  try {
    // @ts-ignore
    const result = await processor.syncCustomer(cqlData);
    console.log('RESULTADO:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('ERROR EN SYNC:', error.message);
  }

  await app.close();
}

run();
