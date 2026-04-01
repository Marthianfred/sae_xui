import { Injectable, Logger } from '@nestjs/common';
import { XuiDbService } from '../../common/xuidb/xuidb.service';
import { XuiClientData } from './interfaces/xui-api.interface';
import { XuiClientsMapper } from './xui-clients.mapper';

@Injectable()
export class XuiClientsService {
  private readonly logger = new Logger(XuiClientsService.name);

  // Estado de la sincronización persistente para monitoreo
  private syncStatus = {
    running: false,
    processed: 0,
    created: 0,
    updated: 0,
    skippedWave: 0,
    error: null as string | null
  };

  constructor(
    private readonly xuiDb: XuiDbService,
    private readonly xuiMapper: XuiClientsMapper,
  ) {}

  getSyncStatus() {
    return this.syncStatus;
  }

  resetStatus() {
    this.syncStatus = {
      running: true,
      processed: 0,
      created: 0,
      updated: 0,
      skippedWave: 0,
      error: null
    };
  }

  updateProgress(action: 'CREATED' | 'UPDATED' | 'SKIPPED_WAVE') {
    this.syncStatus.processed++;
    if (action === 'CREATED') this.syncStatus.created++;
    if (action === 'UPDATED') this.syncStatus.updated++;
    if (action === 'SKIPPED_WAVE') this.syncStatus.skippedWave++;
  }

  setFinished() {
    this.syncStatus.running = false;
  }

  setError(msg: string) {
    this.syncStatus.error = msg;
    this.syncStatus.running = false;
  }

  /**
   * Sincroniza un único cliente desde un objeto de datos de SAE
   */
  async syncSingleCustomer(saeCustomer: any) {
    const xuiData = this.xuiMapper.toXuiClient(saeCustomer);
    if (!xuiData) {
      this.updateProgress('SKIPPED_WAVE');
      return { action: 'SKIPPED_WAVE' };
    }

    try {
      const result = await this.upsertLine(xuiData);
      if (result.id) {
        await this.setLineStatus(result.id, saeCustomer.nombrestatus === 'ACTIVO');
      }
      
      this.updateProgress(result.action as any);
      return result;
    } catch (e) {
      this.logger.error(`Error syncSingleCustomer (${saeCustomer.cedula}): ${e.message}`);
      throw e;
    }
  }

  /**
   * Sincroniza o crea una línea directamente en MySQL XUI
   */
  async upsertLine(data: XuiClientData) {
    const existing = await this.xuiDb.findByContract(data.notes || '');
    
    const bouquetsJson = JSON.stringify(data.bouquets_selected);
    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      const sql = `
        UPDATE \`lines\` 
        SET username = ?, 
            password = ?, 
            bouquet = ?, 
            reseller_notes = ?, 
            enabled = ?,
            max_connections = ?,
            updated = ?
        WHERE id = ?
      `;
      await this.xuiDb.query(sql, [
        data.username,
        data.password || existing.password,
        bouquetsJson,
        data.reseller_notes,
        1,
        data.max_connections || 2,
        now,
        existing.id
      ]);
      return { result: true, action: 'UPDATED', id: existing.id };
    } else {
      const sql = `
        INSERT INTO \`lines\` 
        (member_id, username, password, admin_notes, reseller_notes, bouquet, max_connections, created_at, updated, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await this.xuiDb.query(sql, [
        1,
        data.username,
        data.password || Math.random().toString(36).substring(2, 10),
        data.notes,
        data.reseller_notes,
        bouquetsJson,
        data.max_connections || 2,
        now,
        now,
        1
      ]);
      // @ts-ignore
      const newId = result.insertId;
      return { result: true, action: 'CREATED', id: newId };
    }
  }

  /**
   * Habilita/Deshabilita una linea vía MySQL
   */
  async setLineStatus(id: number, active: boolean) {
    const sql = 'UPDATE `lines` SET enabled = ? WHERE id = ?';
    await this.xuiDb.query(sql, [active ? 1 : 0, id]);
    return { result: true };
  }
}
