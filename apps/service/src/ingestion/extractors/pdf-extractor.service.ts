import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);

  async extract(buffer: Buffer): Promise<{ rawText: string; pageCount: number }> {
    try {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const rawText = textResult?.text ?? '';
      const pageCount = textResult?.pages?.length ?? 1;
      await parser.destroy();
      return { rawText, pageCount };
    } catch (err) {
      this.logger.error(
        `Erro ao extrair texto do PDF: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
