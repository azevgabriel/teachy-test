import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PdfExtractorService } from './extractors/pdf-extractor.service.js';
import { DocxExtractorService } from './extractors/docx-extractor.service.js';
import { VisionExtractorService } from './extractors/vision-extractor.service.js';
import { ContentExtractionPipeline } from './content-extraction.pipeline.js';

@Module({
  imports: [PrismaModule],
  providers: [
    PdfExtractorService,
    DocxExtractorService,
    VisionExtractorService,
    ContentExtractionPipeline,
  ],
  exports: [
    PdfExtractorService,
    DocxExtractorService,
    VisionExtractorService,
    ContentExtractionPipeline,
  ],
})
export class IngestionModule {}
