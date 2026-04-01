import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { XuiClientsController } from './xui-clients.controller';
import { XuiClientsService } from './xui-clients.service';
import { XuiClientsRepository } from './xui-clients.repository';
import { XuiClientsMapper } from './xui-clients.mapper';
import { ScyllaModule } from '../../common/scylladb/scylladb.module';

import { XuiMigrationController } from './xui-migration.controller';

@Module({
  imports: [
    HttpModule,
    ScyllaModule,
  ],
  controllers: [XuiClientsController, XuiMigrationController],
  providers: [
    XuiClientsService,
    XuiClientsRepository,
    XuiClientsMapper,
  ],
  exports: [XuiClientsService],
})
export class XuiClientsModule {}
