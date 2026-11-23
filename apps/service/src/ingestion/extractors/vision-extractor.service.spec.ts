import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisionExtractorService } from './vision-extractor.service.js';

describe('VisionExtractorService', () => {
  let service: VisionExtractorService;

  beforeEach(() => {
    service = new VisionExtractorService();
  });

  it('extracts raw text from image buffer using Gemini Multimodal Vision', async () => {
    (service as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Matriz Curricular 2ª Série Ensino Médio - Física\nData: 03/08/2026 a 07/08/2026\nSequência Didática: Leis de Newton\nBNCC: EM13CNT101\nAvaliação: P1 Nota: 10',
        }),
      },
    };

    const buffer = Buffer.from('fake image');
    const result = await service.extract(buffer, 'image/png');

    expect(result.rawText).toContain('Matriz Curricular 2ª Série Ensino Médio');
    expect(result.rawText).toContain('EM13CNT101');
  });

  it('returns fallback text when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const noKeyService = new VisionExtractorService();
    const result = await noKeyService.extract(Buffer.from('img'), 'image/jpeg');

    expect(result.rawText).toContain('OCR indisponível');
  });
});
