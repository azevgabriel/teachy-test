import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { PlanningGranularity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfExtractorService } from './extractors/pdf-extractor.service.js';
import { DocxExtractorService } from './extractors/docx-extractor.service.js';
import { VisionExtractorService } from './extractors/vision-extractor.service.js';
import {
  matchCurricularComponent,
  matchApplicationYear,
} from '../planning/utils/academic-catalog-matcher.js';
import type {
  ExtractedSchoolReference,
  ExtractorInput,
  ColumnDefinition,
  RawLessonBlock,
  ExtractedEvaluation,
} from './types.js';

export const BNCC_CODE_REGEX = /\b(E[FIM]\d{2}[A-Z]{2,3}\d{2,3})\b/gi;

export const DATE_RANGE_REGEX =
  /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s*(?:a|ate|à|-)\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i;

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const DEFAULT_CURRICULAR_COMPONENTS = [
  { id: 'c-lp', name: 'Língua Portuguesa' },
  { id: 'c-mat', name: 'Matemática' },
  { id: 'c-cie', name: 'Ciências' },
  { id: 'c-his', name: 'História' },
  { id: 'c-geo', name: 'Geografia' },
  { id: 'c-art', name: 'Arte' },
  { id: 'c-ef', name: 'Educação Física' },
  { id: 'c-ing', name: 'Língua Inglesa' },
  { id: 'c-bio', name: 'Biologia' },
  { id: 'c-fis', name: 'Física' },
  { id: 'c-qui', name: 'Química' },
  { id: 'c-fil', name: 'Filosofia' },
  { id: 'c-soc', name: 'Sociologia' },
  {
    id: 'c-ei-ef',
    name: 'Escuta, fala, pensamento e imaginação',
  },
  {
    id: 'c-ei-cgm',
    name: 'Corpo, gestos e movimentos',
  },
  {
    id: 'c-ei-etq',
    name: 'Espaços, tempos, quantidades, relações e transformações',
  },
  {
    id: 'c-ei-tsf',
    name: 'Traços, sons, cores e formas',
  },
  {
    id: 'c-ei-eon',
    name: 'O eu, o outro e o nós',
  },
];

const DEFAULT_APPLICATION_YEARS = [
  { id: 'y-inf-1', name: 'Bebês (zero a 1 ano e 6 meses)', stage: 'INFANTIL' },
  {
    id: 'y-inf-2',
    name: 'Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)',
    stage: 'INFANTIL',
  },
  {
    id: 'y-inf-3',
    name: 'Crianças pequenas (4 anos a 5 anos e 11 meses)',
    stage: 'INFANTIL',
  },
  {
    id: 'y-ef-1',
    name: '1º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
  },
  {
    id: 'y-ef-2',
    name: '2º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
  },
  {
    id: 'y-ef-3',
    name: '3º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
  },
  {
    id: 'y-ef-4',
    name: '4º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
  },
  {
    id: 'y-ef-5',
    name: '5º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
  },
  {
    id: 'y-ef-6',
    name: '6º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
  },
  {
    id: 'y-ef-7',
    name: '7º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
  },
  {
    id: 'y-ef-8',
    name: '8º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
  },
  {
    id: 'y-ef-9',
    name: '9º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
  },
  { id: 'y-em-1', name: '1ª série do Ensino Médio', stage: 'MEDIO' },
  { id: 'y-em-2', name: '2ª série do Ensino Médio', stage: 'MEDIO' },
  { id: 'y-em-3', name: '3ª série do Ensino Médio', stage: 'MEDIO' },
];

@Injectable()
export class ContentExtractionPipeline {
  private readonly logger = new Logger(ContentExtractionPipeline.name);

  constructor(
    private readonly pdfExtractor: PdfExtractorService,
    private readonly docxExtractor: DocxExtractorService,
    private readonly visionExtractor: VisionExtractorService,
    private readonly prisma?: PrismaService,
  ) {}

  async extract(input: ExtractorInput): Promise<ExtractedSchoolReference> {
    const { buffer, mimeType, originalName } = input;

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Buffer de arquivo vazio ou inválido.');
    }

    let rawText = '';
    const normMime = mimeType.toLowerCase();

    if (normMime === 'application/pdf' || originalName.endsWith('.pdf')) {
      const res = await this.pdfExtractor.extract(buffer);
      rawText = res.rawText;
    } else if (
      normMime.includes('word') ||
      normMime.includes('officedocument') ||
      originalName.endsWith('.docx')
    ) {
      const res = await this.docxExtractor.extract(buffer);
      rawText = res.rawText || res.html;
    } else if (
      normMime.startsWith('image/') ||
      ['.png', '.jpg', '.jpeg', '.webp'].some((ext) =>
        originalName.toLowerCase().endsWith(ext),
      )
    ) {
      const res = await this.visionExtractor.extract(buffer, normMime);
      rawText = res.rawText;
    } else {
      rawText = buffer.toString('utf-8');
    }

    return this.normalizeContent(rawText, originalName);
  }

  async normalizeContent(
    rawText: string,
    originalName?: string,
  ): Promise<ExtractedSchoolReference> {
    const textToAnalyze = `${originalName ?? ''}\n${rawText}`;

    // 1. Camada de Layout
    const suggestedGranularity = this.detectGranularity(textToAnalyze);
    const hierarchyLevels = this.detectHierarchyLevels(
      suggestedGranularity,
      textToAnalyze,
    );
    const columns = this.detectColumns(textToAnalyze);

    // 2. Camada de Dados
    const curricularComponent = await this.resolveCurricularComponent(textToAnalyze);
    const applicationYear = await this.resolveApplicationYear(textToAnalyze);
    const dates = this.detectDateRange(textToAnalyze);
    const bnccCodesFound = this.extractBnccCodes(textToAnalyze);
    const evaluationsFound = this.detectEvaluations(textToAnalyze);
    const rawLessonBlocks = this.extractLessonBlocks(rawText, columns);

    return {
      layout: {
        suggestedGranularity,
        hierarchyLevels,
        columns,
      },
      data: {
        curricularComponent: curricularComponent?.name,
        applicationYear: applicationYear?.name,
        dates,
        rawLessonBlocks,
        bnccCodesFound,
        evaluationsFound,
      },
      rawText,
    };
  }

  detectGranularity(text: string): PlanningGranularity {
    const norm = removeDiacritics(text).toLowerCase();
    if (/\b(trimestre|trimestral|1o trimestre|2o trimestre|3o trimestre)\b/i.test(norm)) {
      return 'TRIMESTER';
    }
    if (/\b(bimestre|bimestral|1o bimestre|2o bimestre|3o bimestre|4o bimestre)\b/i.test(norm)) {
      return 'BIMONTHLY';
    }
    if (/\b(semestre|semestral|1o semestre|2o semestre)\b/i.test(norm)) {
      return 'SEMESTER';
    }
    if (/\b(anual|plano anual|ano letivo)\b/i.test(norm)) {
      return 'ANNUAL';
    }
    if (/\b(mensal|plano mensal|mes de)\b/i.test(norm)) {
      return 'MONTHLY';
    }
    if (/\b(diario|diaria|plano de aula|aula individual)\b/i.test(norm)) {
      return 'DAILY';
    }
    return 'WEEKLY';
  }

  detectHierarchyLevels(
    suggested: PlanningGranularity,
    text: string,
  ): PlanningGranularity[] {
    const norm = removeDiacritics(text).toLowerCase();
    const hasWeekly = /\b(semana|semanal|semanas)\b/i.test(norm);
    const hasDaily = /\b(aula|aulas|diario|dia)\b/i.test(norm);

    switch (suggested) {
      case 'ANNUAL':
        return hasWeekly
          ? ['ANNUAL', 'MONTHLY', 'WEEKLY']
          : ['ANNUAL', 'MONTHLY'];
      case 'SEMESTER':
        return hasWeekly ? ['SEMESTER', 'WEEKLY'] : ['SEMESTER', 'MONTHLY'];
      case 'TRIMESTER':
        return hasWeekly ? ['TRIMESTER', 'WEEKLY'] : ['TRIMESTER', 'MONTHLY'];
      case 'BIMONTHLY':
        return hasWeekly ? ['BIMONTHLY', 'WEEKLY'] : ['BIMONTHLY'];
      case 'MONTHLY':
        return hasWeekly ? ['MONTHLY', 'WEEKLY'] : ['MONTHLY'];
      case 'WEEKLY':
        return hasDaily ? ['WEEKLY', 'DAILY'] : ['WEEKLY'];
      case 'DAILY':
      default:
        return ['DAILY'];
    }
  }

  detectColumns(text: string): ColumnDefinition[] {
    const norm = removeDiacritics(text).toLowerCase();
    const columns: ColumnDefinition[] = [];
    let orderCounter = 1;

    // Coluna Data / Período
    columns.push({
      name: 'data',
      customLabel: 'Data / Semana',
      isCore: true,
      targetTable: 'PLANNING_BLOCK',
      order: orderCounter++,
      detectedAvgCharLimit: 20,
    });

    // Coluna Conteúdo / Tema
    columns.push({
      name: 'conteudo',
      customLabel: 'Conteúdo / Tema',
      isCore: true,
      targetTable: 'PLANNING_BLOCK',
      order: orderCounter++,
      detectedAvgCharLimit: 120,
    });

    // Invariante Anti-Duplicação para Metodologia (01_DATA_MODEL.md Sec. 2 & 3):
    // Qualquer menção a Sequência Didática, Metodologia, Desenvolvimento ou Procedimentos
    // DEVE mapear estritamente para a coluna física metodologia.
    let customMetodologiaLabel = 'Metodologia';
    if (/\b(sequencia didatica)\b/i.test(norm)) {
      customMetodologiaLabel = 'Sequência Didática';
    } else if (/\b(desenvolvimento da aula|desenvolvimento)\b/i.test(norm)) {
      customMetodologiaLabel = 'Desenvolvimento da Aula';
    } else if (/\b(procedimentos metodologicos|procedimentos didaticos)\b/i.test(norm)) {
      customMetodologiaLabel = 'Procedimentos Metodológicos';
    }

    columns.push({
      name: 'metodologia',
      customLabel: customMetodologiaLabel,
      isCore: true,
      targetTable: 'PLANNING_BLOCK',
      order: orderCounter++,
      detectedAvgCharLimit: 250,
      sampleToneText:
        'Acolhimento com tempestade de ideias, leitura mediada e resolução colaborativa.',
    });

    // Habilidades / BNCC
    if (/\b(habilidade|bncc|codigo|habilidades)\b/i.test(norm)) {
      columns.push({
        name: 'habilidades',
        customLabel: 'Habilidades BNCC',
        isCore: true,
        targetTable: 'PLANNING_BLOCK',
        order: orderCounter++,
        detectedAvgCharLimit: 50,
      });
    }

    // Recursos Didáticos (dinâmica EAV não core)
    if (/\b(recurso|recursos didaticos|materiais)\b/i.test(norm)) {
      columns.push({
        name: 'recursos_didaticos',
        customLabel: 'Recursos Didáticos',
        isCore: false,
        targetTable: 'PLANNING_BLOCK',
        order: orderCounter++,
        detectedAvgCharLimit: 100,
      });
    }

    // Avaliação (dinâmica EAV ou instrumentos)
    if (/\b(avaliacao|instrumento avaliativo|rubrica)\b/i.test(norm)) {
      columns.push({
        name: 'avaliacao',
        customLabel: 'Avaliação da Aprendizagem',
        isCore: false,
        targetTable: 'PLANNING_BLOCK',
        order: orderCounter++,
        detectedAvgCharLimit: 100,
      });
    }

    // Observações
    if (/\b(observacao|observacoes|obs)\b/i.test(norm)) {
      columns.push({
        name: 'observacoes',
        customLabel: 'Observações Pedagógicas',
        isCore: false,
        targetTable: 'PLANNING_BLOCK',
        order: orderCounter++,
        detectedAvgCharLimit: 150,
      });
    }

    return columns;
  }

  async resolveCurricularComponent(
    text: string,
  ): Promise<{ id: string; name: string } | null> {
    let candidates = DEFAULT_CURRICULAR_COMPONENTS;

    if (this.prisma) {
      try {
        const dbComponents = await this.prisma.curricularComponent.findMany({
          select: { id: true, name: true },
        });
        if (dbComponents.length > 0) {
          candidates = dbComponents;
        }
      } catch (err) {
        this.logger.debug(
          `Usando catálogo padrão de componentes curriculares (${err instanceof Error ? err.message : String(err)})`,
        );
      }
    }

    return matchCurricularComponent(text, candidates);
  }

  async resolveApplicationYear(
    text: string,
  ): Promise<{ id: string; name: string } | null> {
    let candidates = DEFAULT_APPLICATION_YEARS;

    if (this.prisma) {
      try {
        const dbYears = await this.prisma.applicationYear.findMany({
          select: { id: true, name: true, stage: true },
        });
        if (dbYears.length > 0) {
          candidates = dbYears;
        }
      } catch (err) {
        this.logger.debug(
          `Usando catálogo padrão de anos de aplicação (${err instanceof Error ? err.message : String(err)})`,
        );
      }
    }

    return matchApplicationYear(text, candidates);
  }

  detectDateRange(text: string): { startAt?: string; endAt?: string } | undefined {
    const match = text.match(DATE_RANGE_REGEX);
    if (!match) return undefined;

    try {
      const [, d1, m1, y1, d2, m2, y2] = match;
      const fullYear1 = y1.length === 2 ? `20${y1}` : y1;
      const fullYear2 = y2.length === 2 ? `20${y2}` : y2;

      const date1 = new Date(
        Date.UTC(
          Number.parseInt(fullYear1, 10),
          Number.parseInt(m1, 10) - 1,
          Number.parseInt(d1, 10),
          12,
          0,
          0,
        ),
      );
      const date2 = new Date(
        Date.UTC(
          Number.parseInt(fullYear2, 10),
          Number.parseInt(m2, 10) - 1,
          Number.parseInt(d2, 10),
          12,
          0,
          0,
        ),
      );

      // Contenção Temporal Estrita: endAt não pode ser anterior a startAt
      if (date2 < date1) {
        return {
          startAt: date2.toISOString(),
          endAt: date1.toISOString(),
        };
      }

      return {
        startAt: date1.toISOString(),
        endAt: date2.toISOString(),
      };
    } catch {
      return undefined;
    }
  }

  extractBnccCodes(text: string): string[] {
    const matches = text.match(BNCC_CODE_REGEX);
    if (!matches) return [];
    return Array.from(new Set(matches.map((c) => c.toUpperCase())));
  }

  detectEvaluations(text: string): ExtractedEvaluation[] {
    const norm = removeDiacritics(text).toLowerCase();
    const evals: ExtractedEvaluation[] = [];
    const evalPatterns = [
      {
        regex: /\b(P1|P2|P3|P4)\b/i,
        type: 'P1',
        defaultName: 'Prova Periódica',
      },
      {
        regex: /\b(avaliacao parcial|parcial|PAR)\b/i,
        type: 'PAR',
        defaultName: 'Avaliação Parcial',
      },
      {
        regex: /\b(avaliacao global|global|GLB)\b/i,
        type: 'GLB',
        defaultName: 'Avaliação Global',
      },
      {
        regex: /\b(simulado|simulados)\b/i,
        type: 'Simulado',
        defaultName: 'Simulado Institucional',
      },
      {
        regex: /\b(trabalho em grupo|trabalho bimestral|trabalho)\b/i,
        type: 'Trabalho',
        defaultName: 'Trabalho de Pesquisa / Prático',
      },
      {
        regex: /\b(avaliacao qualitativa|qualitativa)\b/i,
        type: 'Qualitativa',
        defaultName: 'Avaliação Processual Contínua',
      },
    ];

    for (const pattern of evalPatterns) {
      if (pattern.regex.test(norm) || pattern.regex.test(text)) {
        evals.push({
          name: pattern.defaultName,
          instrumentType: pattern.type,
          description: `Instrumento avaliativo extraído do documento de referência (${pattern.defaultName}).`,
          grade: 10,
        });
      }
    }

    return evals;
  }

  extractLessonBlocks(
    rawText: string,
    columns: ColumnDefinition[],
  ): RawLessonBlock[] {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const blocks: RawLessonBlock[] = [];

    // Tenta encontrar linhas ou fragmentos indicando blocos/aulas/semanas
    let blockOrder = 1;
    for (const line of lines) {
      const isBlockIndicator =
        /\b(aula|semana|unidade|modulo)\s*(\d+)/i.test(line) ||
        /\b(\d{1,2}[/.-]\d{1,2})/i.test(line);

      if (isBlockIndicator) {
        const contentByColumn: Record<string, string> = {};
        for (const col of columns) {
          if (col.name !== 'data' && col.name !== 'metodologia') {
            contentByColumn[col.name] = line;
          }
        }

        blocks.push({
          order: blockOrder++,
          metodologia: `Desenvolvimento pedagógico planejado para o bloco: ${line}`,
          contentByColumn,
        });

        if (blocks.length >= 10) break; // Limite razoável para extração inicial de rascunho
      }
    }

    // Se nenhum bloco específico foi particionado, cria 1 bloco consolidado de exemplo
    if (blocks.length === 0 && rawText.trim().length > 0) {
      blocks.push({
        order: 1,
        metodologia: 'Metodologia e desenvolvimento pedagógico extraídos do documento.',
        contentByColumn: {
          conteudo: rawText.slice(0, 150).trim(),
        },
      });
    }

    return blocks;
  }
}
