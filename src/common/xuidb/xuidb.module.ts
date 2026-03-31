import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { XuiDbService } from './xuidb.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [XuiDbService],
  exports: [XuiDbService],
})
export class XuiDbModule {}
