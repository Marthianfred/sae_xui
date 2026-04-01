import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DocumentsSyncService } from './documents-sync.service';

@Module({
  imports: [HttpModule],
  providers: [DocumentsSyncService],
  exports: [DocumentsSyncService],
})
export class DocumentsModule {}
