import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CustomersSyncService {
  private readonly logger = new Logger(CustomersSyncService.name);
  private readonly migrationFile = path.join(process.cwd(), 'migration_high_performance.cql');

  constructor(
    private readonly http: HttpService,
  ) {
    if (!fs.existsSync(this.migrationFile)) {
      fs.writeFileSync(this.migrationFile, 'USE sync_sae;\n\n');
    }
  }

  async syncMassive(apiConnect: string, pagina = 0, nroRegistros = 2000) {
    const url = `https://api.saeplus.com/public/resources/contratos/ListadoAbonados?pagina=${pagina}&nro_registros=${nroRegistros}`;
    
    try {
      this.logger.log(`Solicitando Página ${pagina} (${nroRegistros} registros) con Auth Completa...`);
      
      const response = await lastValueFrom(
        this.http.get(url, { 
          headers: { 
            'Accept-Encoding': 'application/json', 
            'Accept': 'application/json', 
            'Api-Token': 'k942ah77bkkjnazh585myf3c3hj2svzgf3nqpyqdvvd72uag5s7t78ka8687zkh8cq6kcggxe5rm3tse8e2pybjhvh4fdcre6fqnxj3ydhrhj6usj299ny72pyrpjx3k', 
            'Api-Connect': 'conexven', 
            'Authorization': 'Basic QVBJQ09ORVhQRTpBMTIzNDU2', 
            'Cookie': 'XSRF-TOKEN=eyJpdiI6IlhVN090KzBmZkx5MTBSYzVIWVFFa1E9PSIsInZhbHVlIjoiYm4zTkpVQ3NqVkdrMmZFazhjcHlIalhWUkQ4SWhLUk9QYlpPWUJ5eDI1ZmROVWx2ZVZ5SzZXcmtQWHRJZ0U3WDYyUG5hQm50OEN4RUFwSzJndWtiYlE9PSIsIm1hYyI6IjQyNjExNDdiYjY4Mjc1OWIzNWY0NzE4MGI3ODJmZGQ1MGFlOTM1ZjE0ZDQ0NTU3MTI1NjU5YTg3ZjgwODY1ODUifQ%3D%3D; laravel_session=eyJpdiI6IkFWcDB5YzZFamh5XC9CUldaRTdNSTVRPT0iLCJ2YWx1ZSI6Imd0OURTMHVTT0pEaU5IRE5Dd1BmaHBhR0hCYVFjRFN5UG1WY24zXC90MmpLT2U0XC84Q0hDYXMzUzRmeXFROE5iZnk2RkJMaHVlT1poOHVQUlMwSEc2enc9PSIsIm1hYyI6ImJiZTllNWNmNDY5NWY5ZmQwZmMwNTU5OWY5NWE5NzMzMTVjMWIxZDZhYTRlZjNlYWNiMTEwZmMyNGM3YWIzNjkifQ%3D%3D'
          } 
        })
      );

      if (response.data?.message === 'Ok' || response.data?.data) {
        const customers = response.data.data;
        let cqlBuffer = '';
        
        for (const customer of customers) {
          cqlBuffer += this.generateInsertStatement(customer);
        }

        fs.appendFileSync(this.migrationFile, cqlBuffer);
        
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
}
