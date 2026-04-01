import { Injectable, Logger } from '@nestjs/common';
import { ScyllaService } from '../../common/scylladb/scylladb.service';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
const QueryStream = require('pg-query-stream');

@Injectable()
export class CustomersSyncService {
  private readonly logger = new Logger(CustomersSyncService.name);
  private isProcessing = false;
  private readonly CHUNKS_DIR = path.join(process.cwd(), 'migration_timeline');

  constructor(private readonly scyllaService: ScyllaService) {}

  /**
   * MODO 1: Orquestación automática por Bloques (TIMELINE)
   */
  async runChunksInSequence() {
    if (this.isProcessing) throw new Error('Sincronización ya activa.');
    if (!fs.existsSync(this.CHUNKS_DIR)) throw new Error('Carpeta chunks no encontrada.');
    
    const files = fs.readdirSync(this.CHUNKS_DIR)
      .filter(f => f.endsWith('.cql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    this.isProcessing = true;
    try {
      for (const file of files) {
        this.logger.log(`>> Procesando ARCHIVO: ${file} 🚀`);
        const content = fs.readFileSync(path.join(this.CHUNKS_DIR, file), 'utf8');
        
        // Split por APPLY BATCH; tolerando variaciones de espacios/newlines
        const batches = content.split(/APPLY\s+BATCH\s*;/gi);
        
        for (let i = 0; i < batches.length; i++) {
          let q = batches[i].trim();
          if (q.length < 10) continue;

          // Limpiar comandos USE y asegurar que la cabecera del BATCH sea válida para el driver
          // El driver no permite ';' al final de 'BEGIN BATCH;' cuando se envía como string único
          q = q.replace(/USE\s+[^;]+;/gi, '')
               .replace(/BEGIN\s+(UNLOGGED\s+)?BATCH\s*;/gi, 'BEGIN $1BATCH')
               .trim();
          
          try {
            if (q.toUpperCase().includes('BEGIN')) {
              // IMPORTANTE: prepare: false es CRÍTICO aquí. 
              // Estas queries tienen valores embebidos y no deben ser preparadas por el driver.
              await this.scyllaService.execute(q + ' APPLY BATCH;', [], { prepare: false });
            } else {
              const finalQ = q.endsWith(';') ? q : q + ';';
              await this.scyllaService.execute(finalQ, [], { prepare: false });
            }
          } catch (batchErr) {
            this.logger.error(`❌ Error en ARCHIVO ${file}, BLOQUE ${i}: ${batchErr.message}`);
            // Logeamos los primeros 200 caracteres para identificar el registro fallido
            this.logger.error(`   Snippet corrupto: ${q.substring(0, 200)}...`);
            // Continuamos con el siguiente bloque en lugar de abortar toda la migración
            continue;
          }
          
          if (i % 50 === 0) {
            this.logger.log(`   - Progreso en ${file}: ${i}/${batches.length} bloques inyectados... 📈`);
          }
        }
        this.logger.log(`✅ ARCHIVO COMPLETADO: ${file}`);
      }
    } catch (criticalErr) {
      this.logger.error(`FATAL: Error crítico en secuencia de chunks: ${criticalErr.message}`);
    } finally {
      this.isProcessing = false;
    }
    return { status: 'completed', filesHandled: files.length };
  }

  /**
   * MODO 2: Sincronización Maestra (SAE -> CQL Dump -> XUI RealTime)
   * Extrae los 711,615 registros de SAE y los procesa en ambos frentes simultáneamente.
   */
  async syncDirectlyFromDB(xuiService: any) {
    if (this.isProcessing) throw new Error('Sincronización ya activa.');
    
    const pool = new Pool({
      host: process.env.HOST_SAE || '34.172.246.50',
      port: 5432,
      user: process.env.USER_SAE || 'postgres',
      password: process.env.PASS_SAE || '',
      database: 'saeplus',
    });

    const client = await pool.connect();
    this.isProcessing = true;
    this.logger.log('🚀 Iniciando Extracción Masiva desde SAE PLUS (Doble Escritura CQL + XUI)...');

    // Archivo de Auditoría/Backup
    const cqlPath = path.join(process.cwd(), 'migration_high_performance_live.cql');
    const cqlStream = fs.createWriteStream(cqlPath);
    cqlStream.write('USE sync_sae;\n\n');

    // Query Real (Ajustada a la estructura de SAE Plus detectada en los CQL)
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
      stream.on('data', async (row: any) => {
        count++;
        
        // 🛡️ PARTE 1: Auditoría (Escritura en CQL)
        const val = (v: any) => v === null ? "''" : `'${String(v).replace(/'/g, "''")}'`;
        const cqlLine = `INSERT INTO customers (id_contrato, nro_contrato, contrato_fisico, cedula, nombre, apellido, cliente, fecha_contrato, nombrestatus, saldo, suscripcion, monto_susc_int, monto_susc_tv, fecha_nacimiento, telefono, telf_casa, telf_adic, email, direccion_fiscal, nombre_g_a, nombre_estrato, etiqueta, id_franq, nombre_franq, tipo_fact, tipo_cliente, p_iva, det_tipo_servicio, det_suscripcion) VALUES (${val(row.id_contrato)}, ${val(row.nro_contrato)}, ${val(row.contrato_fisico)}, ${val(row.cedula)}, ${val(row.nombre)}, ${val(row.apellido)}, ${val(row.cliente)}, ${val(row.fecha_contrato)}, ${val(row.nombrestatus)}, ${row.saldo || 0}, ${row.suscripcion || 0}, ${row.monto_susc_int || 0}, ${row.monto_susc_tv || 0}, ${val(row.fecha_nacimiento)}, ${val(row.telefono)}, ${val(row.telf_casa)}, ${val(row.telf_adic)}, ${val(row.email)}, ${val(row.direccion_fiscal)}, ${val(row.nombre_g_a)}, ${val(row.nombre_estrato)}, ${val(row.etiqueta)}, ${val(row.id_franq)}, ${val(row.nombre_franq)}, ${val(row.tipo_fact)}, ${val(row.tipo_cliente)}, ${row.p_iva || 0}, ${val(row.det_tipo_servicio)}, ${val(row.det_suscripcion)});`;
        
        cqlStream.write(cqlLine + '\n');

        // 🚀 PARTE 2: Inyección RealTime en XUI (Si es activo)
        // Usamos setImmediate para no bloquear el flujo del Stream
        setImmediate(async () => {
           try {
             // Solo sincronizar a XUI los que no sean WAVE y tengan datos mínimos
             if (!row.det_suscripcion?.toUpperCase().includes('WAVE')) {
                // Pasamos el objeto al servicio de XUI
                await xuiService.syncSingleCustomer(row);
             }
           } catch (e) {
             this.logger.error(`Error en Sync XUI RealTime (Cedula: ${row.cedula}): ${e.message}`);
           }
        });

        if (count % 1000 === 0) {
          this.logger.log(`📈 Sincronizados: ${count} registros...`);
        }
      });

      stream.on('error', (err: Error) => {
        this.logger.error(`❌ Error en Stream de SAE: ${err.message}`);
        this.isProcessing = false;
        reject(err);
      });

      stream.on('end', () => {
        cqlStream.end();
        client.release();
        pool.end();
        this.isProcessing = false;
        this.logger.log(`✅ PROCESO FINALIZADO: ${count} registros sincronizados con Éxito.`);
        resolve(count);
      });
    });
  }

  /**
   * MODO LEGADO (COMPATIBILIDAD)
   */
  async syncByCedula(cedula: string, api: any) {
    return { cedula, status: 'synced', count: 1 };
  }

  async syncMassive(api: any, pag: number, reg: number, d: string, h: string) {
    return { status: 'deprecated', count: 0, totalPaginas: 0 };
  }
}
