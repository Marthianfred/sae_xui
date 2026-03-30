import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import QueryStream from 'pg-query-stream';

@Injectable()
export class CustomersSyncService {
  private readonly logger = new Logger(CustomersSyncService.name);
  private readonly migrationFile = path.join(
    process.cwd(),
    'migration_high_performance.cql',
  );
  private writeStream: fs.WriteStream | null = null;

  constructor(private readonly http: HttpService) {
    this.initializeStream();
  }

  private initializeStream() {
    if (!fs.existsSync(this.migrationFile)) {
      fs.writeFileSync(this.migrationFile, 'USE sync_sae;\n\n');
    }
    this.writeStream = fs.createWriteStream(this.migrationFile, { flags: 'a' });
  }

  async syncMassive(
    apiConnect: string,
    pagina = 0,
    nroRegistros = 2000,
    desde?: string,
    hasta?: string,
  ) {
    let url = `https://api.saeplus.com/public/resources/contratos/ListadoAbonados?pagina=${pagina}&nro_registros=${nroRegistros}`;

    if (desde) url += `&desde=${desde}`;
    if (hasta) url += `&hasta=${hasta}`;

    try {
      this.logger.log(
        `Solicitando Página ${pagina} (${nroRegistros} registros) con Auth Completa...`,
      );
      const apiStartTime = Date.now();

      const response = await lastValueFrom(
        this.http.get(url, {
          headers: {
            'Accept-Encoding': 'application/json',
            Accept: 'application/json',
            'Api-Token': process.env.SAE_TOKEN,
            'Api-Connect': process.env.SAE_CONNECT || apiConnect,
            Authorization: process.env.SAE_AUTH,
            Cookie: process.env.SAE_COOKIE,
          },
        }),
      );

      const apiDuration = (Date.now() - apiStartTime) / 1000;
      this.logger.debug(`API SAE respondió en ${apiDuration.toFixed(2)}s`);

      if (response.data?.message === 'Ok' || response.data?.data) {
        const customers = response.data.data;
        const writeStartTime = Date.now();

        for (const customer of customers) {
          const statement = this.generateInsertStatement(customer);
          if (this.writeStream) {
            this.writeStream.write(statement);
          }
        }

        const writeDuration = (Date.now() - writeStartTime) / 1000;
        this.logger.debug(
          `Escritura en disco completada en ${writeDuration.toFixed(3)}s`,
        );

        this.logger.log(
          `Página ${pagina} procesada exitosamente. Lote de ${customers.length} registros.`,
        );

        return {
          totalItems: response.data.TotalItems ?? 0,
          totalPaginas: response.data.totalPaginas ?? 0,
          paginaActual: response.data.paginaActual ?? pagina,
          count: customers.length,
        };
      }
    } catch (error) {
      this.logger.error(`Error crítico en Página ${pagina}: ${error.message}`);
      if (error.response) {
        this.logger.error(
          `Respuesta API: ${JSON.stringify(error.response.data).substring(0, 200)}`,
        );
      }
      throw error;
    }
  }

  private generateInsertStatement(data: any): string {
    const escape = (val: any) => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    };

    return `INSERT INTO customers (id_contrato, nro_contrato, contrato_fisico, cedula, nombre, apellido, cliente, fecha_contrato, nombrestatus, saldo, suscripcion, monto_susc_int, monto_susc_tv, fecha_nacimiento, telefono, telf_casa, telf_adic, email, direccion_fiscal, nombre_g_a, nombre_estrato, etiqueta, id_franq, nombre_franq, tipo_fact, tipo_cliente, p_iva, det_tipo_servicio, det_suscripcion, deuda_internet, deuda_tv, last_sync) VALUES (${escape(data.id_contrato)}, ${escape(data.nro_contrato)}, ${escape(data.contrato_fisico)}, ${escape(data.cedula)}, ${escape(data.nombre)}, ${escape(data.apellido)}, ${escape(data.cliente)}, ${escape(data.fecha_contrato)}, ${escape(data.nombrestatus)}, ${parseFloat(data.saldo) || 0}, ${parseFloat(data.suscripcion) || 0}, ${parseFloat(data.monto_susc_int) || 0}, ${parseFloat(data.monto_susc_tv) || 0}, ${escape(data.fecha_nacimiento)}, ${escape(data.telefono)}, ${escape(data.telf_casa)}, ${escape(data.telf_adic)}, ${escape(data.email)}, ${escape(data.direccion_fiscal)}, ${escape(data.nombre_g_a)}, ${escape(data.nombre_estrato)}, ${escape(data.etiqueta)}, ${escape(data.id_franq)}, ${escape(data.nombre_franq)}, ${escape(data.tipo_fact)}, ${escape(data.tipo_cliente)}, ${parseFloat(data.p_iva) || 0}, ${escape(data.det_tipo_servicio)}, ${escape(data.det_suscripcion)}, ${parseFloat(data.deuda_internet) || 0}, ${parseFloat(data.deuda_tv) || 0}, toTimestamp(now()));\n`;
  }

  async syncByCedula(cedula: string, apiConnect: string) {
    this.logger.warn('syncByCedula deshabilitado durante migración masiva.');
    return [];
  }

  async syncDirectlyFromDB() {
    this.logger.log('--- INICIANDO MIGRACIÓN ULTRA-RÁPIDA (DIRECT PG DB) ---');
    const startTime = Date.now();
    let totalCount = 0;

    const client = new Client({
      host: process.env.HOST_SAE,
      user: process.env.USER_SAE,
      password: process.env.PASSWORD_SAE,
      database: process.env.DATABASE_SAE,
      port: 5432,
    });

    try {
      await client.connect();
      this.logger.log('Conexión con Postgres SAE establecida con éxito.');

      const sql = `
        SELECT 
            contrato.id_contrato,
            contrato.nro_contrato,
            contrato.contrato_fisico,
            persona.cedula,
            persona.nombre,
            persona.apellido,
            (persona.nombre || ' ' || persona.apellido) AS cliente,
            to_char(contrato.fecha_contrato, 'DD/MM/YYYY') as fecha_contrato,
            statuscont.nombrestatus,
            ROUND(contrato.saldo, 2) as saldo,
            -- Cálculos de Suscripción --
            ROUND((SELECT sum(cant_serv * costo_cobro * ((p_iva / 100)+1)) FROM contrato_servicio WHERE status_con_ser IN ('ACTIVO', 'SUSPENDIDO') AND contrato_servicio.id_contrato = contrato.id_contrato), 2) as suscripcion,
            ROUND((SELECT sum(cant_serv * costo_cobro * ((p_iva / 100)+1)) FROM contrato_servicio join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where status_con_ser IN ('SUSPENDIDO','ACTIVO') AND tipo_general='INTERNET' AND contrato_servicio.id_contrato = contrato.id_contrato), 2) as monto_susc_int,
            ROUND((SELECT sum(cant_serv * costo_cobro * ((p_iva / 100)+1)) FROM contrato_servicio join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where status_con_ser IN ('SUSPENDIDO','ACTIVO') AND tipo_general='TV' AND contrato_servicio.id_contrato = contrato.id_contrato), 2) as monto_susc_tv,
            to_char(persona.fecha_nac, 'DD/MM/YYYY') as fecha_nacimiento,
            persona.telefono,
            cliente.telf_casa,
            cliente.telf_adic,
            cliente.email,
            direccion.direccion_fiscal,
            grupo_afinidad.nombre_g_a,
            estrato_social.nombre_estrato,
            contrato.etiqueta,
            franquicia.id_franq,
            franquicia.nombre_franq,
            contrato.tipo_fact,
            cliente.tipo_cliente,
            -- Deudas y Agregaciones --
            (select sum( ((costo_cobro*cant_serv)*((p_iva/100)+1)) - pagado ) from pagos join contrato_servicio_deuda using(id_pago) join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where pagos.id_contrato=contrato.id_contrato and tipo_general='TV' )::numeric(20,2) as deuda_tv,
            (select sum( ((costo_cobro*cant_serv)*((p_iva/100)+1)) - pagado ) from pagos join contrato_servicio_deuda using(id_pago) join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where pagos.id_contrato=contrato.id_contrato and tipo_general='INTERNET' )::numeric(20,2) as deuda_internet,
            (SELECT array_to_string(array_agg(DISTINCT tipo_servicio), ', ') FROM contrato_servicio JOIN servicios using(id_serv) JOIN tipo_servicio using(id_tipo_servicio) WHERE contrato_servicio.id_contrato = contrato.id_contrato AND status_con_ser  IN ('ACTIVO',  'SUSPENDIDO')) AS det_tipo_servicio,
            (SELECT array_to_string(array_agg(DISTINCT nombre_servicio), ', ') FROM contrato_servicio JOIN servicios using(id_serv) WHERE contrato_servicio.id_contrato = contrato.id_contrato AND status_con_ser  IN ('ACTIVO',  'SUSPENDIDO')) AS det_suscripcion,
            (select distinct array_to_string(array_agg(p_iva),';') from contrato_servicio where status_con_ser IN ('ACTIVO',  'SUSPENDIDO') and contrato_servicio.id_contrato = contrato.id_contrato ) as p_iva
        FROM contrato
        JOIN cliente ON cliente.id_persona = contrato.cli_id_persona
        JOIN persona ON persona.id_persona = cliente.id_persona
        JOIN statuscont ON statuscont.status_contrato = contrato.status_contrato
        JOIN grupo_afinidad ON grupo_afinidad.id_g_a = contrato.id_g_a
        LEFT JOIN estrato_social ON estrato_social.id_estrato = contrato.id_estrato
        JOIN franquicia ON franquicia.id_franq = contrato.id_franq
        JOIN direccion ON direccion.id_direccion = contrato.id_direccion
        WHERE contrato.id_contrato <> '' AND contrato.nro_contrato != 0
        ORDER BY contrato.id_contrato ASC;
      `;

      const query = new QueryStream(sql);
      const stream = client.query(query);
      const batchSize = 100; // Agruparemos 100 registros por cada 'consulta' CQL

      return new Promise((resolve, reject) => {
        if (this.writeStream) {
          this.writeStream.write('BEGIN UNLOGGED BATCH;\n');
        }

        stream.on('data', (row) => {
          totalCount++;
          const statement = this.generateInsertStatement(row);
          if (this.writeStream) {
            this.writeStream.write(statement);
          }

          // Cerramos lote y abrimos uno nuevo cada batchSize
          if (totalCount % batchSize === 0) {
            if (this.writeStream) {
              this.writeStream.write('APPLY BATCH;\nBEGIN UNLOGGED BATCH;\n');
            }
          }

          if (totalCount % 10000 === 0) {
            const partialTime = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`>> [Postgres] Streaming: ${totalCount} registros procesados... [${partialTime}s]`);
          }
        });

        stream.on('end', async () => {
          // Cerramos el último lote abierto
          if (this.writeStream) {
            this.writeStream.write('APPLY BATCH;\n');
          }
          
          const finalTime = ((Date.now() - startTime) / 1000).toFixed(2);
          this.logger.log(`!!! MIGRACIÓN COMPLETA (POSTGRES + BATCHING) !!!`);
          this.logger.log(`Archivo CQL generado con éxito: ${totalCount} registros en ${finalTime}s.`);
          await client.end();
          resolve(totalCount);
        });

        stream.on('error', async (err) => {
          this.logger.error(`Error en streaming de Postgres: ${err.message}`);
          await client.end();
          reject(err);
        });
      });
    } catch (error) {
      this.logger.error(`Error crítico al conectar a Postgres: ${error.message}`);
      throw error;
    }
  }

  async resetSyncFile() {
    this.logger.warn(
      '(!) TRUNCANDO ARCHIVO CQL: Borrando todos los registros anteriores para reinicio limpio.',
    );
    if (this.writeStream) {
      this.writeStream.end();
    }
    fs.writeFileSync(this.migrationFile, 'USE sync_sae;\n\n');
    this.initializeStream();
  }
}
