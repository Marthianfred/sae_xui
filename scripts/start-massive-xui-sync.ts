import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { XuiClientsProcessor } from '../src/features/xui-clients/xui-clients.processor';
import * as fs from 'fs';
import * as path from 'path';

const CHUNKS_DIR = path.join(process.cwd(), 'migration_timeline');

import * as readline from 'readline';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const processor = app.get(XuiClientsProcessor);

  const files = fs.readdirSync(CHUNKS_DIR)
    .filter(f => f.endsWith('.cql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  console.log(`\n🚀 INICIANDO SINCRONIZACIÓN GLOBAL: ${files.length} ARCHIVOS.`);
  
  let globalCount = 0;
  let skippedWave = 0;
  let updatedCount = 0;
  let createdCount = 0;

  for (const file of files) {
    console.log(`\n📂 Abriendo: ${file}...`);
    const filePath = path.join(CHUNKS_DIR, file);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const fields = ['id_contrato', 'nro_contrato', 'contrato_fisico', 'cedula', 'nombre', 'apellido', 'cliente', 'fecha_contrato', 'nombrestatus', 'saldo', 'suscripcion', 'monto_susc_int', 'monto_susc_tv', 'fecha_nacimiento', 'telefono', 'telf_casa', 'telf_adic', 'email', 'direccion_fiscal', 'nombre_g_a', 'nombre_estrato', 'etiqueta', 'id_franq', 'nombre_franq', 'tipo_fact', 'tipo_cliente', 'p_iva', 'det_tipo_servicio', 'det_suscripcion'];

    let currentStatement = '';

    for await (const line of rl) {
      currentStatement += line + ' ';
      
      const trimmedLine = line.trim();
      if (trimmedLine.endsWith(');')) {
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
          if (char === "'" && (i === 0 || valuePart[i-1] !== "\\")) {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            values.push(current.trim().replace(/^'|'$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^'|'$/g, ''));

        if (values.length < 20) continue; // Al menos 20 campos mínimos por precaución

        const customer: any = {};
        fields.forEach((f, i) => {
           customer[f] = values[i] || '';
        });

        // @ts-ignore
        const result = await processor.syncCustomer(customer);
        
        globalCount++;
        if (result.status === 'SKIPPED_WAVE') skippedWave++;
        else if (result.status === 'CREATED') createdCount++;
        else if (result.status === 'UPDATED') updatedCount++;
        
        // Reporte ultra-detallado para el inicio
        if (globalCount <= 10) {
          console.log(`✅ [DEBUG] Procesado: ${customer.cedula} | Resultado: ${result.status}`);
        }

        // Reporte por consola estándar - Aumentamos frecuencia a 50 para visibilidad constante
        if (globalCount % 50 === 0) {
          console.log(`📈 PROGRESO: [${globalCount}] | Creados: ${createdCount} | Actualizados: ${updatedCount} | WAVE: ${skippedWave}`);
        }
      }
    }
  }

  console.log(`\n✅ SINCRONIZACIÓN FINALIZADA CON ÉXITO.`);
  console.log(`----------------------------------------------------------`);
  console.log(`Total Procesados: ${globalCount}`);
  console.log(`Nuevos en XUI: ${createdCount}`);
  console.log(`Actualizados en XUI: ${updatedCount}`);
  console.log(`Excluidos (WAVE): ${skippedWave}`);

  await app.close();
}

run();
