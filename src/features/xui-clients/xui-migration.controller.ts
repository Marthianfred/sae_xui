import { Controller, Post, Get, Res, Query, HttpStatus } from '@nestjs/common';
import { XuiClientsService } from './xui-clients.service';
import type { Response } from 'express';
import * as path from 'path';

@Controller('xui-clients/migration')
export class XuiMigrationController {
  constructor(private readonly xuiClientsService: XuiClientsService) {}

  /**
   * Dispara la migración masiva desde los archivos CQL
   * POST /xui-clients/migration/start
   */
  @Post('start')
  startMigration() {
    const chunksDir = path.join(process.cwd(), 'migration_timeline');
    return this.xuiClientsService.startMassiveMigration(chunksDir);
  }

  /**
   * Consulta el progreso de la migración
   * GET /xui-clients/migration/status
   */
  @Get('status')
  getStatus() {
    return this.xuiClientsService.getMigrationStatus();
  }

  /**
   * Descarga el reporte detallado en CSV
   * GET /xui-clients/migration/report
   */
  @Get('report')
  downloadReport(@Res() res: Response) {
    const filePath = this.xuiClientsService.getReportPath();
    
    // Verificar si el archivo existe antes de enviarlo
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=migration_report.csv');
      return res.sendFile(filePath);
    } else {
      return res.status(HttpStatus.NOT_FOUND).json({
        message: 'Report file not found. Ensure migration has started.'
      });
    }
  }
}
