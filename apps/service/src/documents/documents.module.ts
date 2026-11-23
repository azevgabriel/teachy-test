import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LocalStorageService } from './local-storage.service.js';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController],
  providers: [LocalStorageService, DocumentsService],
  exports: [LocalStorageService, DocumentsService],
})
export class DocumentsModule {}
