import { Controller, Get, Post, Query, Headers, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CustomersQueryService } from './query/customers-query.service';
import { CustomersSyncService } from './customers-sync.service';
import { FindByCedulaDto } from './query/dto/find-by-cedula.dto';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly queryService: CustomersQueryService,
    private readonly syncService: CustomersSyncService,
    @InjectQueue('customers-sync') private readonly syncQueue: Queue,
  ) {}

  @Get('search')
  async searchByCedula(
    @Query() query: FindByCedulaDto,
    @Headers('api-connect') apiConnect: string,
  ) {
    const data = await this.queryService.findByCedula(query.cedula, apiConnect);
    return {
      success: true,
      data: {
        resultado: 'ok',
        info: data,
      },
    };
  }

  @Post('sync/massive')
  async startMassiveSync(
    @Headers('api-connect') apiConnect: string,
    @Body() body: { nro_registros?: number }
  ) {
    await this.syncQueue.add('start-massive-sync', {
      type: 'START_MASSIVE_SYNC',
      apiConnect,
      nro_registros: body.nro_registros || 3000
    });

    return {
      success: true,
      message: 'Proceso de sincronización masiva encolado.',
    };
  }

  @Post('sync/pause')
  async pauseSync() {
    await this.syncQueue.pause();
    return { success: true, message: 'Sincronización pausada exitosamente.' };
  }

  @Post('sync/resume')
  async resumeSync() {
    await this.syncQueue.resume();
    return { success: true, message: 'Sincronización reanudada exitosamente.' };
  }
}
