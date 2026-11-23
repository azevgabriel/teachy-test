import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';

@Injectable()
export class DocxExtractorService {
  private readonly logger = new Logger(DocxExtractorService.name);

  async extract(buffer: Buffer): Promise<{ rawText: string; html: string }> {
    try {
      const textResult = await mammoth.extractRawText({ buffer });
      const htmlResult = await mammoth.convertToHtml({ buffer });
      return {
        rawText: textResult?.value ?? '',
        html: htmlResult?.value ?? '',
      };
    } catch (err) {
      this.logger.error(
        `Erro ao extrair texto do DOCX: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
