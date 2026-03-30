import { Injectable, Logger } from '@nestjs/common';
import { ScyllaService } from '../../common/scylladb/scylladb.service';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as QueryStream from 'pg-query-stream';

@Injectable()
export class CustomersSyncService {
  private readonly logger = new Logger(CustomersSyncService.name);
  private isProcessing = false;
  private readonly CHUNKS_DIR = path.join(process.cwd(), 'migration_timeline');

  constructor(private readonly scyllaService: ScyllaService) {}

  /**
   * Ejecuta la Migración en Línea de Tiempo (Chunks) de forma consecutiva
   */
  async runChunksInSequence() {
    if (this.isProcessing) {
      throw new Error('Sincronización masiva ya está en curso.');
    }

    if (!fs.existsSync(this.CHUNKS_DIR)) {
      throw new Error(`Carpeta de bloques NO ENCONTRADA: ${this.CHUNKS_DIR}. Por favor súbela al servidor.`);
    }

    // LISTAR Y ORDENAR BLOQUES (p001, p002...)
    const cqlFiles = fs.readdirSync(this.CHUNKS_DIR)
      .filter(f => f.endsWith('.cql'))
      .sort();

    if (cqlFiles.length === 0) {
      throw new Error('No se encontraron archivos .cql en la carpeta de bloques.');
    }

    this.isProcessing = true;
    this.logger.log(`🏁 INICIANDO MIGRACIÓN CRONOLÓGICA: ${cqlFiles.length} bloques encontrados.`);

    try {
      for (const file of cqlFiles) {
        const filePath = path.join(this.CHUNKS_DIR, file);
        this.logger.log(`⏳ Procesando bloque: ${file}...`);
        
        // LEER Y EJECUTAR (Simulamos cqlsh -f leyendo el contenido y enviando por bloques)
        // Nota: Para máxima eficiencia en Scylla de gran volumen, lo ideal es parsear y ejecutar.
        // Pero dado que los archivos ya tienen BEGIN/APPLY BATCH, podemos enviar los bloques.
        const content = fs.readFileSync(filePath, 'utf8');
        
        // El driver de Cassandra no acepta archivos completos con múltiples comandos directamente.
        // Dividimos por el delimitador de BATCH para enviar bloques coherentes.
        const batches = content.split('APPLY BATCH;');
        
        this.logger.log(`📦 Bloque ${file}: Desglosado en ${batches.length} transacciones.`);

        for (let i = 0; i < batches.length; i++) {
          const rawBatch = batches[i].trim();
          if (!rawBatch || rawBatch.length < 10) continue;

          // Aseguramos que cada comando termine con APPLY BATCH; si el split lo quitó
          const finalQuery = rawBatch.includes('BEGIN') ? rawBatch + ' APPLY BATCH;' : rawBatch;
          
          try {
            await this.scyllaService.execute(finalQuery);
          } catch (e) {
            this.logger.error(`❌ Error en transaccion ${i} de ${file}: ${e.message}`);
          }
        }
        
        this.logger.log(`✅ Bloque ${file} COMPLETADO.`);
      }

      this.logger.log('✨ MIGRACIÓN TOTAL FINALIZADA CON ÉXITO ✨');
    } catch (error) {
      this.logger.error(`🚨 Fallo crítico en la migración: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }

    return { message: 'Migración cronológica iniciada. Revisa los logs para el progreso.' };
  }

  // ... (otros métodos existentes como syncDirectlyFromDB permanecen iguales)
}
