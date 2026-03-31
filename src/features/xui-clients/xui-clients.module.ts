import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { XuiClientsController } from './xui-clients.controller';
import { XuiClientsService } from './xui-clients.service';
import { XuiClientsRepository } from './xui-clients.repository';
import { XuiClientsMapper } from './xui-clients.mapper';
import { XuiClientsProcessor } from './xui-clients.processor';
import { ScyllaModule } from '../../common/scylladb/scylladb.module';

import { XuiMigrationController } from './xui-migration.controller';

@Module({
  imports: [
    HttpModule,
    ScyllaModule,
    BullModule.registerQueue({
      name: 'xui-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    }),
  ],
  controllers: [XuiClientsController, XuiMigrationController],
  providers: [
    XuiClientsService,
    XuiClientsRepository,
    XuiClientsMapper,
    XuiClientsProcessor,
  ],
  exports: [XuiClientsService],
})
export class XuiClientsModule {}
