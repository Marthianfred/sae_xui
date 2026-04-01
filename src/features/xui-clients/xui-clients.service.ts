import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { XuiDbService } from '../../common/xuidb/xuidb.service';
import { XuiClientData } from './interfaces/xui-api.interface';
import { XuiClientsMapper } from './xui-clients.mapper';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

@Injectable()
export class XuiClientsService {
  private readonly logger = new Logger(XuiClientsService.name);
  private readonly TOTAL_EXPECTED = 711615;

  // Estado de la migración para consulta externa
  private migrationStatus = {
    running: false,
    processed: 0,
    created: 0,
    updated: 0,
    skippedWave: 0,
    currentFile: '',
    error: null as string | null
  };

  constructor(
    private readonly xuiDb: XuiDbService,
    private readonly xuiMapper: XuiClientsMapper,
  ) {}

  /**
   * ⏰ TAREA PROGRAMADA: Se ejecuta 4 veces al día (00, 06, 12, 18 hrs)
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  handleCron() {
    this.logger.log('⏰ Iniciando Sincronización Programada (Automática - 711k)...');
    const chunksDir = path.join(process.cwd(), 'migration_timeline');
    this.startMassiveMigration(chunksDir);
  }

  getMigrationStatus() {
    return this.migrationStatus;
  }

  /**
   * Lanza la migración masiva en segundo plano
   */
  startMassiveMigration(chunksDir: string) {
    if (this.migrationStatus.running) return { message: 'Migration already in progress' };

    this.migrationStatus.running = true;
    this.migrationStatus.processed = 0;
    this.migrationStatus.created = 0;
    this.migrationStatus.updated = 0;
    this.migrationStatus.skippedWave = 0;
    
    // Lanzar SIN AWAIT para liberar el HTTP
    this.runMigrationLogic(chunksDir).catch(err => {
      this.logger.error(`Migration crashed: ${err.message}`);
      this.migrationStatus.error = err.message;
      this.migrationStatus.running = false;
    });

    return { message: 'Migration started in background' };
  }

  private async runMigrationLogic(chunksDir: string) {
    const startTime = Date.now();
    const files = fs.readdirSync(chunksDir)
      .filter(f => f.endsWith('.cql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const reportPath = path.join(process.cwd(), 'migration_report.csv');
    const reportStream = fs.createWriteStream(reportPath);
    reportStream.write('Cedula,Contrato,Accion,Estatus,Plan,FechaSync\n');

    for (const file of files) {
      if (!this.migrationStatus.running) break;

      this.migrationStatus.currentFile = file;
      const filePath = path.join(chunksDir, file);
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
      });

      const fields = ['id_contrato', 'nro_contrato', 'contrato_fisico', 'cedula', 'nombre', 'apellido', 'cliente', 'fecha_contrato', 'nombrestatus', 'saldo', 'suscripcion', 'monto_susc_int', 'monto_susc_tv', 'fecha_nacimiento', 'telefono', 'telf_casa', 'telf_adic', 'email', 'direccion_fiscal', 'nombre_g_a', 'nombre_estrato', 'etiqueta', 'id_franq', 'nombre_franq', 'tipo_fact', 'tipo_cliente', 'p_iva', 'det_tipo_servicio', 'det_suscripcion'];

      let currentStatement = '';
      const batch: any[] = [];
      const BATCH_SIZE = 50;

      for await (const line of rl) {
        currentStatement += line + ' ';
        if (line.trim().endsWith(');')) {
          const statement = currentStatement;
          currentStatement = '';

          if (!statement.includes('VALUES')) continue;
          
          const valuesMatch = statement.match(/VALUES\s*\((.*)\)/s);
          if (!valuesMatch) continue;

          let valuePart = valuesMatch[1].trim();
          valuePart = valuePart.replace(/,?\s*toTimestamp\(now\(\)\)\s*/g, '');

          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < valuePart.length; i++) {
            const char = valuePart[i];
            if (char === "'" && (i === 0 || valuePart[i-1] !== "\\")) inQuotes = !inQuotes;
            else if (char === "," && !inQuotes) {
              values.push(current.trim().replace(/^'|'$/g, ''));
              current = '';
            } else current += char;
          }
          values.push(current.trim().replace(/^'|'$/g, ''));

          if (values.length < 20) continue;

          const saeCustomer: any = {};
          fields.forEach((f, i) => { saeCustomer[f] = values[i] || ''; });
          batch.push(saeCustomer);

          // CUANDO EL BATCH ESTÁ LLENO, PROCESAR TODO EN PARALELO
          if (batch.length >= BATCH_SIZE) {
            await Promise.all(batch.map(async (customer) => {
               const xuiData = this.xuiMapper.toXuiClient(customer);
               if (!xuiData) {
                 this.migrationStatus.skippedWave++;
                 this.migrationStatus.processed++;
                 return;
               }

               try {
                  const result = await this.upsertLine(xuiData);
                  if (result.id) {
                     await this.setLineStatus(result.id, customer.nombrestatus === 'ACTIVO');
                  }

                  const timestamp = new Date().toISOString();
                  reportStream.write(`${customer.cedula},${customer.nro_contrato},${result.action},${customer.nombrestatus},"${customer.det_suscripcion}",${timestamp}\n`);

                  if (result.action === 'CREATED') this.migrationStatus.created++;
                  else this.migrationStatus.updated++;
                  
                  this.migrationStatus.processed++;
               } catch (e) {
                  this.logger.warn(`Error sync cedula ${customer.cedula}: ${e.message}`);
               }
            }));
            
            // 📊 Barra de Progreso y Estadísticas Visuales (Cada 1,000 registros)
            if (this.migrationStatus.processed % 1000 === 0) {
              const elapsedMs = Date.now() - startTime;
              const recsPerSec = Math.floor(this.migrationStatus.processed / (elapsedMs / 1000)) || 1;
              const percent = (this.migrationStatus.processed / this.TOTAL_EXPECTED) * 100;
              const barLen = 30; // Un poco más larga para más detalle
              const filledLen = Math.floor((percent / 100) * barLen);
              const bar = '█'.repeat(filledLen) + '░'.repeat(barLen - filledLen);
              const etaMs = ((this.TOTAL_EXPECTED - this.migrationStatus.processed) / recsPerSec) * 1000;
              const etaMin = Math.floor(etaMs / 60000);
              
              this.logger.log(`📊 [${bar}] ${percent.toFixed(1)}% | ${this.migrationStatus.processed}/${this.TOTAL_EXPECTED} | r/s: ${recsPerSec} | ETA: ${etaMin}m`);
            }
            
            batch.length = 0; // Limpiar batch
          }
        }
      }
      
      // PROCESAR ÚLTIMOS REGISTROS RESTANTES
      if (batch.length > 0) {
        await Promise.all(batch.map(async (customer) => {
           const xuiData = this.xuiMapper.toXuiClient(customer);
           if (!xuiData) return;
           try {
              const result = await this.upsertLine(xuiData);
              if (result.id) await this.setLineStatus(result.id, customer.nombrestatus === 'ACTIVO');
              this.migrationStatus.processed++;
              if (result.action === 'CREATED') this.migrationStatus.created++;
              else this.migrationStatus.updated++;
           } catch (e) {}
        }));
      }
    }
    reportStream.end();
    this.migrationStatus.running = false;
    this.migrationStatus.currentFile = 'FINISHED';
  }

  getReportPath() {
    return path.join(process.cwd(), 'migration_report.csv');
  }

  /**
   * Sincroniza un único cliente desde un objeto de datos de SAE
   */
  async syncSingleCustomer(saeCustomer: any) {
    const xuiData = this.xuiMapper.toXuiClient(saeCustomer);
    if (!xuiData) return { action: 'SKIPPED_WAVE' };

    try {
      const result = await this.upsertLine(xuiData);
      if (result.id) {
        await this.setLineStatus(result.id, saeCustomer.nombrestatus === 'ACTIVO');
      }
      return result;
    } catch (e) {
      this.logger.error(`Error syncSingleCustomer (${saeCustomer.cedula}): ${e.message}`);
      throw e;
    }
  }

  /**
   * Sincroniza o crea una línea directamente en MySQL
   */
  async upsertLine(data: XuiClientData) {
    const existing = await this.xuiDb.findByContract(data.notes || '');
    
    const bouquetsJson = JSON.stringify(data.bouquets_selected);
    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      // UPDATE
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
        1, // Siempre activo si estamos sincronizando una alta/cambio
        data.max_connections || 2,
        now,
        existing.id
      ]);
      return { result: true, action: 'UPDATED', id: existing.id };
    } else {
      // INSERT
      const sql = `
        INSERT INTO \`lines\` 
        (member_id, username, password, admin_notes, reseller_notes, bouquet, max_connections, created_at, updated, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await this.xuiDb.query(sql, [
        1, // admin
        data.username,
        data.password || Math.random().toString(36).substring(2, 10),
        data.notes,
        data.reseller_notes,
        bouquetsJson,
        data.max_connections || 2,
        now,
        now,
        1 // Habilitado por defecto
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
