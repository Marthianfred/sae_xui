import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { CustomersSyncService } from './customers-sync.service';
import { CustomersProcessor } from './customers.processor';
import { CustomersQueryService } from './query/customers-query.service';
import { CustomersController } from './customers.controller';
import { ScyllaModule } from '../../common/scylladb/scylladb.module';
import { XuiClientsModule } from '../xui-clients/xui-clients.module';

@Module({
  imports: [
    HttpModule,
    ScyllaModule,
    XuiClientsModule,
    BullModule.registerQueue({
      name: 'customers-sync',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  controllers: [CustomersController],
  providers: [
    CustomersSyncService, 
    CustomersProcessor, 
    CustomersQueryService
  ],
  exports: [CustomersSyncService, CustomersQueryService],
})
export class CustomersModule {}
