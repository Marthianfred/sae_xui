import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CustomersSyncService {
  private readonly logger = new Logger(CustomersSyncService.name);
  private readonly migrationFile = path.join(process.cwd(), 'migration_high_performance.cql');
  private writeStream: fs.WriteStream | null = null;

  constructor(
    private readonly http: HttpService,
  ) {
    this.initializeStream();
  }

  private initializeStream() {
    if (!fs.existsSync(this.migrationFile)) {
      fs.writeFileSync(this.migrationFile, 'USE sync_sae;\n\n');
    }
    this.writeStream = fs.createWriteStream(this.migrationFile, { flags: 'a' });
  }

  async syncMassive(apiConnect: string, pagina = 0, nroRegistros = 2000, desde?: string, hasta?: string) {
    let url = `https://api.saeplus.com/public/resources/contratos/ListadoAbonados?pagina=${pagina}&nro_registros=${nroRegistros}`;
    
    if (desde) url += `&desde=${desde}`;
    if (hasta) url += `&hasta=${hasta}`;
    
    try {
      this.logger.log(`Solicitando Página ${pagina} (${nroRegistros} registros) con Auth Completa...`);
      const apiStartTime = Date.now();
      
      const response = await lastValueFrom(
        this.http.get(url, { 
          headers: { 
            'Accept-Encoding': 'application/json', 
            'Accept': 'application/json', 
            'Api-Token': process.env.SAE_TOKEN, 
            'Api-Connect': process.env.SAE_CONNECT || apiConnect, 
            'Authorization': process.env.SAE_AUTH, 
            'Cookie': process.env.SAE_COOKIE
          } 
        })
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
        this.logger.debug(`Escritura en disco completada en ${writeDuration.toFixed(3)}s`);
        
        this.logger.log(`Página ${pagina} procesada exitosamente. Lote de ${customers.length} registros.`);
        
        return {
          totalItems: response.data.TotalItems || 711523,
          totalPaginas: response.data.totalPaginas || 711,
          paginaActual: response.data.paginaActual || pagina,
          count: customers.length
        };
      }
    } catch (error) {
      this.logger.error(`Error crítico en Página ${pagina}: ${error.message}`);
      if (error.response) {
        this.logger.error(`Respuesta API: ${JSON.stringify(error.response.data).substring(0, 200)}`);
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

  async resetSyncFile() {
    this.logger.warn('(!) TRUNCANDO ARCHIVO CQL: Borrando todos los registros anteriores para reinicio limpio.');
    if (this.writeStream) {
      this.writeStream.end();
    }
    fs.writeFileSync(this.migrationFile, 'USE sync_sae;\n\n');
    this.initializeStream();
  }
}


