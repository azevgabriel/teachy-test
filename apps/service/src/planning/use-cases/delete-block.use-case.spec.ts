import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteBlockUseCase } from './delete-block.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('DeleteBlockUseCase', () => {
  let useCase: DeleteBlockUseCase;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      planning: {
        findFirst: vi.fn(),
      },
      planningBlock: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    useCase = new DeleteBlockUseCase(mockPrisma as unknown as PrismaService);
  });

  describe('Remoção de Camada Inteira de Granularidade', () => {
    it('remove todos os blocos de uma granularidade quando apenas granularity for informada', async () => {
      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
      });

      mockPrisma.planningBlock.findMany.mockResolvedValue([
        { id: 'd1', granularity: 'DAILY', parentId: 'w1', children: [] },
        { id: 'd2', granularity: 'DAILY', parentId: 'w1', children: [] },
        { id: 'd3', granularity: 'DAILY', parentId: 'w2', children: [] },
      ]);

      mockPrisma.planningBlock.deleteMany.mockResolvedValue({ count: 3 });

      const result = await useCase.execute('session-1', {
        granularity: 'DAILY',
      });

      expect(mockPrisma.planningBlock.findMany).toHaveBeenCalledWith({
        where: {
          planningId: 'plan-1',
          granularity: 'DAILY',
        },
        include: {
          children: true,
        },
      });

      expect(mockPrisma.planningBlock.deleteMany).toHaveBeenCalledWith({
        where: {
          planningId: 'plan-1',
          granularity: 'DAILY',
        },
      });

      expect(result).toEqual({
        deletedCount: 3,
        granularity: 'DAILY',
      });
    });

    it('reparenta filhos para o avô ao remover uma camada intermediária (ex: WEEKLY) evitando deleção em cascata indesejada', async () => {
      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
      });

      mockPrisma.planningBlock.findMany.mockResolvedValue([
        {
          id: 'w1',
          granularity: 'WEEKLY',
          parentId: 'm1',
          children: [{ id: 'd1' }, { id: 'd2' }],
        },
      ]);

      mockPrisma.planningBlock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await useCase.execute('session-1', {
        granularity: 'WEEKLY',
      });

      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { parentId: 'w1' },
        data: { parentId: 'm1' },
      });

      expect(mockPrisma.planningBlock.deleteMany).toHaveBeenCalledWith({
        where: {
          planningId: 'plan-1',
          granularity: 'WEEKLY',
        },
      });

      expect(result).toEqual({
        deletedCount: 1,
        granularity: 'WEEKLY',
      });
    });

    it('retorna null se nenhum bloco da granularidade for encontrado', async () => {
      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
      });

      mockPrisma.planningBlock.findMany.mockResolvedValue([]);

      const result = await useCase.execute('session-1', {
        granularity: 'DAILY',
      });

      expect(result).toBeNull();
      expect(mockPrisma.planningBlock.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Exclusão Pontual de Bloco', () => {
    it('deleta bloco por blockId', async () => {
      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
      });

      mockPrisma.planningBlock.findFirst.mockResolvedValue({
        id: 'b-123',
        planningId: 'plan-1',
        startAt: new Date('2026-08-03T12:00:00Z'),
      });

      const result = await useCase.execute('session-1', {
        blockId: 'b-123',
      });

      expect(mockPrisma.planningBlock.delete).toHaveBeenCalledWith({
        where: { id: 'b-123' },
      });

      expect(result?.deletedBlockId).toBe('b-123');
    });

    it('deleta bloco por date', async () => {
      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
      });

      mockPrisma.planningBlock.findFirst.mockResolvedValue({
        id: 'b-date',
        planningId: 'plan-1',
        startAt: new Date('2026-08-03T00:00:00Z'),
      });

      const result = await useCase.execute('session-1', {
        date: '2026-08-03',
      });

      expect(mockPrisma.planningBlock.delete).toHaveBeenCalledWith({
        where: { id: 'b-date' },
      });

      expect(result?.deletedBlockId).toBe('b-date');
    });
  });
});
