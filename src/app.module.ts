import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DocumentsModule } from './features/documents/documents.module';

import { ScheduleModule } from '@nestjs/schedule';
import { XuiDbModule } from './common/xuidb/xuidb.module';
import { CustomersModule } from './features/customers/customers.module';
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
    XuiDbModule,
    CustomersModule,
    DocumentsModule,
    XuiClientsModule,
  ],
  providers: [],
})
export class AppModule {}
