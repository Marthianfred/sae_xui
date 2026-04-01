import { Injectable, Logger } from '@nestjs/common';
import { ScyllaService } from '../../common/scylladb/scylladb.service';
import { XuiDbService } from '../../common/xuidb/xuidb.service';

@Injectable()
export class XuiClientsRepository {
  private readonly logger = new Logger(XuiClientsRepository.name);

  constructor(
    private readonly scyllaService: ScyllaService,
    private readonly xuiDbService: XuiDbService,
  ) {}

  /**
   * Busca un cliente directamente en la base de datos de XUI
   */
  async findInXuiByContract(nroContrato: string) {
    return this.xuiDbService.findByContract(nroContrato);
  }

  /**
   * Busca un cliente en ScyllaDB por su cedula
   */
  async findByCedula(cedula: string) {
    const query = 'SELECT * FROM customers WHERE cedula = ? ALLOW FILTERING';
    const result = await this.scyllaService.execute(query, [cedula]);
    return result.rows || [];
  }

  /**
   * Guarda o actualiza el mapeo de sincronización XUI
   */
  async upsertMapping(
    id_contrato: string,
    cedula: string,
    xui_id: number,
    status: string,
  ) {
    const query = `
      INSERT INTO xui_sync_mapping (id_contrato, cedula, xui_id, status, last_sync)
      VALUES (?, ?, ?, ?, toTimestamp(now()))
    `;
    return this.scyllaService.execute(query, [
      id_contrato,
      cedula,
      xui_id,
      status,
    ]);
  }

  /**
   * Obtiene el mapeo actual para un contrato
   */
  async getMapping(id_contrato: string) {
    const query = 'SELECT * FROM xui_sync_mapping WHERE id_contrato = ?';
    const result = await this.scyllaService.execute(query, [id_contrato]);
    return result.first();
  }
}
