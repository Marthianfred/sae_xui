import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

async function splitCqlFile() {
  const filePath = path.join(process.cwd(), 'migration_high_performance.cql');
  const outputDir = path.join(process.cwd(), 'migration_timeline');
  const chunkSize = 50000; // Lines per chunk

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let chunkId = 1;
  let lineCount = 0;
  let chunkStream: fs.WriteStream | null = null;

  function createNewChunkStream() {
    if (chunkStream) chunkStream.end();
    const chunkName = `migration_timeline_p${chunkId.toString().padStart(3, '0')}.cql`;
    console.log(`Creando segmento: ${chunkName}`);
    chunkStream = fs.createWriteStream(path.join(outputDir, chunkName));
    chunkStream.write('USE sync_sae;\n\n');
    chunkId++;
  }

  createNewChunkStream();

  for await (const line of rl) {
    if (chunkStream) {
       chunkStream.write(line + '\n');
    }
    lineCount++;

    // Only split if we are at the end of a BATCH block to prevent syntax errors
    if (lineCount >= chunkSize && line.trim() === 'APPLY BATCH;') {
      createNewChunkStream(); 
      lineCount = 0;
    }
  }

  if (chunkStream) chunkStream.end();
  console.log('--- SEGMENTACIÓN COMPLETADA ---');
  console.log(`Se han generado ${chunkId - 1} bloques en la carpeta /migration_timeline/`);
}

splitCqlFile();
