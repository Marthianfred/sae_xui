import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SyncClientSchema = z.object({
  cedula: z.string().min(5).max(20),
  force: z.boolean().optional().default(false),
});

export class SyncClientDto extends createZodDto(SyncClientSchema) {}

export const MassiveSyncSchema = z.object({
  limit: z.number().optional().default(100),
  offset: z.number().optional().default(0),
});

export class MassiveSyncDto extends createZodDto(MassiveSyncSchema) {}
