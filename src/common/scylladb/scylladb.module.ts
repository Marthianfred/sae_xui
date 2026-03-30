import { Module, Global } from '@nestjs/common';
import { ScyllaService } from './scylladb.service';

@Global()
@Module({
  providers: [ScyllaService],
  exports: [ScyllaService],
})
export class ScyllaModule {}
