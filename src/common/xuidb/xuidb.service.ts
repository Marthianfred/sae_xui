import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';

@Injectable()
export class XuiDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XuiDbService.name);
  private pool: mysql.Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.pool = mysql.createPool({
      host: this.configService.get<string>('XUI_DB_HOST'),
      port: this.configService.get<number>('XUI_DB_PORT') || 3306,
      user: this.configService.get<string>('XUI_DB_USER'),
      password: this.configService.get<string>('XUI_DB_PASS'),
      database: this.configService.get<string>('XUI_DB_NAME'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Conexión a base de datos XUI MySQL exitosa');
    } catch (error) {
      this.logger.error(`Error al conectar con la base de datos XUI: ${error.message}`);
      this.logger.error(`Configuración Host: ${this.configService.get('XUI_DB_HOST') || 'NO DEFINIDO'}`);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Ejecuta una consulta SQL en la base de datos XUI
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as any as T[];
  }

  /**
   * Busca un usuario por admin_notes (Contrato)
   */
  async findByContract(contractId: string): Promise<any | null> {
    const sql = 'SELECT * FROM `lines` WHERE admin_notes = ? LIMIT 1';
    const rows = await this.query(sql, [contractId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Busca un usuario por username (Cédula)
   */
  async findByUsername(username: string): Promise<any | null> {
    const sql = 'SELECT * FROM `lines` WHERE username = ? LIMIT 1';
    const rows = await this.query(sql, [username]);
    return rows.length > 0 ? rows[0] : null;
  }
}
