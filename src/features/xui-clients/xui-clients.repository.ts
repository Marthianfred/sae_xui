import { Injectable, Logger } from '@nestjs/common';
import { XuiDbService } from '../../common/xuidb/xuidb.service';

@Injectable()
export class XuiClientsRepository {
  private readonly logger = new Logger(XuiClientsRepository.name);

  constructor(private readonly xuiDbService: XuiDbService) {}

  /**
   * Busca un cliente directamente en la base de datos de XUI
   */
  async findInXuiByContract(nroContrato: string) {
    return this.xuiDbService.findByContract(nroContrato);
  }
}
