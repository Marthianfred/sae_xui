import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import QueryStream from 'pg-query-stream';
import { XuiClientsService } from '../xui-clients/xui-clients.service';

@Injectable()
export class CustomersSyncService {
  private readonly logger = new Logger(CustomersSyncService.name);
  private isProcessing = false;

  /**
   * Sincronización Directa: SAE PLUS -> XUI ONE
   * Extrae los registros de SAE y los procesa en XUI por Streaming.
   */
  async syncDirectlyFromDB(xuiService: XuiClientsService) {
    if (this.isProcessing) throw new Error('Sincronización ya activa.');

    const pool = new Pool({
      host: process.env.HOST_SAE || '34.172.246.50',
      port: 5432,
      user: process.env.USER_SAE || 'postgres',
      password: process.env.PASSWORD_SAE || '',
      database: process.env.DATABASE_SAE || 'saeplus',
      ssl: { rejectUnauthorized: false }, // Habilitar SSL para evitar bloqueos
    });

    const client = await pool.connect();
    this.isProcessing = true;
    xuiService.resetStatus();
    this.logger.log(
      '🚀 Iniciando Sincronización Directa SAE PLUS -> XUI ONE...',
    );

    const sql = `
      SELECT 
        id_contrato, nro_contrato, contrato_fisico, cedula, nombre, apellido, cliente, 
        fecha_contrato, nombrestatus, saldo, suscripcion, monto_susc_int, monto_susc_tv, 
        fecha_nacimiento, telefono, telf_casa, telf_adic, email, direccion_fiscal, 
        nombre_g_a, nombre_estrato, etiqueta, id_franq, nombre_franq, tipo_fact, 
        tipo_cliente, p_iva, det_tipo_servicio, det_suscripcion 
      FROM pnt_contrato
    `;

    const queryStream = new QueryStream(sql);
    const stream = client.query(queryStream);

    let count = 0;

    return new Promise((resolve, reject) => {
      stream.on('data', async (row: Record<string, any>) => {
        count++;

        // Inyección RealTime en XUI mediante microtask
        setImmediate(async () => {
          try {
            const det = row.det_suscripcion as string | undefined;
            if (!det?.toUpperCase().includes('WAVE')) {
              await xuiService.syncSingleCustomer(row);
            } else {
              xuiService.updateProgress('SKIPPED_WAVE');
            }
          } catch (e) {
            const error = e as Error;
            this.logger.error(
              `Error en Sync XUI (Cedula: ${row.cedula}): ${error.message}`,
            );
          }
        });

        if (count % 1000 === 0) {
          this.logger.log(`📈 Procesados: ${count} registros...`);
        }
      });

      stream.on('error', (err: Error) => {
        this.logger.error(`❌ Error en Stream de SAE: ${err.message}`);
        this.isProcessing = false;
        xuiService.setError(err.message);
        reject(err);
      });

      stream.on('end', () => {
        client.release();
        pool.end();
        this.isProcessing = false;
        xuiService.setFinished();
        this.logger.log(
          `✅ PROCESO FINALIZADO: ${count} registros procesados.`,
        );
        resolve(count);
      });
    });
  }
}
