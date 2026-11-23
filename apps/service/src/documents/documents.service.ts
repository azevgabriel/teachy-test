import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalStorageService } from './local-storage.service.js';

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
}
