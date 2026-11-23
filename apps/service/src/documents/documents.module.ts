import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { LocalStorageService } from './local-storage.service.js';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';

@Module({
  imports: [PrismaModule, IngestionModule],
  controllers: [DocumentsController],
  providers: [LocalStorageService, DocumentsService],
  exports: [LocalStorageService, DocumentsService],
})
export class DocumentsModule {}
