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
        recessDates: ['2026-03-15'],
        blocks: [
          {
            order: 1,
            granularity: 'WEEKLY',
            metodologia: 'Introdução aos números naturais',
            bnccCodes: ['EF03MA01'],
          },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar UPSERT_PLANNING se endAt < startAt no planejamento', () => {
    const payload = {
      operation: 'UPSERT_PLANNING',
      data: {
        startAt: '2026-08-10T00:00:00Z',
        endAt: '2026-08-05T00:00:00Z',
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar UPSERT_PLANNING se endAt < startAt em um bloco', () => {
    const payload = {
      operation: 'UPSERT_PLANNING',
      data: {
        startAt: '2026-08-01T00:00:00Z',
        endAt: '2026-08-30T00:00:00Z',
        blocks: [
          {
            order: 1,
            startAt: '2026-08-15T00:00:00Z',
            endAt: '2026-08-10T00:00:00Z',
          },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar UPSERT_PLANNING com planejamento WEEKLY contendo bloco direto WEEKLY', () => {
    const payload = {
      operation: 'UPSERT_PLANNING',
      data: {
        granularity: 'WEEKLY',
        blocks: [
          {
            order: 1,
            granularity: 'WEEKLY',
            metodologia: 'Aula 1',
          },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('deve aceitar UPSERT_PLANNING com planejamento WEEKLY contendo bloco direto DAILY', () => {
    const payload = {
      operation: 'UPSERT_PLANNING',
      data: {
        granularity: 'WEEKLY',
        blocks: [
          {
            order: 1,
            granularity: 'DAILY',
            metodologia: 'Aula 1',
          },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('deve validar com sucesso REALLOCATE_LESSONS', () => {
    const payload = {
      operation: 'REALLOCATE_LESSONS',
      data: {
        recessDates: ['2026-08-04', '2026-08-06'],
        startDate: '2026-08-03',
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

  it('deve validar com sucesso ADD_SPECIFICATION com defaults de order, isVisible e showLabel', () => {
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
    if (result.success && 'operation' in result.data && result.data.operation === 'ADD_SPECIFICATION') {
      expect(result.data.data.order).toBe(0);
      expect(result.data.data.isVisible).toBe(true);
      expect(result.data.data.showLabel).toBe(true);
    }
  });

  it('deve validar com sucesso ADD_SPECIFICATION com order, isVisible e showLabel customizados', () => {
    const payload = {
      operation: 'ADD_SPECIFICATION',
      data: {
        colName: 'disciplina',
        customLabel: 'Disciplina',
        tableRef: 'PLANNING',
        isRequired: false,
        order: 2,
        isVisible: false,
        showLabel: false,
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success && 'operation' in result.data && result.data.operation === 'ADD_SPECIFICATION') {
      expect(result.data.data.order).toBe(2);
      expect(result.data.data.isVisible).toBe(false);
      expect(result.data.data.showLabel).toBe(false);
    }
  });

  it('deve validar com sucesso FILL_METADATA', () => {
    const payload = {
      operation: 'FILL_METADATA',
      data: {
        colName: 'recursos_didaticos',
        granularity: 'WEEKLY',
        parentId: 'parent-block-1',
        values: [
          { date: '2026-03-05', textValue: 'Cartolinas e tablets', granularity: 'WEEKLY' },
          { order: 2, textValue: 'Livro didático pág. 40', parentId: 'parent-block-1' },
          { blockId: 'b-123', textValue: 'Vídeo projetor' },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success && 'operation' in result.data) {
      expect(result.data.data.granularity).toBe('WEEKLY');
      expect(result.data.data.parentId).toBe('parent-block-1');
      expect(result.data.data.values).toHaveLength(3);
    }
  });

  it('deve validar com sucesso FILL_METADATA multi-colunas especificando colName em cada item de values', () => {
    const payload = {
      operation: 'FILL_METADATA',
      data: {
        values: [
          { blockId: 'b-1', colName: 'recursos_espacos', textValue: 'Material Dourado' },
          { blockId: 'b-1', colName: 'transposicao_pastoral', textValue: 'Solidariedade' },
          { blockId: 'b-2', colName: 'estrategias_adaptativas', textValue: 'DUA e apoio visual' },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success && 'operation' in result.data) {
      expect(result.data.data.values).toHaveLength(3);
      expect((result.data.data.values[0] as any).colName).toBe('recursos_espacos');
    }
  });

  it('deve falhar validação de FILL_METADATA se colName for omitido na raiz e em item de values', () => {
    const payload = {
      operation: 'FILL_METADATA',
      data: {
        values: [{ blockId: 'b-1', textValue: 'Sem colName definido' }],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
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

  it('deve validar UPSERT_PLANNING com especificações, metadados macro e metadados nos blocos', () => {
    const payload = {
      operation: 'UPSERT_PLANNING',
      data: {
        granularity: 'WEEKLY',
        curricularComponentNames: ['Corpo, gestos e movimentos'],
        applicationYearName: 'Ensino Infantil (zero a 1 ano e 6 meses)',
        specifications: [
          { colName: 'metodologia', tableRef: 'PLANNING_BLOCK', customLabel: 'Sequência Didática' },
          { colName: 'conteudo', tableRef: 'PLANNING_BLOCK', customLabel: 'Conteúdo' },
          { colName: 'aplicacao_crista', tableRef: 'PLANNING', customLabel: 'Aplicação Cristã' },
        ],
        metadataValues: [
          { colName: 'aplicacao_crista', textValue: 'Acolhimento com amor e cuidado aos bebês.' },
        ],
        blocks: [
          {
            startAt: '2026-03-02',
            order: 1,
            granularity: 'DAILY',
            metodologia: '1. Roda de cantigas. 2. Exploração sensorial de tecidos.',
            bnccCodes: ['EI01CG01'],
            metadataValues: [
              { colName: 'conteudo', textValue: 'Percepção sensorial e comunicação oral/gestual.' },
            ],
          },
        ],
      },
    };

    const result = planningPatchPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
