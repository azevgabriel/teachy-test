import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsertPlanningUseCase } from './upsert-planning.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('UpsertPlanningUseCase', () => {
  let useCase: UpsertPlanningUseCase;
  let prismaMock: any;

  const mockYears = [
    { id: 'year-ef1-3', name: '3º ano do Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: '8 anos' },
    { id: 'year-em-3', name: '3º ano do Ensino Médio', stage: 'MEDIO', targetAge: '17 anos' },
    { id: 'year-inf-1', name: 'Ensino Infantil (1 ano e 7 meses a 3 anos e 11 meses)', stage: 'INFANTIL', targetAge: '1 a 3 anos' },
  ];

  const mockComponents = [
    { id: 'comp-escuta', name: 'Escuta, fala, pensamento e imaginação' },
    { id: 'comp-portugues', name: 'Língua Portuguesa' },
    { id: 'comp-matematica', name: 'Matemática' },
  ];

  beforeEach(() => {
    prismaMock = {
      applicationYear: {
        findMany: vi.fn().mockResolvedValue(mockYears),
      },
      curricularComponent: {
        findMany: vi.fn().mockResolvedValue(mockComponents),
      },
      school: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      planning: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      bnccSkill: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningObjective: {
        findFirst: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      specification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      planningMetadataValue: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      evaluation: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      planningBlock: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    useCase = new UpsertPlanningUseCase(prismaMock as unknown as PrismaService);
  });

  it('associa corretamente "3º Ano do EM" ao 3º ano do Ensino Médio (evita Fundamental I)', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(null);
    prismaMock.planning.create.mockResolvedValue({ id: 'plan-1' });

    await useCase.execute('session-1', {
      applicationYearName: '3º Ano do EM',
      granularity: 'TRIMESTER',
    });

    expect(prismaMock.planning.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationYearId: 'year-em-3',
        }),
      }),
    );
  });

  it('associa "Língua Portuguesa" rigorosamente à disciplina correta, sem associar "Escuta, fala..."', async () => {
    prismaMock.planning.findFirst.mockResolvedValue(null);
    prismaMock.planning.create.mockResolvedValue({ id: 'plan-1' });

    await useCase.execute('session-1', {
      curricularComponentNames: ['Língua Portuguesa'],
      granularity: 'TRIMESTER',
    });

    expect(prismaMock.planning.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          curricularComponents: {
            connect: [{ id: 'comp-portugues' }],
          },
        }),
      }),
    );
  });

  it('limpa habilidades macro ao trocar de etapa (ex: de Infantil para Ensino Médio) quando novos bnccCodes não forem informados', async () => {
    const existingPlanning = {
      id: 'plan-1',
      sessionId: 'session-1',
      applicationYearId: 'year-inf-1',
    };
    prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
    prismaMock.planning.update.mockResolvedValue({
      ...existingPlanning,
      applicationYearId: 'year-em-3',
    });

    await useCase.execute('session-1', {
      applicationYearName: '3º ano do Ensino Médio',
    });

    // Deve atualizar o applicationYearId
    expect(prismaMock.planning.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          applicationYearId: 'year-em-3',
        }),
      }),
    );

    // Deve limpar as habilidades macro da etapa anterior
    expect(prismaMock.learningObjective.deleteMany).toHaveBeenCalledWith({
      where: { planningId: 'plan-1' },
    });
  });

  it('sincroniza habilidades macro e remove as que não estão mais presentes nos bnccCodes informados', async () => {
    const existingPlanning = {
      id: 'plan-1',
      sessionId: 'session-1',
      applicationYearId: 'year-em-3',
    };
    prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
    prismaMock.planning.update.mockResolvedValue(existingPlanning);

    prismaMock.bnccSkill.findMany.mockResolvedValue([
      { id: 'skill-new-1', code: 'EM13LP01' },
    ]);

    await useCase.execute('session-1', {
      bnccCodes: ['EM13LP01'],
    });

    // Remove habilidades que não estão na lista de ativas
    expect(prismaMock.learningObjective.deleteMany).toHaveBeenCalledWith({
      where: {
        planningId: 'plan-1',
        bnccSkillId: { notIn: ['skill-new-1'] },
      },
    });

    // Cria a nova habilidade se não existia
    expect(prismaMock.learningObjective.create).toHaveBeenCalledWith({
      data: {
        planningId: 'plan-1',
        bnccSkillId: 'skill-new-1',
        planningBlockId: null,
      },
    });
  });
});
