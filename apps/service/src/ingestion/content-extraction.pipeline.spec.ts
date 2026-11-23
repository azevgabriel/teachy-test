import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ContentExtractionPipeline } from './content-extraction.pipeline.js';
import type { PdfExtractorService } from './extractors/pdf-extractor.service.js';
import type { DocxExtractorService } from './extractors/docx-extractor.service.js';
import type { VisionExtractorService } from './extractors/vision-extractor.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('ContentExtractionPipeline', () => {
  let pipeline: ContentExtractionPipeline;
  let pdfExtractorMock: any;
  let docxExtractorMock: any;
  let visionExtractorMock: any;
  let prismaMock: any;

  beforeEach(() => {
    pdfExtractorMock = {
      extract: vi.fn(),
    };
    docxExtractorMock = {
      extract: vi.fn(),
    };
    visionExtractorMock = {
      extract: vi.fn(),
    };
    prismaMock = {
      curricularComponent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      applicationYear: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    pipeline = new ContentExtractionPipeline(
      pdfExtractorMock as unknown as PdfExtractorService,
      docxExtractorMock as unknown as DocxExtractorService,
      visionExtractorMock as unknown as VisionExtractorService,
      prismaMock as unknown as PrismaService,
    );
  });

  describe('Validation & Routing', () => {
    it('throws BadRequestException when buffer is empty', async () => {
      await expect(
        pipeline.extract({
          buffer: Buffer.alloc(0),
          mimeType: 'application/pdf',
          originalName: 'test.pdf',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('routes PDF file to PdfExtractorService', async () => {
      pdfExtractorMock.extract.mockResolvedValue({
        rawText: 'Planejamento Bimestral de Matemática\n3º ano do Ensino Fundamental I\n01/02/2026 a 30/04/2026\nSequência Didática: Frações\nEF03MA05',
        pageCount: 1,
      });

      const buffer = Buffer.from('dummy-pdf');
      const result = await pipeline.extract({
        buffer,
        mimeType: 'application/pdf',
        originalName: 'plano.pdf',
      });

      expect(pdfExtractorMock.extract).toHaveBeenCalledWith(buffer);
      expect(result.rawText).toContain('Planejamento Bimestral de Matemática');
      expect(result.layout.suggestedGranularity).toBe('BIMONTHLY');
    });

    it('routes DOCX file to DocxExtractorService', async () => {
      docxExtractorMock.extract.mockResolvedValue({
        rawText: 'Plano Trimestral de Língua Portuguesa\n1º ano do Ensino Fundamental I\nDesenvolvimento da Aula: Contos de Fadas\nEF15LP01\nAvaliação: P1 e Simulado',
        html: '<p>Plano Trimestral</p>',
      });

      const buffer = Buffer.from('dummy-docx');
      const result = await pipeline.extract({
        buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        originalName: 'plano.docx',
      });

      expect(docxExtractorMock.extract).toHaveBeenCalledWith(buffer);
      expect(result.layout.suggestedGranularity).toBe('TRIMESTER');
      expect(result.data.curricularComponent).toBe('Língua Portuguesa');
    });

    it('routes Image file (PNG/JPEG/WebP) to VisionExtractorService', async () => {
      visionExtractorMock.extract.mockResolvedValue({
        rawText: 'Planejamento Anual 1ª série do Ensino Médio - Física\n01/02/2026 a 15/12/2026\nEM13CNT101\nProcedimentos Metodológicos: Experimentos de Óptica',
      });

      const buffer = Buffer.from('dummy-image');
      const result = await pipeline.extract({
        buffer,
        mimeType: 'image/png',
        originalName: 'quadro.png',
      });

      expect(visionExtractorMock.extract).toHaveBeenCalledWith(buffer, 'image/png');
      expect(result.layout.suggestedGranularity).toBe('ANNUAL');
      expect(result.data.applicationYear).toBe('1ª série do Ensino Médio');
    });
  });

  describe('Methodology Anti-Duplication Invariant (01_DATA_MODEL.md)', () => {
    it('maps "Sequência Didática" to native physical column metodologia with targetTable PLANNING_BLOCK and isCore true', async () => {
      const text = 'Plano de Aula\nSequência Didática: Investigação científica e debate guiado';
      const result = await pipeline.normalizeContent(text, 'plano.txt');

      const metodologiaCol = result.layout.columns.find((c) => c.name === 'metodologia');
      expect(metodologiaCol).toBeDefined();
      expect(metodologiaCol?.isCore).toBe(true);
      expect(metodologiaCol?.targetTable).toBe('PLANNING_BLOCK');
      expect(metodologiaCol?.customLabel).toBe('Sequência Didática');

      // Não pode haver coluna EAV duplicada para sequência didática
      const adHocMetodologia = result.layout.columns.filter((c) =>
        c.name.includes('sequencia') || c.name.includes('metodologia'),
      );
      expect(adHocMetodologia.length).toBe(1);
    });

    it('maps "Desenvolvimento da Aula" to native physical column metodologia', async () => {
      const text = 'Plano de Aula\nDesenvolvimento da Aula: Rotação por estações';
      const result = await pipeline.normalizeContent(text, 'plano.txt');

      const col = result.layout.columns.find((c) => c.name === 'metodologia');
      expect(col).toBeDefined();
      expect(col?.isCore).toBe(true);
      expect(col?.targetTable).toBe('PLANNING_BLOCK');
      expect(col?.customLabel).toBe('Desenvolvimento da Aula');
    });

    it('maps "Procedimentos Metodológicos" to native physical column metodologia', async () => {
      const text = 'Plano Semanal\nProcedimentos Metodológicos: Leitura compartilhada';
      const result = await pipeline.normalizeContent(text, 'plano.txt');

      const col = result.layout.columns.find((c) => c.name === 'metodologia');
      expect(col).toBeDefined();
      expect(col?.isCore).toBe(true);
      expect(col?.targetTable).toBe('PLANNING_BLOCK');
      expect(col?.customLabel).toBe('Procedimentos Metodológicos');
    });
  });

  describe('Academic Catalog Matching & Stages', () => {
    it('correctly matches Fundamental I discipline vs Early Childhood field of experience', async () => {
      const textEF = 'Planejamento de Língua Portuguesa para o 2º ano do Ensino Fundamental I';
      const resEF = await pipeline.normalizeContent(textEF, 'ef.txt');
      expect(resEF.data.curricularComponent).toBe('Língua Portuguesa');
      expect(resEF.data.applicationYear).toBe('2º ano do Ensino Fundamental I');

      const textEI = 'Plano de Educação Infantil - Bebês\nCampo de Experiência: Corpo, gestos e movimentos\nEI01CG01';
      const resEI = await pipeline.normalizeContent(textEI, 'ei.txt');
      expect(resEI.data.curricularComponent).toBe('Corpo, gestos e movimentos');
      expect(resEI.data.applicationYear).toBe('Bebês (zero a 1 ano e 6 meses)');
    });

    it('correctly resolves 3º ano EF I vs 3ª série Ensino Médio', async () => {
      const textEF3 = 'Planejamento do 3º ano do Ensino Fundamental I de Ciências';
      const resEF3 = await pipeline.normalizeContent(textEF3, 'ef3.txt');
      expect(resEF3.data.applicationYear).toBe('3º ano do Ensino Fundamental I');

      const textEM3 = 'Planejamento da 3ª série do Ensino Médio de Biologia';
      const resEM3 = await pipeline.normalizeContent(textEM3, 'em3.txt');
      expect(resEM3.data.applicationYear).toBe('3ª série do Ensino Médio');
    });
  });

  describe('Temporal Hierarchy & Containment', () => {
    it('detects date range correctly when dates are in chronological order', async () => {
      const text = 'Período letivo: 10/02/2026 a 28/04/2026';
      const result = await pipeline.normalizeContent(text);

      expect(result.data.dates).toBeDefined();
      expect(result.data.dates?.startAt).toContain('2026-02-10');
      expect(result.data.dates?.endAt).toContain('2026-04-28');
    });

    it('enforces temporal containment by reordering dates if endAt is before startAt', async () => {
      // Inversão: 28/04/2026 a 10/02/2026
      const text = 'Período invertido: 28/04/2026 a 10/02/2026';
      const result = await pipeline.normalizeContent(text);

      expect(result.data.dates).toBeDefined();
      expect(new Date(result.data.dates!.startAt!).getTime()).toBeLessThanOrEqual(
        new Date(result.data.dates!.endAt!).getTime(),
      );
      expect(result.data.dates?.startAt).toContain('2026-02-10');
      expect(result.data.dates?.endAt).toContain('2026-04-28');
    });
  });

  describe('BNCC Codes Extraction & Deduplication', () => {
    it('extracts and deduplicates BNCC codes from different educational stages', async () => {
      const text = `
        Competências desenvolvidas:
        EF01LP01, EF01LP02, ef01lp01 (repetido em minúsculo)
        EM13MAT301, EI02TS01
      `;
      const result = await pipeline.normalizeContent(text);

      expect(result.data.bnccCodesFound).toEqual([
        'EF01LP01',
        'EF01LP02',
        'EM13MAT301',
        'EI02TS01',
      ]);
    });
  });

  describe('Brazilian Evaluations Catalog', () => {
    it('detects evaluation instruments (P1, PAR, GLB, Simulado, Trabalho, Qualitativa)', async () => {
      const text = `
        Instrumentos de avaliação:
        - Avaliação Parcial (PAR)
        - Simulado Enem
        - Trabalho bimestral em grupo
        - Avaliação qualitativa formativa
      `;
      const result = await pipeline.normalizeContent(text);

      const types = result.data.evaluationsFound.map((e) => e.instrumentType);
      expect(types).toContain('PAR');
      expect(types).toContain('Simulado');
      expect(types).toContain('Trabalho');
      expect(types).toContain('Qualitativa');
    });
  });

  describe('Hierarchy Levels & Granularity', () => {
    it('derives hierarchy levels according to suggested granularity and content indicators', () => {
      expect(pipeline.detectHierarchyLevels('ANNUAL', 'Plano com semanas letivas')).toEqual([
        'ANNUAL',
        'MONTHLY',
        'WEEKLY',
      ]);
      expect(pipeline.detectHierarchyLevels('BIMONTHLY', 'Bimestre com semanas de aula')).toEqual([
        'BIMONTHLY',
        'WEEKLY',
      ]);
      expect(pipeline.detectHierarchyLevels('WEEKLY', 'Semana com aulas diárias')).toEqual([
        'WEEKLY',
        'DAILY',
      ]);
      expect(pipeline.detectHierarchyLevels('DAILY', 'Aula')).toEqual(['DAILY']);
    });
  });
});
