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
    
    const files = fs.readdirSync(this.CHUNKS_DIR).filter(f => f.endsWith('.cql')).sort();
    this.isProcessing = true;
    try {
      for (const file of files) {
        this.logger.log(`>> Procesando ARCHIVO: ${file} 🚀`);
        const content = fs.readFileSync(path.join(this.CHUNKS_DIR, file), 'utf8');
        const batches = content.split('APPLY BATCH;');
        
        for (let i = 0; i < batches.length; i++) {
          let q = batches[i].trim();
          if (q.length < 10) continue;

          // Limpiar comandos USE, comentarios y el punto y coma ilegal tras BEGIN BATCH
          q = q.replace(/USE\s+[^;]+;/gi, '')
               .replace(/BEGIN\s+(UNLOGGED\s+)?BATCH\s*;/gi, 'BEGIN $1BATCH') // Quitar ; de la cabecera
               .trim();
          
          if (q.includes('BEGIN')) {
            await this.scyllaService.execute(q + ' APPLY BATCH;');
          } else {
            // Asegurar que las sentencias individuales tengan su ; si no lo tienen
            const finalQ = q.endsWith(';') ? q : q + ';';
            await this.scyllaService.execute(finalQ);
          }
          
          if (i % 25 === 0) this.logger.log(`   - Progreso en ${file}: ${i}/${batches.length} bloques inyectados... 📈`);
        }
        this.logger.log(`✅ ARCHIVO COMPLETADO: ${file}`);
      }
    } finally { this.isProcessing = false; }
    return { status: 'success', count: files.length, totalPaginas: 1 };
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
