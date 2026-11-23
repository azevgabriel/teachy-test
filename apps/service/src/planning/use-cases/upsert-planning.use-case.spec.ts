import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsertPlanningUseCase } from './upsert-planning.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { BadRequestException } from '@nestjs/common';
import { toISODateString } from '../utils/school-calendar.js';

describe('UpsertPlanningUseCase', () => {
  let useCase: UpsertPlanningUseCase;
  let prismaMock: any;
  let reallocateUseCaseMock: any;

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
      session: {
        findUnique: vi.fn().mockResolvedValue({ id: 'session-1', name: 'Nova Conversa' }),
        update: vi.fn().mockResolvedValue({}),
      },
      applicationYear: {
        findMany: vi.fn().mockResolvedValue(mockYears),
        findUnique: vi.fn(),
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
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: args?.where?.id || 'plan-1', ...args?.data })),
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

    reallocateUseCaseMock = {
      execute: vi.fn().mockResolvedValue({}),
    };

    useCase = new UpsertPlanningUseCase(
      prismaMock as unknown as PrismaService,
      reallocateUseCaseMock,
    );
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

    expect(prismaMock.planning.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          applicationYearId: 'year-em-3',
        }),
      }),
    );

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

    expect(prismaMock.learningObjective.deleteMany).toHaveBeenCalledWith({
      where: {
        planningId: 'plan-1',
        bnccSkillId: { notIn: ['skill-new-1'] },
      },
    });

    expect(prismaMock.learningObjective.create).toHaveBeenCalledWith({
      data: {
        planningId: 'plan-1',
        bnccSkillId: 'skill-new-1',
        planningBlockId: null,
      },
    });
  });

  it('remove todas as habilidades BNCC macro do cabeçalho quando bnccCodes: [] for explicitamente enviado', async () => {
    const existingPlanning = {
      id: 'plan-1',
      sessionId: 'session-1',
      applicationYearId: 'year-em-3',
    };
    prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
    prismaMock.planning.update.mockResolvedValue(existingPlanning);

    await useCase.execute('session-1', {
      bnccCodes: [],
    });

    expect(prismaMock.learningObjective.deleteMany).toHaveBeenCalledWith({
      where: { planningId: 'plan-1' },
    });
  });

  it('persiste order, isVisible e showLabel no upsert de especificações', async () => {
    const existingPlanning = {
      id: 'plan-1',
      sessionId: 'session-1',
    };
    prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
    prismaMock.planning.update.mockResolvedValue(existingPlanning);

    prismaMock.specification.findFirst.mockResolvedValue(null);

    await useCase.execute('session-1', {
      specifications: [
        {
          colName: 'disciplina',
          customLabel: 'Disciplina',
          tableRef: 'PLANNING',
          order: 1,
          isVisible: true,
          showLabel: false,
          isRequired: false,
        },
      ],
    });

    expect(prismaMock.specification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        colName: 'disciplina',
        customLabel: 'Disciplina',
        tableRef: 'PLANNING',
        order: 1,
        isVisible: true,
        showLabel: false,
        isRequired: false,
      }),
    });

    const existingSpec = {
      id: 'spec-1',
      sessionId: 'session-1',
      colName: 'disciplina',
      customLabel: 'Componente',
      tableRef: 'PLANNING',
      order: 0,
      isVisible: true,
      showLabel: true,
      isRequired: false,
    };
    prismaMock.specification.findFirst.mockResolvedValue(existingSpec);

    await useCase.execute('session-1', {
      specifications: [
        {
          colName: 'disciplina',
          customLabel: 'Disciplina',
          tableRef: 'PLANNING',
          order: 2,
          isVisible: false,
          showLabel: false,
          isRequired: true,
        },
      ],
    });

    expect(prismaMock.specification.update).toHaveBeenCalledWith({
      where: { id: 'spec-1' },
      data: expect.objectContaining({
        customLabel: 'Disciplina',
        order: 2,
        isVisible: false,
        showLabel: false,
        isRequired: true,
      }),
    });
  });

  it('persists specifications with description (tone) and avgCharLimit (density) during school reference ingestion', async () => {
    const existingPlanning = {
      id: 'plan-1',
      sessionId: 'session-1',
    };
    prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
    prismaMock.planning.update.mockResolvedValue(existingPlanning);
    prismaMock.specification.findFirst.mockResolvedValue(null);

    await useCase.execute('session-1', {
      specifications: [
        {
          colName: 'metodologia',
          customLabel: 'Sequência Didática',
          tableRef: 'PLANNING_BLOCK',
          description: 'Metodologias ativas com foco em resolução colaborativa.',
          avgCharLimit: 250,
          order: 1,
          isRequired: true,
        },
      ],
    });

    expect(prismaMock.specification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        colName: 'metodologia',
        customLabel: 'Sequência Didática',
        tableRef: 'PLANNING_BLOCK',
        description: 'Metodologias ativas com foco em resolução colaborativa.',
        avgCharLimit: 250,
        order: 1,
        isRequired: true,
      }),
    });
  });

  // Novos Testes da Issue #28

  describe('Hierarquia de Granularidade & Descida Estrita (Critério de Aceite 1)', () => {
    it('em planejamento WEEKLY, força criação de blocos filhos com granularidade DAILY (nunca WEEKLY)', async () => {
      prismaMock.planning.findFirst.mockResolvedValue(null);
      prismaMock.planning.create.mockResolvedValue({ id: 'plan-weekly', granularity: 'WEEKLY' });
      prismaMock.planningBlock.findFirst.mockResolvedValue(null);
      prismaMock.planningBlock.create.mockResolvedValue({ id: 'b1' });

      await useCase.execute('session-1', {
        granularity: 'WEEKLY',
        startAt: '2026-08-03T00:00:00Z',
        endAt: '2026-08-07T23:59:59Z',
        blocks: [
          {
            order: 1,
            startAt: '2026-08-03T12:00:00Z',
            metodologia: 'Aula 1',
            // IA erroneamente enviou granularidade WEEKLY sob planejamento WEEKLY
            granularity: 'WEEKLY',
          },
        ],
      });

      expect(prismaMock.planningBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            granularity: 'DAILY',
          }),
        }),
      );
    });
  });

  describe('Preservação de Granularidade em Updates de Colunas (Critério de Aceite 2)', () => {
    it('preserva a granularidade DAILY de bloco existente durante reordenação e update de metodologia', async () => {
      const existingPlanning = {
        id: 'plan-1',
        sessionId: 'session-1',
        granularity: 'WEEKLY',
      };
      prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
      prismaMock.planning.update.mockResolvedValue(existingPlanning);

      const existingBlock = {
        id: 'b-daily-1',
        planningId: 'plan-1',
        order: 1,
        granularity: 'DAILY',
        startAt: new Date('2026-08-03T12:00:00Z'),
      };
      prismaMock.planningBlock.findFirst.mockResolvedValue(existingBlock);
      prismaMock.planningBlock.update.mockResolvedValue(existingBlock);

      // Atualização que altera order para 2 e metodologia, sem enviar granularidade
      await useCase.execute('session-1', {
        blocks: [
          {
            order: 2,
            startAt: '2026-08-03T12:00:00Z',
            metodologia: 'Nova Metodologia Refinada',
          },
        ],
      });

      expect(prismaMock.planningBlock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-daily-1' },
          data: expect.objectContaining({
            order: 2,
            metodologia: 'Nova Metodologia Refinada',
            granularity: 'DAILY',
          }),
        }),
      );
    });
  });

  describe('Validação Contínua de Datas (Critério de Aceite 5)', () => {
    it('lança BadRequestException se endAt < startAt no planejamento macro', async () => {
      prismaMock.planning.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute('session-1', {
          startAt: '2026-08-10T00:00:00Z',
          endAt: '2026-08-05T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException se endAt < startAt em um bloco', async () => {
      prismaMock.planning.findFirst.mockResolvedValue(null);
      prismaMock.planning.create.mockResolvedValue({ id: 'p1' });

      await expect(
        useCase.execute('session-1', {
          startAt: '2026-08-01T00:00:00Z',
          endAt: '2026-08-30T00:00:00Z',
          blocks: [
            {
              order: 1,
              startAt: '2026-08-15T00:00:00Z',
              endAt: '2026-08-10T00:00:00Z',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('estende automaticamente o endAt do planejamento quando o bloco ultrapassa o limite anterior', async () => {
      const existingPlanning = {
        id: 'plan-1',
        sessionId: 'session-1',
        startAt: new Date('2026-08-03T00:00:00Z'),
        endAt: new Date('2026-08-07T23:59:59Z'),
      };
      prismaMock.planning.findFirst.mockResolvedValue(existingPlanning);
      prismaMock.planning.update.mockResolvedValue(existingPlanning);

      prismaMock.planningBlock.findFirst.mockResolvedValue(null);
      prismaMock.planningBlock.create.mockResolvedValue({ id: 'b-new' });

      // Bloco agendado para 11/08 (além de 07/08)
      await useCase.execute('session-1', {
        blocks: [
          {
            order: 5,
            startAt: '2026-08-11T12:00:00Z',
            metodologia: 'Aula estendida',
          },
        ],
      });

      // Deve atualizar endAt do planejamento para cobrir a aula de 11/08
      expect(prismaMock.planning.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: expect.objectContaining({
            endAt: expect.any(Date),
          }),
        }),
      );
      const updateCall = prismaMock.planning.update.mock.calls.find(
        (c: any) => c[0].where.id === 'plan-1' && c[0].data.endAt,
      );
      expect(toISODateString(updateCall[0].data.endAt)).toBe('2026-08-11');
    });
  });

  describe('Suporte a recessDates no Planning (Critério de Aceite 3)', () => {
    it('persiste recessDates informados no planejamento', async () => {
      prismaMock.planning.findFirst.mockResolvedValue(null);
      prismaMock.planning.create.mockResolvedValue({ id: 'plan-recess' });

      await useCase.execute('session-1', {
        recessDates: ['2026-08-04', '2026-08-06'],
      });

      expect(prismaMock.planning.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recessDates: ['2026-08-04', '2026-08-06'],
          }),
        }),
      );
    });
  });

  describe('Atualização automática de Session.name (Issue #20)', () => {
    it('atualiza automaticamente o nome da sessão caso ainda seja o padrão "Nova Conversa"', async () => {
      prismaMock.planning.findFirst.mockResolvedValue(null);
      prismaMock.planning.create.mockResolvedValue({
        id: 'plan-1',
        granularity: 'WEEKLY',
      });
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'session-1',
        name: 'Nova Conversa',
      });

      await useCase.execute('session-1', {
        granularity: 'WEEKLY',
        curricularComponentNames: ['Língua Portuguesa'],
        applicationYearName: '3º ano do Ensino Fundamental I',
      });

      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          name: 'Planejamento Semanal - Língua Portuguesa (3º ano do Ensino Fundamental I)',
        },
      });
    });

    it('não sobrescreve o nome da sessão se o professor tiver renomeado manualmente', async () => {
      prismaMock.planning.findFirst.mockResolvedValue(null);
      prismaMock.planning.create.mockResolvedValue({
        id: 'plan-1',
        granularity: 'WEEKLY',
      });
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'session-1',
        name: 'Turma 301 - Manhã (Renomeado Manualmente)',
      });

      await useCase.execute('session-1', {
        granularity: 'WEEKLY',
        curricularComponentNames: ['Matemática'],
      });

      expect(prismaMock.session.update).not.toHaveBeenCalled();
    });
  });
});
