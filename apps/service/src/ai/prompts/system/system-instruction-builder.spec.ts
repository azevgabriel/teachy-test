import { describe, it, expect } from 'vitest';
import {
  SystemInstructionBuilder,
  formatSnapshotPrompt,
  inferPlanningPhase,
  type PlanningSnapshot,
} from './index.js';

describe('SystemInstructionBuilder & Modular System Prompts', () => {
  it('builds system instruction with all core modular sections', () => {
    const instruction = SystemInstructionBuilder.build();

    // 1. Persona Base & Antidump Guardrail
    expect(instruction).toContain('Assistente Pedagógico Teachy — Co-piloto de Planejamento Escolar');
    expect(instruction).toContain('Regra Antidump de Tabelas');
    expect(instruction).toContain('Living Draft');

    // 2. Regras Pedagógicas & Soberania Docente na BNCC
    expect(instruction).toContain('Regras Pedagógicas, Granularidade & BNCC');
    expect(instruction).toContain('Soberania do Professor ("O professor falou, tá falado")');
    expect(instruction).toContain('defasagem de aprendizagem');

    // 3. Sistema Brasileiro de Avaliações
    expect(instruction).toContain('Sistema Brasileiro de Avaliações na Educação Básica');
    expect(instruction).toContain('instrumentType');
    expect(instruction).toContain('criteria');
    expect(instruction).toContain('Escala 0 a 100');

    // 4. Matriz de Intenções
    expect(instruction).toContain('Matriz de Intenções do Professor');
    expect(instruction).toContain('UPDATE_BLOCK_BY_DATE');
    expect(instruction).toContain('ADD_SPECIFICATION_PENDING');
    expect(instruction).toContain('REORGANIZE_TREE');
    expect(instruction).toContain('BATCH_UPDATE_METODOLOGIA');
    expect(instruction).toContain('READ_ONLY');
    expect(instruction).toContain('DELETE_BLOCK_WITH_GAP');
    expect(instruction).toContain('RESET_PLANNING');

    // 5. Protocolo de Saída Dupla & Envelope de Persistência
    expect(instruction).toContain('Protocolo de Saída Dupla & Envelope Estruturado de Persistência');
    expect(instruction).toContain('PLANNING_PATCH');
    expect(instruction).toContain('UPSERT_PLANNING');

    // 6. Orientações de Fase Padrão (Discovery quando sem snapshot)
    expect(instruction).toContain('Fase Atual: Descoberta');

    // 7. Snapshot Consolidado como Fonte Única da Verdade
    expect(instruction).toContain('Snapshot Consolidado do Banco de Dados (Fonte Única da Verdade)');
  });

  describe('inferPlanningPhase', () => {
    it('infers "discovery" when snapshot is null or missing macro fields', () => {
      expect(inferPlanningPhase(null)).toBe('discovery');
      expect(inferPlanningPhase({})).toBe('discovery');

      // Faltam componentes ou datas
      const partial: PlanningSnapshot = {
        planning: {
          id: 'p1',
          applicationYearId: 'year-1',
          startAt: new Date('2026-02-01'),
          // sem endAt e sem curricularComponents
        },
      };
      expect(inferPlanningPhase(partial)).toBe('discovery');
    });

    it('infers "schedule" when macro header is filled but no blocks exist', () => {
      const scheduleSnapshot: PlanningSnapshot = {
        planning: {
          id: 'p1',
          applicationYear: { id: 'y1', name: '3º Ano EF' },
          curricularComponents: [{ id: 'c1', name: 'Língua Portuguesa' }],
          startAt: new Date('2026-02-01'),
          endAt: new Date('2026-04-30'),
          granularity: 'TRIMESTER',
        },
        blocks: [],
      };
      expect(inferPlanningPhase(scheduleSnapshot)).toBe('schedule');
    });

    it('infers "elaboration" when blocks exist but have missing methodology or skills', () => {
      const elaborationSnapshot: PlanningSnapshot = {
        planning: {
          id: 'p1',
          applicationYear: { id: 'y1', name: '3º Ano EF' },
          curricularComponents: [{ id: 'c1', name: 'Língua Portuguesa' }],
          startAt: new Date('2026-02-01'),
          endAt: new Date('2026-04-30'),
        },
        blocks: [
          {
            id: 'b1',
            granularity: 'MONTHLY',
            startAt: new Date('2026-02-01'),
            metodologia: null, // sem metodologia
            learningObjectives: [],
          },
        ],
      };
      expect(inferPlanningPhase(elaborationSnapshot)).toBe('elaboration');
    });

    it('infers "refinement" when all blocks have methodology and structure', () => {
      const refinementSnapshot: PlanningSnapshot = {
        planning: {
          id: 'p1',
          applicationYear: { id: 'y1', name: '3º Ano EF' },
          curricularComponents: [{ id: 'c1', name: 'Língua Portuguesa' }],
          startAt: new Date('2026-02-01'),
          endAt: new Date('2026-04-30'),
        },
        blocks: [
          {
            id: 'b1',
            granularity: 'MONTHLY',
            startAt: new Date('2026-02-01'),
            metodologia: 'Sequência didática sobre gêneros textuais.',
            learningObjectives: [
              { id: 'lo1', bnccSkill: { id: 's1', code: 'EF03LP01', description: 'Ler e escrever' } },
            ],
          },
        ],
      };
      expect(inferPlanningPhase(refinementSnapshot)).toBe('refinement');
    });
  });

  describe('formatSnapshotPrompt', () => {
    it('formats empty snapshot state', () => {
      const prompt = formatSnapshotPrompt(null);
      expect(prompt).toContain('Nenhum planejamento iniciado ainda para esta sessão');
    });

    it('formats rich snapshot with blocks, specifications and gap analysis', () => {
      const snapshot: PlanningSnapshot = {
        planning: {
          id: 'p-100',
          school: { id: 'sch-1', name: 'Escola Municipal Paulo Freire' },
          applicationYear: { id: 'y-3', name: '3º Ano EF' },
          curricularComponents: [{ id: 'cc-1', name: 'Língua Portuguesa' }],
          granularity: 'TRIMESTER',
          startAt: new Date('2026-02-01T00:00:00Z'),
          endAt: new Date('2026-04-30T00:00:00Z'),
        },
        specifications: [
          {
            id: 'spec-1',
            colName: 'recursos',
            customLabel: 'Recursos Didáticos',
            tableRef: 'PLANNING_BLOCK',
            isRequired: true,
            description: 'Materiais necessários para as aulas',
          },
        ],
        blocks: [
          {
            id: 'b-1',
            granularity: 'MONTHLY',
            order: 1,
            startAt: new Date('2026-02-01T00:00:00Z'),
            endAt: new Date('2026-02-28T00:00:00Z'),
            metodologia: 'Rodas de leitura e diagnósticos',
            learningObjectives: [
              { id: 'lo-1', bnccSkill: { id: 'sk-1', code: 'EF03LP01', description: 'Leitura fluente' } },
            ],
            evaluations: [
              {
                id: 'ev-1',
                instrumentType: 'PAR',
                name: 'Avaliação Diagnóstica de Leitura',
              },
            ],
          },
        ],
      };

      const prompt = formatSnapshotPrompt(snapshot);

      expect(prompt).toContain('Escola Municipal Paulo Freire');
      expect(prompt).toContain('3º Ano EF');
      expect(prompt).toContain('Língua Portuguesa');
      expect(prompt).toContain('Recursos Didáticos');
      expect(prompt).toContain('[OBRIGATÓRIA / Slot-filling]');
      expect(prompt).toContain('EF03LP01');
      expect(prompt).toContain('[PAR] Avaliação Diagnóstica de Leitura');
      expect(prompt).toContain('REGRA DE PRECEDÊNCIA COGNITIVA ABSOLUTA');
    });
  });

  describe('custom teacher context and database catalog', () => {
    it('appends teacher profile and custom instructions when provided', () => {
      const instruction = SystemInstructionBuilder.build({
        teacherName: 'Profa. Mariana',
        customInstructions: 'Focar em metodologias ativas para turma inclusiva.',
      });

      expect(instruction).toContain('Professor atendido: Profa. Mariana');
      expect(instruction).toContain('Focar em metodologias ativas para turma inclusiva.');
    });

    it('injects official application years and curricular components catalog', () => {
      const instruction = SystemInstructionBuilder.build({
        availableYears: [
          { id: 'y1', name: 'Ensino Infantil (zero a 1 ano e 6 meses)' },
          { id: 'y2', name: '3º ano do Ensino Fundamental I' },
        ],
        availableCurricularComponents: [
          { id: 'c1', name: 'Corpo, gestos e movimentos' },
          { id: 'c2', name: 'Matemática' },
        ],
      });

      expect(instruction).toContain('Catálogo Oficial de Anos de Aplicação & Componentes Curriculares (PostgreSQL)');
      expect(instruction).toContain('"Ensino Infantil (zero a 1 ano e 6 meses)"');
      expect(instruction).toContain('"3º ano do Ensino Fundamental I"');
      expect(instruction).toContain('"Corpo, gestos e movimentos"');
      expect(instruction).toContain('"Matemática"');
    });
  });
});
