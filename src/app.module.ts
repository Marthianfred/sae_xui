import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { ScyllaService } from './common/scylladb/scylladb.service';
import { SyncOutboxService } from './features/sync-outbox/sync-outbox.service';
import { CustomersModule } from './features/customers/customers.module';
import { DocumentsModule } from './features/documents/documents.module';

import { ScheduleModule } from '@nestjs/schedule';
import { ScyllaModule } from './common/scylladb/scylladb.module';
import { XuiDbModule } from './common/xuidb/xuidb.module';
import { XuiClientsModule } from './features/xui-clients/xui-clients.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: { target: 'pino-pretty' },
      },
    }),
    ScyllaModule,
    XuiDbModule,
    CustomersModule,
    DocumentsModule,
    XuiClientsModule,
  ],
  providers: [SyncOutboxService],
  exports: [ScyllaModule],
})
export class AppModule {}
