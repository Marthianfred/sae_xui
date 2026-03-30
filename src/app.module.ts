import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { ScyllaService } from './common/scylladb/scylladb.service';
import { SyncOutboxService } from './features/sync-outbox/sync-outbox.service';
import { CustomersModule } from './features/customers/customers.module';
import { DocumentsModule } from './features/documents/documents.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: { target: 'pino-pretty' },
      },
    }),
    CustomersModule,
    DocumentsModule,
  ],
  providers: [ScyllaService, SyncOutboxService],
  exports: [ScyllaService],
})
export class AppModule {}
