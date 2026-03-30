import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
  // LOG DE AUTORIDAD (Para depuración de Dokploy)
  console.log('--- [DOKPLOY DEBUG] VARIABLES DETECTADAS ---');
  console.log('SCYLLA_HOST:', process.env.SCYLLA_HOST);
  console.log('SCYLLA_HOSTS:', process.env.SCYLLA_HOSTS);
  console.log('SCYLLA_KEYSPACE:', process.env.SCYLLA_KEYSPACE);
  console.log('--- [DOKPLOY DEBUG] FIN ---');

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  
  const port = process.env.PORT || 3600;
  console.log(`Nest Arrancando en Puerto: ${port}`);
  await app.listen(port);
}
bootstrap();
