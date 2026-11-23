import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentsService } from './documents.service.js';
import { LocalStorageService } from './local-storage.service.js';

@Controller('api')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: any,
    @Query('sessionId') sessionId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.documentsService.uploadDocument(file, sessionId);
  }

  @Get('documents')
  async listDocuments(@Query('sessionId') sessionId?: string) {
    return this.documentsService.listDocuments(sessionId);
  }

  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    return this.documentsService.getDocument(id);
  }

  @Get('documents/:id/download')
  async downloadDocument(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.documentsService.getDocumentEntity(id);
    const fileStream = this.localStorageService.getFileStream(doc.localFilePath);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.originalName)}"`,
    );

    fileStream.pipe(res);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    return this.documentsService.deleteDocument(id);
  }

  @Post('sessions/:sessionId/documents/:documentId/link')
  async linkDocument(
    @Param('sessionId') sessionId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.linkDocumentToSession(sessionId, documentId);
  }

  @Delete('sessions/:sessionId/documents/:documentId/unlink')
  async unlinkDocument(
    @Param('sessionId') sessionId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.unlinkDocumentFromSession(sessionId, documentId);
  }

  @Get('sessions/:sessionId/documents')
  async listSessionDocuments(@Param('sessionId') sessionId: string) {
    return this.documentsService.listSessionDocuments(sessionId);
  }

  @Get('documents/:id/extract')
  async extractDocument(@Param('id') id: string) {
    return this.documentsService.extractDocument(id);
  }

  @Post('documents/:id/extract')
  async triggerExtractDocument(@Param('id') id: string) {
    return this.documentsService.extractDocument(id);
  }
}
