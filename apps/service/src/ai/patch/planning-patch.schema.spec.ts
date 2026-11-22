import { describe, expect, it } from 'vitest';
import { planningPatchPayloadSchema } from './planning-patch.schema.js';

describe('PlanningPatchSchema', () => {
  it('deve validar com sucesso a operação UPSERT_PLANNING com dados consolidados', () => {
    const payload = {
      operation: 'UPSERT_PLANNING',
      data: {
        granularity: 'MONTHLY',
        curricularComponentNames: ['Matemática'],
        applicationYearName: '3º Ano EF',
        bnccCodes: ['EF03MA01', 'EF03MA02'],
        startAt: '2026-03-01T00:00:00Z',
        endAt: '2026-03-31T23:59:59Z',
        blocks: [
          {
            order: 1,
            granularity: 'MONTHLY',
            metodologia: 'Introdução aos números naturais',
            bnccCodes: ['EF03MA01'],
          },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso UPDATE_BLOCK_BY_DATE', () => {
    const payload = {
      operation: 'UPDATE_BLOCK_BY_DATE',
      data: {
        date: '2026-08-06',
        metodologia: 'Atividade especial do Dia dos Pais',
        bnccCodes: ['EF03LP12'],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso BATCH_UPDATE_COLUMN', () => {
    const payload = {
      operation: 'BATCH_UPDATE_COLUMN',
      data: {
        granularity: 'WEEKLY',
        colName: 'metodologia',
        content: 'Sequência didática resumida em tópicos objetivos.',
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso ADD_SPECIFICATION', () => {
    const payload = {
      operation: 'ADD_SPECIFICATION',
      data: {
        colName: 'recursos_didaticos',
        customLabel: 'Recursos Didáticos',
        tableRef: 'PLANNING_BLOCK',
        isRequired: true,
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso FILL_METADATA', () => {
    const payload = {
      operation: 'FILL_METADATA',
      data: {
        colName: 'recursos_didaticos',
        values: [
          { date: '2026-03-05', textValue: 'Cartolinas e tablets' },
          { order: 2, textValue: 'Livro didático pág. 40' },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso DELETE_BLOCK_WITH_GAP', () => {
    const payload = {
      operation: 'DELETE_BLOCK_WITH_GAP',
      data: {
        date: '2026-01-01',
        granularity: 'MONTHLY',
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso REORGANIZE_TREE', () => {
    const payload = {
      operation: 'REORGANIZE_TREE',
      data: {
        parentGranularity: 'WEEKLY',
        childGranularity: 'DAILY',
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso RESET_PLANNING', () => {
    const payload = {
      operation: 'RESET_PLANNING',
      data: {},
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso READ_ONLY', () => {
    const payload = {
      operation: 'READ_ONLY',
      data: { queryType: 'COUNT_CLASSES' },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar payload envelopado com array de múltiplas operações', () => {
    const payload = {
      operations: [
        {
          operation: 'UPDATE_BLOCK_BY_DATE',
          data: { date: '2026-08-06', metodologia: 'Aula revisada' },
        },
        {
          operation: 'ADD_SPECIFICATION',
          data: {
            colName: 'observacoes',
            tableRef: 'PLANNING',
            isRequired: false,
          },
        },
      ],
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar operação desconhecida', () => {
    const payload = {
      operation: 'UNKNOWN_OPERATION',
      data: {},
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
