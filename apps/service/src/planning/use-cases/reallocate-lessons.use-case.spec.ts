import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReallocateLessonsUseCase } from './reallocate-lessons.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { toISODateString } from '../utils/school-calendar.js';

describe('ReallocateLessonsUseCase', () => {
  let useCase: ReallocateLessonsUseCase;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      planning: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      planningBlock: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
    };

    useCase = new ReallocateLessonsUseCase(prismaMock as unknown as PrismaService);
  });

  it('empurra as aulas em cascata pulando recessos locais e fins de semana, estendendo o endAt do planejamento', async () => {
    // Cenário da issue: 5 aulas diárias de 03/08 a 07/08.
    // Recessos informados pelo professor: 04/08 e 06/08.
    const initialBlocks = [
      { id: 'b1', order: 1, startAt: new Date('2026-08-03T12:00:00Z'), endAt: null, metodologia: 'Aula 1 - Intro' },
      { id: 'b2', order: 2, startAt: new Date('2026-08-04T12:00:00Z'), endAt: null, metodologia: 'Aula 2 - Prática' },
      { id: 'b3', order: 3, startAt: new Date('2026-08-05T12:00:00Z'), endAt: null, metodologia: 'Aula 3 - Teoria' },
      { id: 'b4', order: 4, startAt: new Date('2026-08-06T12:00:00Z'), endAt: null, metodologia: 'Aula 4 - Lab' },
      { id: 'b5', order: 5, startAt: new Date('2026-08-07T12:00:00Z'), endAt: null, metodologia: 'Aula 5 - Avaliação' },
    ];

    const initialPlanning = {
      id: 'plan-1',
      sessionId: 'session-1',
      startAt: new Date('2026-08-03T00:00:00Z'),
      endAt: new Date('2026-08-07T23:59:59Z'),
      recessDates: [],
      blocks: initialBlocks,
    };

    prismaMock.planning.findFirst.mockResolvedValue(initialPlanning);

    await useCase.execute('session-1', {
      recessDates: ['2026-08-04', '2026-08-06'],
    });

    // 1. Deve salvar os recessos no cabeçalho Planning
    expect(prismaMock.planning.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          recessDates: ['2026-08-04', '2026-08-06'],
        }),
      }),
    );

    // 2. Deve realocar cada bloco para a data letiva correta:
    // Bloco 1 -> 2026-08-03 (Segunda)
    expect(prismaMock.planningBlock.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: expect.objectContaining({
        startAt: expect.any(Date),
      }),
    });
    const callB1 = prismaMock.planningBlock.update.mock.calls.find((c: any) => c[0].where.id === 'b1');
    expect(toISODateString(callB1[0].data.startAt)).toBe('2026-08-03');

    // Bloco 2 -> 2026-08-05 (Quarta, pulando 04/08)
    const callB2 = prismaMock.planningBlock.update.mock.calls.find((c: any) => c[0].where.id === 'b2');
    expect(toISODateString(callB2[0].data.startAt)).toBe('2026-08-05');

    // Bloco 3 -> 2026-08-07 (Sexta, pulando 06/08)
    const callB3 = prismaMock.planningBlock.update.mock.calls.find((c: any) => c[0].where.id === 'b3');
    expect(toISODateString(callB3[0].data.startAt)).toBe('2026-08-07');

    // Bloco 4 -> 2026-08-10 (Segunda, pulando 08/08 Sáb e 09/08 Dom)
    const callB4 = prismaMock.planningBlock.update.mock.calls.find((c: any) => c[0].where.id === 'b4');
    expect(toISODateString(callB4[0].data.startAt)).toBe('2026-08-10');

    // Bloco 5 -> 2026-08-11 (Terça)
    const callB5 = prismaMock.planningBlock.update.mock.calls.find((c: any) => c[0].where.id === 'b5');
    expect(toISODateString(callB5[0].data.startAt)).toBe('2026-08-11');

    // 3. Deve estender o endAt do cabeçalho Planning para 11/08
    const callPlanningEnd = prismaMock.planning.update.mock.calls.find(
      (c: any) => c[0].where.id === 'plan-1' && c[0].data.endAt,
    );
    expect(callPlanningEnd).toBeDefined();
    expect(toISODateString(callPlanningEnd[0].data.endAt)).toBe('2026-08-11');
  });

  it('empurra aula quando cai em feriado nacional (7 de setembro)', async () => {
    // Aula agendada inicialmente para 07/09/2026 (Segunda-feira, Independência do Brasil)
    const initialBlocks = [
      { id: 'b1', order: 1, startAt: new Date('2026-09-07T12:00:00Z'), endAt: null },
    ];

    const initialPlanning = {
      id: 'plan-2',
      sessionId: 'session-2',
      startAt: new Date('2026-09-07T00:00:00Z'),
      endAt: new Date('2026-09-07T23:59:59Z'),
      recessDates: [],
      blocks: initialBlocks,
    };

    prismaMock.planning.findFirst.mockResolvedValue(initialPlanning);

    await useCase.execute('session-2', {});

    // Bloco 1 deve ser deslocado para 08/09/2026 (Terça-feira útil)
    const callB1 = prismaMock.planningBlock.update.mock.calls.find((c: any) => c[0].where.id === 'b1');
    expect(toISODateString(callB1[0].data.startAt)).toBe('2026-09-08');

    // Planning endAt deve ser estendido para 08/09
    const callPlanningEnd = prismaMock.planning.update.mock.calls.find(
      (c: any) => c[0].where.id === 'plan-2' && c[0].data.endAt,
    );
    expect(toISODateString(callPlanningEnd[0].data.endAt)).toBe('2026-09-08');
  });
});
