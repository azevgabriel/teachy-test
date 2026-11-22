import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlanningService } from './planning.service.js';
import {
  UpsertPlanningUseCase,
  SwapBlockByDateUseCase,
  BatchUpdateColumnUseCase,
  AddSpecificationWithSlotsUseCase,
  FillPlanningMetadataUseCase,
  DeleteBlockUseCase,
  ReorganizeHierarchyUseCase,
  ResetPlanningUseCase,
} from './use-cases/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('PlanningService', () => {
  let planningService: PlanningService;
  let prismaMock: any;
  let upsertPlanningUseCase: UpsertPlanningUseCase;
  let swapBlockByDateUseCase: SwapBlockByDateUseCase;
  let batchUpdateColumnUseCase: BatchUpdateColumnUseCase;
  let addSpecificationWithSlotsUseCase: AddSpecificationWithSlotsUseCase;
  let fillPlanningMetadataUseCase: FillPlanningMetadataUseCase;
  let deleteBlockUseCase: DeleteBlockUseCase;
  let reorganizeHierarchyUseCase: ReorganizeHierarchyUseCase;
  let resetPlanningUseCase: ResetPlanningUseCase;
  let upsertSpy: any;
  let swapSpy: any;
  let batchSpy: any;
  let addSpecSpy: any;
  let resetSpy: any;

  beforeEach(() => {
    prismaMock = {
      planning: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      specification: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      planningBlock: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      learningObjective: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      evaluation: {
        create: vi.fn(),
      },
      planningMetadataValue: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      school: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      applicationYear: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'year-1', name: '3º ano do Ensino Fundamental I' },
        ]),
      },
      curricularComponent: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'comp-1', name: 'Matemática' },
        ]),
      },
      bnccSkill: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'skill-1', code: 'EF03MA01', description: 'Ler e escrever números' },
        ]),
      },
    };

    upsertPlanningUseCase = new UpsertPlanningUseCase(prismaMock as unknown as PrismaService);
    swapBlockByDateUseCase = new SwapBlockByDateUseCase(prismaMock as unknown as PrismaService);
    batchUpdateColumnUseCase = new BatchUpdateColumnUseCase(prismaMock as unknown as PrismaService);
    addSpecificationWithSlotsUseCase = new AddSpecificationWithSlotsUseCase(prismaMock as unknown as PrismaService);
    fillPlanningMetadataUseCase = new FillPlanningMetadataUseCase(prismaMock as unknown as PrismaService);
    deleteBlockUseCase = new DeleteBlockUseCase(prismaMock as unknown as PrismaService);
    reorganizeHierarchyUseCase = new ReorganizeHierarchyUseCase(prismaMock as unknown as PrismaService);
    resetPlanningUseCase = new ResetPlanningUseCase(prismaMock as unknown as PrismaService);

    upsertSpy = vi.spyOn(upsertPlanningUseCase, 'execute').mockResolvedValue({ id: 'p1' } as any);
    swapSpy = vi.spyOn(swapBlockByDateUseCase, 'execute').mockResolvedValue({ id: 'b1' } as any);
    batchSpy = vi.spyOn(batchUpdateColumnUseCase, 'execute').mockResolvedValue(undefined);
    addSpecSpy = vi.spyOn(addSpecificationWithSlotsUseCase, 'execute').mockResolvedValue({ id: 's1' } as any);
    vi.spyOn(fillPlanningMetadataUseCase, 'execute').mockResolvedValue(undefined);
    vi.spyOn(deleteBlockUseCase, 'execute').mockResolvedValue({ deletedBlockId: 'b1', gapDate: null });
    vi.spyOn(reorganizeHierarchyUseCase, 'execute').mockResolvedValue(undefined);
    resetSpy = vi.spyOn(resetPlanningUseCase, 'execute').mockResolvedValue(undefined);

    planningService = new PlanningService(
      prismaMock as unknown as PrismaService,
      upsertPlanningUseCase,
      swapBlockByDateUseCase,
      batchUpdateColumnUseCase,
      addSpecificationWithSlotsUseCase,
      fillPlanningMetadataUseCase,
      deleteBlockUseCase,
      reorganizeHierarchyUseCase,
      resetPlanningUseCase,
    );
  });

  describe('applyPatch dispatching', () => {
    it('dispatches UPSERT_PLANNING to UpsertPlanningUseCase', async () => {
      const payload = {
        operation: 'UPSERT_PLANNING' as const,
        data: {
          granularity: 'MONTHLY' as const,
          curricularComponentNames: ['Matemática'],
        },
      };

      await planningService.applyPatch('s1', payload);
      expect(upsertSpy).toHaveBeenCalledWith('s1', payload.data);
    });

    it('dispatches UPDATE_BLOCK_BY_DATE to SwapBlockByDateUseCase', async () => {
      const payload = {
        operation: 'UPDATE_BLOCK_BY_DATE' as const,
        data: { date: '2026-03-02', metodologia: 'Aula prática' },
      };

      await planningService.applyPatch('s1', payload);
      expect(swapSpy).toHaveBeenCalledWith('s1', payload.data);
    });

    it('dispatches BATCH_UPDATE_COLUMN to BatchUpdateColumnUseCase', async () => {
      const payload = {
        operation: 'BATCH_UPDATE_COLUMN' as const,
        data: { granularity: 'WEEKLY' as const, colName: 'metodologia', content: 'Texto' },
      };

      await planningService.applyPatch('s1', payload);
      expect(batchSpy).toHaveBeenCalledWith('s1', payload.data);
    });

    it('dispatches ADD_SPECIFICATION to AddSpecificationWithSlotsUseCase', async () => {
      const payload = {
        operation: 'ADD_SPECIFICATION' as const,
        data: { colName: 'recursos', tableRef: 'PLANNING_BLOCK' as const, isRequired: true },
      };

      await planningService.applyPatch('s1', payload);
      expect(addSpecSpy).toHaveBeenCalledWith('s1', payload.data);
    });

    it('dispatches RESET_PLANNING to ResetPlanningUseCase', async () => {
      const payload = {
        operation: 'RESET_PLANNING' as const,
        data: {},
      };

      await planningService.applyPatch('s1', payload);
      expect(resetSpy).toHaveBeenCalledWith('s1');
    });

    it('does not trigger use cases for READ_ONLY', async () => {
      const payload = {
        operation: 'READ_ONLY' as const,
        data: { queryType: 'COUNT' },
      };

      await planningService.applyPatch('s1', payload);
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(resetSpy).not.toHaveBeenCalled();
    });
  });

  describe('getPlanningBySessionId', () => {
    it('returns planning aggregate and specifications for sessionId', async () => {
      const mockPlanning = {
        id: 'p1',
        sessionId: 's1',
        blocks: [],
        curricularComponents: [],
      };
      const mockSpecs = [{ id: 'spec-1', colName: 'recursos' }];

      prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
      prismaMock.specification.findMany.mockResolvedValue(mockSpecs);

      const result = await planningService.getPlanningBySessionId('s1');
      expect(result.planning).toEqual(mockPlanning);
      expect(result.specifications).toEqual(mockSpecs);
    });
  });
});
