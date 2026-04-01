import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class CustomersQueryService {
  private readonly logger = new Logger(CustomersQueryService.name);

  private getPool() {
    return new Pool({
      host: process.env.HOST_SAE || '34.172.246.50',
      port: 5432,
      user: process.env.USER_SAE || 'user_read_fh',
      password: process.env.PASSWORD_SAE || '81-W8k*4oI/A9j',
      database: process.env.DATABASE_SAE || 'saeplus_conexven',
      ssl: { rejectUnauthorized: false },
    });
  }

  async findAll(query: {
    desde?: string;
    hasta?: string;
    status_contrato?: string;
    nro_contrato?: string;
    cedula?: string;
    pagina?: number;
    nro_registros?: number;
  }) {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      const rowsPerPage = Number(query.nro_registros) || 1000;
      const pagina = Number(query.pagina) || 0;
      const offset = pagina * rowsPerPage;

      let where = "contrato.id_contrato <> '' ";
      const params: any[] = [];

      if (query.desde && query.hasta) {
        where += ` AND contrato.fecha_contrato::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(query.desde, query.hasta);
      }

      if (query.status_contrato) {
        where += ` AND contrato.status_contrato = $${params.length + 1}`;
        params.push(query.status_contrato.toUpperCase());
      }

      if (query.cedula) {
        where += ` AND persona.cedula = $${params.length + 1}`;
        params.push(query.cedula);
      }

      if (query.nro_contrato) {
        where += ` AND contrato.nro_contrato = $${params.length + 1}`;
        params.push(query.nro_contrato);
      }

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
          to_char( (SELECT MAX(fecha_dep) FROM pagos join pagodeposito on pagodeposito.id_pago=pagos.id_pago WHERE pagos.id_contrato=contrato.id_contrato AND status_pago = 'PAGADO' AND tipo_doc='PAGO' ), 'DD/mm/yyyy') as ult_pago_dep,
          to_char( (SELECT MAX(fecha_pago) FROM pagos WHERE pagos.id_contrato=contrato.id_contrato AND status_pago = 'PAGADO' AND tipo_doc='PAGO' ), 'DD/mm/yyyy') as ult_pago,
          to_char( (SELECT MAX(fecha_inst) FROM pagos,pago_factura,contrato_servicio_deuda WHERE pagos.id_pago=pago_factura.id_pago and pago_factura.id_cont_serv=contrato_servicio_deuda.id_cont_serv and pagos.id_contrato=contrato.id_contrato AND status_pago = 'PAGADO' AND tipo_doc='PAGO' ), 'mm/yyyy') as ult_mes_pago,
          to_char( (SELECT MAX(fecha_pago) FROM pagos WHERE pagos.id_contrato=contrato.id_contrato AND tipo_doc='FACTURA' ), 'DD/mm/yyyy') as ult_factura,
          to_char( (SELECT MAX(fecha_inst) FROM pagos JOIN contrato_servicio_deuda USING (ID_PAGO) WHERE pagos.id_contrato=contrato.id_contrato AND tipo_doc='FACTURA' ), 'mm/yyyy') as ult_mes_factura,
          franquicia.id_franq,
          franquicia.nombre_franq,
          contrato.tipo_fact,
          cliente.tipo_cliente,
          contrato.observacion,
          (select distinct array_to_string(array_agg(p_iva),';') from contrato_servicio where status_con_ser IN ('ACTIVO', 'SUSPENDIDO') and contrato_servicio.id_contrato = contrato.id_contrato ) as p_iva,
          (SELECT array_to_string(array_agg(DISTINCT tipo_servicio), ', ') FROM contrato_servicio JOIN servicios using(id_serv) JOIN tipo_servicio using(id_tipo_servicio) WHERE contrato_servicio.id_contrato = contrato.id_contrato AND status_con_ser IN ('ACTIVO', 'SUSPENDIDO')) AS det_tipo_servicio,
          (SELECT array_to_string(array_agg(DISTINCT nombre_servicio), ', ') FROM contrato_servicio JOIN servicios using(id_serv) WHERE contrato_servicio.id_contrato = contrato.id_contrato AND status_con_ser IN ('ACTIVO', 'SUSPENDIDO')) AS det_suscripcion,
          (SELECT array_to_string(array_agg(DISTINCT nombre_servicio), ', ') FROM contrato_servicio JOIN servicios using(id_serv) WHERE contrato_servicio.id_contrato = contrato.id_contrato AND status_con_ser IN ('ACTIVO')) AS det_suscripcion_act,
          (SELECT array_to_string(array_agg(DISTINCT nombre_servicio), ', ') FROM contrato_servicio JOIN servicios using(id_serv) WHERE contrato_servicio.id_contrato = contrato.id_contrato AND status_con_ser IN ('SUSPENDIDO')) AS det_suscripcion_susp,
          ROUND((SELECT sum(cant_serv * costo_cobro * ((p_iva / 100)+1)) FROM contrato_servicio WHERE status_con_ser IN ('ACTIVO') AND contrato_servicio.id_contrato = contrato.id_contrato), 2) as suscripcion_act,
          ROUND((SELECT sum(cant_serv * costo_cobro * ((p_iva / 100)+1)) FROM contrato_servicio WHERE status_con_ser IN ('SUSPENDIDO') AND contrato_servicio.id_contrato = contrato.id_contrato), 2) as suscripcion_sup,
          (select sum( ((costo_cobro*cant_serv)*((p_iva/100)+1)) - pagado ) from pagos join contrato_servicio_deuda using(id_pago) join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where pagos.id_contrato=contrato.id_contrato and tipo_general='TV' )::numeric(20,2) as deuda_tv,
          (select sum( ((costo_cobro*cant_serv)*((p_iva/100)+1)) - pagado ) from pagos join contrato_servicio_deuda using(id_pago) join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where pagos.id_contrato=contrato.id_contrato and tipo_general='INTERNET' )::numeric(20,2) as deuda_internet,
          (SELECT array_to_string(array_agg(DISTINCT nombre_servicio), ', ') FROM contrato_servicio join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where status_con_ser IN ('SUSPENDIDO','ACTIVO') AND tipo_general='TV' AND contrato_servicio.id_contrato = contrato.id_contrato ) AS det_susc_tv,
          (SELECT array_to_string(array_agg(DISTINCT nombre_servicio), ', ') FROM contrato_servicio join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where status_con_ser IN ('SUSPENDIDO','ACTIVO') AND tipo_general='INTERNET' AND contrato_servicio.id_contrato = contrato.id_contrato) AS det_susc_int,
          (SELECT array_to_string(array_agg(DISTINCT status_con_ser), ', ') FROM contrato_servicio join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where status_con_ser IN ('SUSPENDIDO','ACTIVO') AND tipo_general='TV' AND contrato_servicio.id_contrato = contrato.id_contrato ) AS status_susc_tv,
          (SELECT array_to_string(array_agg(DISTINCT status_con_ser), ', ') FROM contrato_servicio join servicios using(id_serv) join tipo_servicio using(id_tipo_servicio) where status_con_ser IN ('SUSPENDIDO','ACTIVO') AND tipo_general='INTERNET' AND contrato_servicio.id_contrato = contrato.id_contrato ) AS status_susc_int,
          (SELECT count(*) FROM pagos WHERE pagos.id_contrato=contrato.id_contrato AND status_pago = 'PAGADO' AND tipo_doc='PAGO' ) as cant_pagos,
          (SELECT count(*) FROM pagos WHERE pagos.id_contrato=contrato.id_contrato AND tipo_doc='FACTURA' ) as cant_facturas,
          (SELECT count(*) FROM pagos WHERE pagos.id_contrato=contrato.id_contrato AND tipo_doc='NOTA CREDITO' ) as cant_nota_credito,
          (SELECT count(*) FROM pagos WHERE pagos.id_contrato=contrato.id_contrato AND tipo_doc='NOTA DEBITO' ) as cant_nota_debito,
          (SELECT count(*) as id FROM convenio WHERE convenio.id_contrato=contrato.id_contrato ) as cant_convenio,
          (SELECT count(*) as id FROM equipo_sistema WHERE equipo_sistema.id_contrato=contrato.id_contrato ) as cant_equipo
        FROM contrato
        JOIN cliente ON cliente.id_persona = contrato.cli_id_persona
        JOIN persona ON persona.id_persona = cliente.id_persona
        JOIN statuscont ON statuscont.status_contrato = contrato.status_contrato
        JOIN grupo_afinidad ON grupo_afinidad.id_g_a = contrato.id_g_a
        LEFT JOIN estrato_social ON estrato_social.id_estrato = contrato.id_estrato
        JOIN franquicia ON franquicia.id_franq = contrato.id_franq
        JOIN grupo_franq ON grupo_franq.id_gf = franquicia.id_gf
        JOIN direccion ON direccion.id_direccion = contrato.id_direccion
        WHERE ${where}
        OFFSET ${offset}
        LIMIT ${rowsPerPage}
      `;

      const dataResult = await client.query(sql, params);

      const countSql = `
        SELECT count(*) as cantidad 
        FROM contrato
        JOIN cliente ON cliente.id_persona = contrato.cli_id_persona
        JOIN persona ON persona.id_persona = cliente.id_persona
        JOIN statuscont ON statuscont.status_contrato = contrato.status_contrato
        JOIN grupo_afinidad ON grupo_afinidad.id_g_a = contrato.id_g_a
        LEFT JOIN estrato_social ON estrato_social.id_estrato = contrato.id_estrato
        JOIN franquicia ON franquicia.id_franq = contrato.id_franq
        JOIN grupo_franq ON grupo_franq.id_gf = franquicia.id_gf
        JOIN direccion ON direccion.id_direccion = contrato.id_direccion
        WHERE ${where}
      `;

      const countResult = await client.query(countSql, params);
      const totalItems = parseInt(countResult.rows[0].cantidad);

      return {
        message: 'Ok',
        data: dataResult.rows,
        status: 200,
        TotalItems: totalItems,
        totalPaginas: Math.ceil(totalItems / rowsPerPage),
        paginaActual: pagina,
      };
    } catch (error) {
      console.log('❌ ERROR POSTGRES SAE:', error.message);
      return {
        message: 'Error en la consulta de SAE',
        error: error.message,
        status: 500,
      };
    } finally {
      client.release();
      await pool.end();
    }
  }
}
