import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FillPlanningMetadataUseCase } from './fill-planning-metadata.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('FillPlanningMetadataUseCase', () => {
  let useCase: FillPlanningMetadataUseCase;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      specification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      planning: {
        findFirst: vi.fn(),
      },
      planningBlock: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      planningMetadataValue: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    useCase = new FillPlanningMetadataUseCase(prismaMock as unknown as PrismaService);
  });

  const mockPlanning = { id: 'planning-1', sessionId: 'session-1' };

  // Árvore hierárquica de 3 níveis:
  // Nível 1: Trimestre 1 (TRIMESTER, parentId: null, order: 1)
  // Nível 2: Mês 1 (MONTHLY, parentId: 'trim-1', order: 1) e Mês 2 (MONTHLY, parentId: 'trim-1', order: 2)
  // Nível 3 (folhas): Semana 1 (WEEKLY, parentId: 'month-1', order: 1), Semana 2 (WEEKLY, parentId: 'month-1', order: 2)
  //                   Semana 1 de Mês 2 (WEEKLY, parentId: 'month-2', order: 1)
  const mockTree3Levels = [
    {
      id: 'trim-1',
      planningId: 'planning-1',
      parentId: null,
      granularity: 'TRIMESTER',
      order: 1,
      startAt: new Date('2026-02-01T00:00:00Z'),
      endAt: new Date('2026-04-30T23:59:59Z'),
      children: [{ id: 'month-1' }, { id: 'month-2' }],
    },
    {
      id: 'month-1',
      planningId: 'planning-1',
      parentId: 'trim-1',
      granularity: 'MONTHLY',
      order: 1,
      startAt: new Date('2026-02-01T00:00:00Z'),
      endAt: new Date('2026-02-28T23:59:59Z'),
      children: [{ id: 'week-1' }, { id: 'week-2' }],
    },
    {
      id: 'month-2',
      planningId: 'planning-1',
      parentId: 'trim-1',
      granularity: 'MONTHLY',
      order: 2,
      startAt: new Date('2026-03-01T00:00:00Z'),
      endAt: new Date('2026-03-31T23:59:59Z'),
      children: [{ id: 'week-m2-1' }],
    },
    {
      id: 'week-1',
      planningId: 'planning-1',
      parentId: 'month-1',
      granularity: 'WEEKLY',
      order: 1,
      startAt: new Date('2026-02-02T00:00:00Z'),
      endAt: new Date('2026-02-06T23:59:59Z'),
      children: [],
    },
    {
      id: 'week-2',
      planningId: 'planning-1',
      parentId: 'month-1',
      granularity: 'WEEKLY',
      order: 2,
      startAt: new Date('2026-02-09T00:00:00Z'),
      endAt: new Date('2026-02-13T23:59:59Z'),
      children: [],
    },
    {
      id: 'week-m2-1',
      planningId: 'planning-1',
      parentId: 'month-2',
      granularity: 'WEEKLY',
      order: 1,
      startAt: new Date('2026-03-02T00:00:00Z'),
      endAt: new Date('2026-03-06T23:59:59Z'),
      children: [],
    },
  ];

  it('prioriza nó folha (leaf node) ao buscar por order sem granularidade em árvore de 3 níveis', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockResolvedValue({
      id: 'spec-meta',
      colName: 'metodologia',
      tableRef: 'PLANNING_BLOCK',
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);

    await useCase.execute('session-1', {
      colName: 'metodologia',
      values: [{ order: 1, textValue: 'Metodologia da Semana 1' }],
    });

    // Deve atualizar week-1 (folha), e NÃO trim-1 ou month-1
    expect(prismaMock.planningBlock.update).toHaveBeenCalledWith({
      where: { id: 'week-1' },
      data: { metodologia: 'Metodologia da Semana 1' },
    });
    // Garante que não criou registros dinâmicos EAV para metodologia
    expect(prismaMock.planningMetadataValue.create).not.toHaveBeenCalled();
    expect(prismaMock.planningMetadataValue.deleteMany).toHaveBeenCalledWith({
      where: { specificationId: 'spec-meta', planningBlockId: 'week-1' },
    });
  });

  it('desambigua nó folha por data mesmo quando blocos superiores (mês/trimestre) englobam a mesma data', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockResolvedValue({
      id: 'spec-meta',
      colName: 'metodologia',
      tableRef: 'PLANNING_BLOCK',
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);

    // 2026-02-04 está dentro do trimestre trim-1, do mês month-1 e da semana week-1
    await useCase.execute('session-1', {
      colName: 'metodologia',
      values: [{ date: '2026-02-04', textValue: 'Atividade dinâmica de quarta-feira' }],
    });

    expect(prismaMock.planningBlock.update).toHaveBeenCalledWith({
      where: { id: 'week-1' },
      data: { metodologia: 'Atividade dinâmica de quarta-feira' },
    });
  });

  it('permite direcionamento explícito por parentId para desambiguar semanas de mesmo order em meses diferentes', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockResolvedValue({
      id: 'spec-meta',
      colName: 'metodologia',
      tableRef: 'PLANNING_BLOCK',
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);

    // Semana 1 do Mês 2 (week-m2-1)
    await useCase.execute('session-1', {
      colName: 'metodologia',
      values: [{ parentId: 'month-2', order: 1, textValue: 'Metodologia Mês 2 Semana 1' }],
    });

    expect(prismaMock.planningBlock.update).toHaveBeenCalledWith({
      where: { id: 'week-m2-1' },
      data: { metodologia: 'Metodologia Mês 2 Semana 1' },
    });
  });

  it('permite preenchimento explícito de bloco pai quando granularity for especificada', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockResolvedValue({
      id: 'spec-meta',
      colName: 'metodologia',
      tableRef: 'PLANNING_BLOCK',
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);

    await useCase.execute('session-1', {
      colName: 'metodologia',
      granularity: 'MONTHLY',
      values: [{ order: 1, textValue: 'Diretrizes gerais para Fevereiro' }],
    });

    // Como granularity foi especificada como MONTHLY, atualiza month-1
    expect(prismaMock.planningBlock.update).toHaveBeenCalledWith({
      where: { id: 'month-1' },
      data: { metodologia: 'Diretrizes gerais para Fevereiro' },
    });
  });

  it('preenche coluna customizada EAV vinculada ao nó folha correto com constraint XOR respeitada', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockResolvedValue({
      id: 'spec-custom',
      colName: 'recursos_didaticos',
      tableRef: 'PLANNING_BLOCK',
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);
    prismaMock.planningMetadataValue.findFirst.mockResolvedValue(null);

    await useCase.execute('session-1', {
      colName: 'recursos_didaticos',
      values: [{ order: 2, textValue: 'Lousa digital e projetor' }],
    });

    // Deve resolver week-2 (folha)
    expect(prismaMock.planningMetadataValue.create).toHaveBeenCalledWith({
      data: {
        specificationId: 'spec-custom',
        planningId: null, // XOR respeitado!
        planningBlockId: 'week-2',
        textValue: 'Lousa digital e projetor',
        jsonbValue: null,
      },
    });
  });

  it('ignora registro quando não for possível resolver bloco para tabela PLANNING_BLOCK para evitar violação XOR', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockResolvedValue({
      id: 'spec-custom',
      colName: 'recursos_didaticos',
      tableRef: 'PLANNING_BLOCK',
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);

    await useCase.execute('session-1', {
      colName: 'recursos_didaticos',
      values: [{ order: 999, textValue: 'Ordem inexistente' }],
    });

    expect(prismaMock.planningMetadataValue.create).not.toHaveBeenCalled();
    expect(prismaMock.planningMetadataValue.update).not.toHaveBeenCalled();
  });

  it('permite preenchimento multi-colunas em lote quando colName é especificado em cada item de values', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(mockPlanning);
    prismaMock.specification.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.colName?.equals === 'recursos_espacos') {
        return { id: 'spec-rec', colName: 'recursos_espacos', tableRef: 'PLANNING_BLOCK' };
      }
      if (where.colName?.equals === 'metodologia') {
        return { id: 'spec-meta', colName: 'metodologia', tableRef: 'PLANNING_BLOCK' };
      }
      return null;
    });
    prismaMock.planningBlock.findMany.mockResolvedValue(mockTree3Levels);
    prismaMock.planningMetadataValue.findFirst.mockResolvedValue(null);

    await useCase.execute('session-1', {
      values: [
        { blockId: 'week-1', colName: 'metodologia', textValue: 'Metodologia Semana 1' },
        { blockId: 'week-1', colName: 'recursos_espacos', textValue: 'Material Dourado' },
      ],
    });

    // Metodologia vai direto para planningBlock
    expect(prismaMock.planningBlock.update).toHaveBeenCalledWith({
      where: { id: 'week-1' },
      data: { metodologia: 'Metodologia Semana 1' },
    });
    // Recursos vai para planningMetadataValue
    expect(prismaMock.planningMetadataValue.create).toHaveBeenCalledWith({
      data: {
        specificationId: 'spec-rec',
        planningId: null,
        planningBlockId: 'week-1',
        textValue: 'Material Dourado',
        jsonbValue: null,
      },
    });
  });
});
