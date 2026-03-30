import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ScyllaService } from '../../common/scylladb/scylladb.service';

@Injectable()
export class SyncOutboxService {
  constructor(private readonly scylla: ScyllaService) {}

  @OnEvent('sync.*')
  async handleSyncEvent(payload: any) {
    const query = 'INSERT INTO sync_events (id, entity, action, data, created_at) VALUES (uuid(), ?, ?, ?, toTimestamp(now()))';
    await this.scylla.execute(query, [
      payload.entity,
      payload.action,
      JSON.stringify(payload.data),
    ]);
  }
}
