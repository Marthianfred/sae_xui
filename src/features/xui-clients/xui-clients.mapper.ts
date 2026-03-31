import { Injectable } from '@nestjs/common';
import { XuiClientData } from './interfaces/xui-api.interface';

@Injectable()
export class XuiClientsMapper {
  /**
   * Formatea un MAC address crudo a XX:XX:XX:XX:XX:XX
   */
  formatMac(rawMac: string): string {
    const clean = rawMac.replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length !== 12) return clean;
    const matches = clean.match(/.{1,2}/g);
    return matches ? matches.join(':').toUpperCase() : clean;
  }

  /**
   * Identifica si un cliente o plan pertenece a WAVE
   */
  isWave(saeCustomer: any): boolean {
    const region = (saeCustomer.nombre_franq || '').toUpperCase();
    const contract = (saeCustomer.nro_contrato || '').toUpperCase();
    const plan = (saeCustomer.det_suscripcion || '').toUpperCase();
    const email = (saeCustomer.email || '').toUpperCase();

    return region.includes('WAVE') || 
           contract.startsWith('WV') || 
           plan.includes('WAVE') || 
           email.includes('@WAVE');
  }

  /**
   * Normaliza el nombre de la franquicia/región para XUI
   */
  normalizeRegion(rawRegion: string): string | null {
    if (!rawRegion) return '';
    
    let region = rawRegion.toUpperCase();
    
    // Si es WAVE, lo ignoramos por completo
    if (region.includes('WAVE')) return null;
    
    // Reglas Especiales
    if (region.includes('PTO CABELLO') && region.includes('MORON')) return 'PTO CABELLO';
    if (region === 'FIBEX MORON') return 'MORON';
    
    // Limpieza General
    region = region.replace('FIBEX', '').trim();
    region = region.replace(/[\/\.\-]/g, ' '); // Eliminar / . -
    region = region.replace(/\s+/g, ' ').trim(); // Colapsar espacios
    
    // Caso especial Barcelona / Pto La Cruz
    if (region.includes('BARCELONA') && region.includes('PTO LA CRUZ')) return 'PTO LA CRUZ';
    
    return region;
  }

  /**
   * Mapea el texto del plan de SAE a los IDs de bouquets de XUI
   */
  mapBouquets(saePlan: string): number[] {
    if (!saePlan) return [1]; // Por defecto Home
    
    const plan = saePlan.toUpperCase();
    
    // Si es WAVE, retornamos vacío o un flag para ignorar
    if (plan.includes('WAVE')) return [];

    // Reglas de Prioridad
    if (plan.includes('PREMIUM')) return [5];
    if (plan.includes('FULL') || plan.includes('163 CANALES')) return [3];
    if (plan.includes('PLUS') || plan.includes('FTTH_600')) return [2];

    return [1]; // Default Home
  }

  /**
   * Mapea un cliente de SAE a la estructura de XUI (Basado en nro_contrato como admin_notes)
   */
  toXuiClient(saeCustomer: any): XuiClientData | null {
    // Exclusión total de WAVE
    if (this.isWave(saeCustomer)) return null;

    const bouquetIds = this.mapBouquets(saeCustomer.det_suscripcion);
    const region = this.normalizeRegion(saeCustomer.nombre_franq);

    // Determinar conexiones basado en el bouquet (Plan)
    let connections = 2; // Default Home (ID 1)
    if (bouquetIds.includes(3)) connections = 4; // Full (ID 3)
    if (bouquetIds.includes(5)) connections = 4; // Premium (ID 5)
    if (bouquetIds.includes(2)) connections = 3; // Plus (ID 2)
    
    return {
      username: saeCustomer.cedula,
      password: `${saeCustomer.cedula}10`, // Patrón observado en el panel
      bouquets_selected: bouquetIds,
      notes: saeCustomer.nro_contrato, // Guardamos el contrato corto (C52947) para búsqueda rápida
      reseller_notes: region || undefined,
      email: saeCustomer.email,
      phone: saeCustomer.telef_casa || saeCustomer.telefono,
      max_connections: connections,
    };
  }
}
