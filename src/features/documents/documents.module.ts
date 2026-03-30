import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { DocumentsSyncService } from './documents-sync.service';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'documents-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      },
    }),
  ],
  providers: [DocumentsSyncService],
  exports: [DocumentsSyncService],
})
export class DocumentsModule {}
