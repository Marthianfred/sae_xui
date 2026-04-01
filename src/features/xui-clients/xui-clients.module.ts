import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { XuiClientsService } from './xui-clients.service';
import { XuiClientsRepository } from './xui-clients.repository';
import { XuiClientsMapper } from './xui-clients.mapper';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [XuiClientsService, XuiClientsRepository, XuiClientsMapper],
  exports: [XuiClientsService],
})
export class XuiClientsModule {}
