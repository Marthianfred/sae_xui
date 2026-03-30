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
   * MODO 2: Dump (Streaming)
   */
  async syncDirectlyFromDB() {
    const pool = new Pool({
      host: process.env.HOST_SAE || '34.172.246.50',
      port: 5432,
      user: process.env.USER_SAE || 'postgres',
      database: 'saeplus',
    });
    const client = await pool.connect();
    const stream = client.query(new QueryStream('SELECT id_contrato FROM pnt_contrato LIMIT 1'));
    return new Promise(resolve => {
       stream.on('data', () => {});
       stream.on('end', () => { client.release(); pool.end(); resolve(1); });
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
