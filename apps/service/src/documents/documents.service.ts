import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalStorageService } from './local-storage.service.js';
import { ContentExtractionPipeline } from '../ingestion/content-extraction.pipeline.js';
import type { ExtractedSchoolReference } from '../ingestion/types.js';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export interface UploadedFileDto {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DocumentResponseDto {
  id: string;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  url: string;
  isLinkedToSession?: boolean;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localStorageService: LocalStorageService,
    @Optional() private readonly extractionPipeline?: ContentExtractionPipeline,
  ) {}

  validateFile(file: UploadedFileDto): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido. Apenas PDF, DOCX, PNG, JPEG e WebP são aceitos.',
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'Arquivo excede o tamanho máximo permitido de 20MB.',
      );
    }
  }

  async uploadDocument(
    file: UploadedFileDto,
    sessionId?: string,
  ): Promise<DocumentResponseDto> {
    this.validateFile(file);

    if (sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        throw new NotFoundException(`Sessão ${sessionId} não encontrada.`);
      }
    }

    const saved = await this.localStorageService.saveFile({
      originalname: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
    });

    const doc = await this.prisma.referenceDocument.create({
      data: {
        originalName: file.originalname,
        storedFileName: saved.storedFileName,
        localFilePath: saved.localFilePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        sessions: sessionId ? { connect: { id: sessionId } } : undefined,
      },
    });

    return {
      id: doc.id,
      originalName: doc.originalName,
      storedFileName: doc.storedFileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      url: `/api/documents/${doc.id}/download`,
      isLinkedToSession: Boolean(sessionId),
    };
  }

  async listDocuments(sessionId?: string): Promise<DocumentResponseDto[]> {
    const docs = await this.prisma.referenceDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          select: { id: true },
        },
      },
    });

    return docs.map((doc: any) => ({
      id: doc.id,
      originalName: doc.originalName,
      storedFileName: doc.storedFileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      url: `/api/documents/${doc.id}/download`,
      isLinkedToSession: sessionId
        ? doc.sessions.some((s: { id: string }) => s.id === sessionId)
        : false,
    }));
  }

  async getDocument(id: string): Promise<DocumentResponseDto> {
    const doc = await this.prisma.referenceDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado.`);
    }

    return {
      id: doc.id,
      originalName: doc.originalName,
      storedFileName: doc.storedFileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      url: `/api/documents/${doc.id}/download`,
    };
  }

  async getDocumentEntity(id: string) {
    const doc = await this.prisma.referenceDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado.`);
    }

    return doc;
  }

  async linkDocumentToSession(
    sessionId: string,
    documentId: string,
  ): Promise<{ success: boolean }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Sessão ${sessionId} não encontrada.`);
    }

    const doc = await this.prisma.referenceDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException(`Documento ${documentId} não encontrado.`);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        referenceDocuments: {
          connect: { id: documentId },
        },
      },
    });

    return { success: true };
  }

  async unlinkDocumentFromSession(
    sessionId: string,
    documentId: string,
  ): Promise<{ success: boolean }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Sessão ${sessionId} não encontrada.`);
    }

    const doc = await this.prisma.referenceDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException(`Documento ${documentId} não encontrado.`);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        referenceDocuments: {
          disconnect: { id: documentId },
        },
      },
    });

    return { success: true };
  }

  async listSessionDocuments(sessionId: string): Promise<DocumentResponseDto[]> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Sessão ${sessionId} não encontrada.`);
    }

    const docs = await this.prisma.referenceDocument.findMany({
      where: {
        sessions: {
          some: { id: sessionId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((doc: any) => ({
      id: doc.id,
      originalName: doc.originalName,
      storedFileName: doc.storedFileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      url: `/api/documents/${doc.id}/download`,
      isLinkedToSession: true,
    }));
  }

  async deleteDocument(id: string): Promise<{ success: boolean }> {
    const doc = await this.prisma.referenceDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado.`);
    }

    await this.localStorageService.deleteFile(doc.localFilePath);

    await this.prisma.referenceDocument.delete({
      where: { id },
    });

    return { success: true };
  }

  async extractDocument(id: string): Promise<ExtractedSchoolReference> {
    const doc = await this.prisma.referenceDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado.`);
    }

    // 1. Cache hit: se já possui extractedText e extractedData, retorna diretamente do cache sem re-processamento
    if (doc.extractedText && doc.extractedData) {
      return {
        ...(doc.extractedData as unknown as ExtractedSchoolReference),
        rawText: doc.extractedText,
      };
    }

    if (!this.extractionPipeline) {
      throw new BadRequestException('Pipeline de extração não configurado.');
    }

    const buffer = await this.localStorageService.readFile(doc.localFilePath);
    const result = await this.extractionPipeline.extract({
      buffer,
      mimeType: doc.mimeType,
      originalName: doc.originalName,
    });

    // 2. Cache miss: grava o resultado do parsing no cache do ReferenceDocument (#48)
    await this.prisma.referenceDocument.update({
      where: { id },
      data: {
        extractedText: result.rawText,
        extractedData: {
          layout: result.layout,
          data: result.data,
        } as any,
      },
    });

    return result;
  }
}
