import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsService } from './documents.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { LocalStorageService } from './local-storage.service.js';
import { BadRequestException } from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaMock: any;
  let localStorageMock: any;

  beforeEach(() => {
    prismaMock = {
      session: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      referenceDocument: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    };

    localStorageMock = {
      saveFile: vi.fn(),
      getFileStream: vi.fn(),
      deleteFile: vi.fn(),
    };

    service = new DocumentsService(
      prismaMock as unknown as PrismaService,
      localStorageMock as unknown as LocalStorageService,
    );
  });

  describe('uploadDocument', () => {
    it('rejects file when mimetype is not in allowlist', async () => {
      const file = {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('exec'),
      };

      await expect(service.uploadDocument(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects file when size exceeds 20MB', async () => {
      const file = {
        originalname: 'grande.pdf',
        mimetype: 'application/pdf',
        size: 25 * 1024 * 1024,
        buffer: Buffer.alloc(100),
      };

      await expect(service.uploadDocument(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully uploads valid PDF and creates ReferenceDocument', async () => {
      const file = {
        originalname: 'planejamento.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('pdf data'),
      };

      localStorageMock.saveFile.mockResolvedValue({
        storedFileName: 'stored-uuid.pdf',
        localFilePath: '/tmp/teachy-uploads/stored-uuid.pdf',
      });

      prismaMock.referenceDocument.create.mockResolvedValue({
        id: 'doc-1',
        originalName: 'planejamento.pdf',
        storedFileName: 'stored-uuid.pdf',
        localFilePath: '/tmp/teachy-uploads/stored-uuid.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        createdAt: new Date('2026-11-23T00:00:00Z'),
        updatedAt: new Date('2026-11-23T00:00:00Z'),
      });

      const res = await service.uploadDocument(file);

      expect(res.id).toBe('doc-1');
      expect(res.originalName).toBe('planejamento.pdf');
      expect(res.url).toBe('/api/documents/doc-1/download');
      expect(prismaMock.referenceDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalName: 'planejamento.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
        }),
      });
    });

    it('links to session when sessionId is provided', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1', name: 'Sessão 1' });
      localStorageMock.saveFile.mockResolvedValue({
        storedFileName: 'doc.docx',
        localFilePath: '/tmp/doc.docx',
      });
      prismaMock.referenceDocument.create.mockResolvedValue({
        id: 'doc-2',
        originalName: 'doc.docx',
        storedFileName: 'doc.docx',
        localFilePath: '/tmp/doc.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.uploadDocument(
        {
          originalname: 'doc.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 1000,
          buffer: Buffer.from('docx'),
        },
        's1',
      );

      expect(res.isLinkedToSession).toBe(true);
      expect(prismaMock.referenceDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessions: { connect: { id: 's1' } },
        }),
      });
    });
  });

  describe('listDocuments', () => {
    it('returns all documents with isLinkedToSession indicator', async () => {
      prismaMock.referenceDocument.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          originalName: 'arq1.pdf',
          storedFileName: 'uuid1.pdf',
          mimeType: 'application/pdf',
          fileSize: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          sessions: [{ id: 's1' }],
        },
        {
          id: 'doc-2',
          originalName: 'arq2.png',
          storedFileName: 'uuid2.png',
          mimeType: 'image/png',
          fileSize: 200,
          createdAt: new Date(),
          updatedAt: new Date(),
          sessions: [],
        },
      ]);

      const res = await service.listDocuments('s1');

      expect(res).toHaveLength(2);
      expect(res[0].isLinkedToSession).toBe(true);
      expect(res[1].isLinkedToSession).toBe(false);
    });
  });

  describe('link / unlink', () => {
    it('links document to session', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.referenceDocument.findUnique.mockResolvedValue({ id: 'd1' });

      const res = await service.linkDocumentToSession('s1', 'd1');
      expect(res.success).toBe(true);
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { referenceDocuments: { connect: { id: 'd1' } } },
      });
    });

    it('unlinks document from session', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1' });

      const res = await service.unlinkDocumentFromSession('s1', 'd1');
      expect(res.success).toBe(true);
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { referenceDocuments: { disconnect: { id: 'd1' } } },
      });
    });
  });

  describe('deleteDocument', () => {
    it('deletes document from disk and database', async () => {
      prismaMock.referenceDocument.findUnique.mockResolvedValue({
        id: 'd1',
        localFilePath: '/tmp/test.pdf',
      });
      localStorageMock.deleteFile.mockResolvedValue(true);

      const res = await service.deleteDocument('d1');
      expect(res.success).toBe(true);
      expect(localStorageMock.deleteFile).toHaveBeenCalledWith('/tmp/test.pdf');
      expect(prismaMock.referenceDocument.delete).toHaveBeenCalledWith({
        where: { id: 'd1' },
      });
    });
  });
});
