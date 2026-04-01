import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CustomersSyncService } from './customers-sync.service';
import { CustomersQueryService } from './query/customers-query.service';
import { CustomersController } from './customers.controller';
import { XuiClientsModule } from '../xui-clients/xui-clients.module';

@Module({
  imports: [HttpModule, XuiClientsModule],
  controllers: [CustomersController],
  providers: [CustomersSyncService, CustomersQueryService],
  exports: [CustomersSyncService, CustomersQueryService],
})
export class CustomersModule {}
