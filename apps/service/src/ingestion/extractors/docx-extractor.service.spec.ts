import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocxExtractorService } from './docx-extractor.service.js';

vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({
      value:
        'Planejamento Trimestral de Língua Portuguesa\nDesenvolvimento da Aula: Leitura e escrita\nBNCC: EF15LP01',
    }),
    convertToHtml: vi.fn().mockResolvedValue({
      value:
        '<p>Planejamento Trimestral de Língua Portuguesa</p><table><tr><td>Desenvolvimento da Aula: Leitura e escrita</td></tr></table>',
    }),
  },
}));

describe('DocxExtractorService', () => {
  let service: DocxExtractorService;

  beforeEach(() => {
    service = new DocxExtractorService();
  });

  it('extracts raw text and HTML from DOCX buffer', async () => {
    const buffer = Buffer.from('fake docx');
    const result = await service.extract(buffer);

    expect(result.rawText).toContain(
      'Planejamento Trimestral de Língua Portuguesa',
    );
    expect(result.html).toContain('<table>');
  });
});
