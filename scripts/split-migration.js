const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function splitCqlFile() {
  const filePath = path.join(process.cwd(), 'migration_high_performance.cql');
  const outputDir = path.join(process.cwd(), 'migration_timeline');
  const chunkSize = 50000; // Líneas por bloque

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
  let chunkStream = null;

  function createNewChunkStream() {
    if (chunkStream) chunkStream.end();
    const chunkName = `migration_timeline_p${chunkId.toString().padStart(3, '0')}.cql`;
    console.log(`CREADO SEGMENTO OK: ${chunkName}`);
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

    // Segmentar solo cuando terminamos un BATCH para no romper la sintaxis
    if (lineCount >= chunkSize && line.trim() === 'APPLY BATCH;') {
      createNewChunkStream(); 
      lineCount = 0;
    }
  }

  if (chunkStream) chunkStream.end();
  console.log('--- SEGMENTACIÓN COMPLETADA CON ÉXITO ---');
  console.log(`Resultado: ${chunkId - 1} archivos CQL listos para inyección.`);
}

splitCqlFile();
