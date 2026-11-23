import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReorganizeHierarchyUseCase } from './reorganize-hierarchy.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('ReorganizeHierarchyUseCase', () => {
  let useCase: ReorganizeHierarchyUseCase;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      planning: {
        findFirst: vi.fn(),
      },
      planningBlock: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    useCase = new ReorganizeHierarchyUseCase(mockPrisma as unknown as PrismaService);
  });

  describe('Subdivisão Top-Down (MONTHLY -> WEEKLY)', () => {
    it('cria blocos semanais calculados dentro do intervalo do mês pai com parentId associado', async () => {
      const monthBlock = {
        id: 'month-1',
        planningId: 'plan-1',
        granularity: 'MONTHLY',
        order: 1,
        startAt: new Date('2026-08-01T00:00:00Z'),
        endAt: new Date('2026-08-31T23:59:59Z'),
        parentId: null,
      };

      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
        startAt: new Date('2026-08-01T00:00:00Z'),
        endAt: new Date('2026-08-31T23:59:59Z'),
        blocks: [monthBlock],
      });

      // Não há blocos semanais nem dias vinculados ainda
      mockPrisma.planningBlock.findFirst.mockResolvedValue(null);
      mockPrisma.planningBlock.findMany.mockResolvedValue([]);
      mockPrisma.planningBlock.create.mockImplementation((args: any) => ({
        id: `week-${args.data.order}`,
        ...args.data,
      }));

      await useCase.execute('session-1', {
        parentGranularity: 'MONTHLY',
        childGranularity: 'WEEKLY',
      });

      expect(mockPrisma.planningBlock.create).toHaveBeenCalled();
      const createCalls = mockPrisma.planningBlock.create.mock.calls;

      // Espera 5 semanas para o mês de Agosto de 2026
      expect(createCalls.length).toBe(5);

      // Todos os blocos semanais criados devem ter parentId = month-1 e granularidade WEEKLY
      for (const call of createCalls) {
        expect(call[0].data.planningId).toBe('plan-1');
        expect(call[0].data.parentId).toBe('month-1');
        expect(call[0].data.granularity).toBe('WEEKLY');
        expect(call[0].data.startAt).toBeDefined();
        expect(call[0].data.endAt).toBeDefined();
      }

      expect(createCalls[0][0].data.order).toBe(1);
      expect(createCalls[0][0].data.startAt.toISOString().slice(0, 10)).toBe('2026-08-03');
      expect(createCalls[0][0].data.endAt.toISOString().slice(0, 10)).toBe('2026-08-07');
    });

    it('completa semanas faltantes até 4 semanas quando o mês já possui apenas a Semana 1 cadastrada', async () => {
      const monthBlock = {
        id: 'month-1',
        planningId: 'plan-1',
        granularity: 'MONTHLY',
        order: 1,
        parentId: null,
      };

      const existingWeek1 = {
        id: 'week-1',
        planningId: 'plan-1',
        parentId: 'month-1',
        granularity: 'WEEKLY',
        order: 1,
      };

      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
        blocks: [monthBlock, existingWeek1],
      });

      // Simula que Semana 4 não existe (alreadySubdivided = false)
      mockPrisma.planningBlock.findFirst.mockImplementation((args: any) => {
        if (args.where.order === 1) return Promise.resolve(existingWeek1);
        return Promise.resolve(null);
      });
      mockPrisma.planningBlock.findMany.mockResolvedValue([]); // sem dias

      await useCase.execute('session-1', {
        parentGranularity: 'MONTHLY',
        childGranularity: 'WEEKLY',
      });

      // Deve criar Semanas 2, 3 e 4 (3 chamadas a create)
      expect(mockPrisma.planningBlock.create).toHaveBeenCalledTimes(3);
      const ordersCreated = mockPrisma.planningBlock.create.mock.calls.map((c: any) => c[0].data.order);
      expect(ordersCreated).toEqual([2, 3, 4]);
    });

    it('subdivide mês agrupando filhos diários existentes em semanas e reparentando-os', async () => {
      const monthBlock = {
        id: 'month-1',
        planningId: 'plan-1',
        granularity: 'MONTHLY',
        order: 1,
        startAt: new Date('2026-08-01T00:00:00Z'),
        endAt: new Date('2026-08-31T23:59:59Z'),
        parentId: null,
      };

      const daily1 = {
        id: 'd1',
        planningId: 'plan-1',
        parentId: 'month-1',
        granularity: 'DAILY',
        startAt: new Date('2026-08-03T12:00:00Z'),
        endAt: null,
        order: 1,
        metodologia: 'Aula 1',
      };
      const daily2 = {
        id: 'd2',
        planningId: 'plan-1',
        parentId: 'month-1',
        granularity: 'DAILY',
        startAt: new Date('2026-08-05T12:00:00Z'),
        endAt: null,
        order: 2,
        metodologia: 'Aula 2',
      };
      const daily3 = {
        id: 'd3',
        planningId: 'plan-1',
        parentId: 'month-1',
        granularity: 'DAILY',
        startAt: new Date('2026-08-10T12:00:00Z'),
        endAt: null,
        order: 3,
        metodologia: 'Aula 3 (próxima semana)',
      };

      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
        blocks: [monthBlock, daily1, daily2, daily3],
      });

      mockPrisma.planningBlock.findFirst.mockResolvedValue(null);
      mockPrisma.planningBlock.findMany.mockResolvedValue([daily1, daily2, daily3]);
      mockPrisma.planningBlock.create
        .mockResolvedValueOnce({ id: 'w1', parentId: 'month-1', granularity: 'WEEKLY' })
        .mockResolvedValueOnce({ id: 'w2', parentId: 'month-1', granularity: 'WEEKLY' });

      await useCase.execute('session-1', {
        parentGranularity: 'MONTHLY',
        childGranularity: 'WEEKLY',
      });

      expect(mockPrisma.planningBlock.create).toHaveBeenCalledTimes(2);

      // Semana 1 cobre d1 e d2
      expect(mockPrisma.planningBlock.create.mock.calls[0][0].data.parentId).toBe('month-1');
      expect(mockPrisma.planningBlock.create.mock.calls[0][0].data.granularity).toBe('WEEKLY');
      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2'] } },
        data: { parentId: 'w1' },
      });

      // Semana 2 cobre d3
      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d3'] } },
        data: { parentId: 'w2' },
      });
    });
  });

  describe('Agrupamento Bottom-Up (DAILY -> WEEKLY)', () => {
    it('agrupa blocos diários soltos em blocos semanais reais de calendário', async () => {
      const dailyBlocks = [
        { id: 'd1', granularity: 'DAILY', startAt: new Date('2026-08-03T12:00:00Z'), endAt: null, order: 1, parentId: null },
        { id: 'd2', granularity: 'DAILY', startAt: new Date('2026-08-04T12:00:00Z'), endAt: null, order: 2, parentId: null },
        { id: 'd3', granularity: 'DAILY', startAt: new Date('2026-08-07T12:00:00Z'), endAt: null, order: 3, parentId: null },
        { id: 'd4', granularity: 'DAILY', startAt: new Date('2026-08-10T12:00:00Z'), endAt: null, order: 4, parentId: null },
        { id: 'd5', granularity: 'DAILY', startAt: new Date('2026-08-11T12:00:00Z'), endAt: null, order: 5, parentId: null },
      ];

      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
        blocks: dailyBlocks,
      });

      mockPrisma.planningBlock.create
        .mockResolvedValueOnce({ id: 'w1', granularity: 'WEEKLY' })
        .mockResolvedValueOnce({ id: 'w2', granularity: 'WEEKLY' });

      await useCase.execute('session-1', {
        parentGranularity: 'WEEKLY',
        childGranularity: 'DAILY',
      });

      expect(mockPrisma.planningBlock.create).toHaveBeenCalledTimes(2);

      // Semana 1
      const callW1 = mockPrisma.planningBlock.create.mock.calls[0][0].data;
      expect(callW1.granularity).toBe('WEEKLY');
      expect(callW1.parentId).toBeNull();
      expect(callW1.startAt.toISOString().slice(0, 10)).toBe('2026-08-03');
      expect(callW1.endAt.toISOString().slice(0, 10)).toBe('2026-08-07');
      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2', 'd3'] } },
        data: { parentId: 'w1' },
      });

      // Semana 2
      const callW2 = mockPrisma.planningBlock.create.mock.calls[1][0].data;
      expect(callW2.granularity).toBe('WEEKLY');
      expect(callW2.startAt.toISOString().slice(0, 10)).toBe('2026-08-10');
      expect(callW2.endAt.toISOString().slice(0, 10)).toBe('2026-08-14');
      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d4', 'd5'] } },
        data: { parentId: 'w2' },
      });
    });

    it('herda o parentId do mês pai se os blocos diários já possuíam vínculo', async () => {
      const dailyBlocks = [
        { id: 'd1', granularity: 'DAILY', startAt: new Date('2026-08-03T12:00:00Z'), endAt: null, order: 1, parentId: 'month-1' },
        { id: 'd2', granularity: 'DAILY', startAt: new Date('2026-08-05T12:00:00Z'), endAt: null, order: 2, parentId: 'month-1' },
      ];

      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
        blocks: dailyBlocks,
      });

      mockPrisma.planningBlock.create.mockResolvedValueOnce({ id: 'w1' });

      await useCase.execute('session-1', {
        parentGranularity: 'WEEKLY',
        childGranularity: 'DAILY',
      });

      expect(mockPrisma.planningBlock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          granularity: 'WEEKLY',
          parentId: 'month-1', // herdou do mês!
        }),
      });

      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2'] } },
        data: { parentId: 'w1' },
      });
    });

    it('faz agrupamento em blocos de 5 quando os dias não possuem startAt cadastrado', async () => {
      const dailyBlocks = Array.from({ length: 7 }, (_, i) => ({
        id: `d-${i + 1}`,
        granularity: 'DAILY',
        startAt: null,
        endAt: null,
        order: i + 1,
        parentId: null,
      }));

      mockPrisma.planning.findFirst.mockResolvedValue({
        id: 'plan-1',
        sessionId: 'session-1',
        blocks: dailyBlocks,
      });

      mockPrisma.planningBlock.create
        .mockResolvedValueOnce({ id: 'w1' })
        .mockResolvedValueOnce({ id: 'w2' });

      await useCase.execute('session-1', {
        parentGranularity: 'WEEKLY',
        childGranularity: 'DAILY',
      });

      expect(mockPrisma.planningBlock.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d-1', 'd-2', 'd-3', 'd-4', 'd-5'] } },
        data: { parentId: 'w1' },
      });
      expect(mockPrisma.planningBlock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d-6', 'd-7'] } },
        data: { parentId: 'w2' },
      });
    });
  });
});
