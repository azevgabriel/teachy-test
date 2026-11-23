import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfExtractorService } from './pdf-extractor.service.js';

vi.mock('pdf-parse', () => {
  return {
    PDFParse: class {
      async getText() {
        return {
          text: 'Planejamento 3º Ano EF Matemática\nSemana 1: Números e Operações\nMetodologia: Resolução de problemas\nHabilidade: EF03MA01',
          pages: [{ pageNumber: 1 }],
        };
      }
      async destroy() {}
    },
  };
});

describe('PdfExtractorService', () => {
  let service: PdfExtractorService;

  beforeEach(() => {
    service = new PdfExtractorService();
  });

  it('extracts raw text and page count from PDF buffer', async () => {
    const buffer = Buffer.from('%PDF-1.4 test buffer');
    const result = await service.extract(buffer);

    expect(result.rawText).toContain('Planejamento 3º Ano EF Matemática');
    expect(result.pageCount).toBe(1);
  });
});
