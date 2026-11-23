import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class VisionExtractorService {
  private readonly logger = new Logger(VisionExtractorService.name);
  private client: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async extract(buffer: Buffer, mimeType: string): Promise<{ rawText: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!this.client && apiKey && apiKey.trim().length > 0) {
      this.client = new GoogleGenAI({ apiKey });
    }

    if (!this.client) {
      this.logger.warn(
        'GEMINI_API_KEY não configurada no servidor. Retornando texto de fallback para OCR.',
      );
      return {
        rawText:
          '[Imagem de referência anexada - OCR indisponível sem chave de API Gemini]',
      };
    }

    try {
      const response = await this.client.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: buffer.toString('base64'),
                },
              },
              {
                text: 'Você é um especialista em OCR e transcrição de matrizes curriculares e planejamentos escolares brasileiros. Transcreva todo o conteúdo textual e estrutural desta imagem preservando seções, cabeçalhos, disciplinas, anos escolares, datas, tabelas de aulas, metodologias, códigos de habilidades BNCC e avaliações.',
              },
            ],
          },
        ],
      });

      const rawText = response.text || '';
      return { rawText };
    } catch (err) {
      this.logger.error(
        `Erro no OCR via Gemini Vision: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
