import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call $connect on onModuleInit', async () => {
    const connectSpy = vi
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as never);
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('should call $disconnect on onModuleDestroy', async () => {
    const disconnectSpy = vi
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined as never);
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
