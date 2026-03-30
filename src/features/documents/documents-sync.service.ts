import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class DocumentsSyncService {
  constructor(
    private readonly http: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async syncBillingData(contractId: string) {
    const url = `http://api.saeplus.com/public/resources/contratos/UltimaFacturaEdoCuenta`;
    const response = await lastValueFrom(
      this.http.get(url, {
        params: { id: contractId },
        headers: {
          'Api-Token': process.env.SAE_TOKEN,
          'Api-Connect': process.env.SAE_CONNECT,
        },
      }),
    );

    if (response.data?.success) {
      this.eventEmitter.emit('sync.document.fetched', {
        entity: 'document',
        action: 'sync',
        data: response.data.data.info,
      });
    }
  }
}
