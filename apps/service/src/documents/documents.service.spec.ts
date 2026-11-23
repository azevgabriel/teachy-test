import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsService } from './documents.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { LocalStorageService } from './local-storage.service.js';
import type { ContentExtractionPipeline } from '../ingestion/content-extraction.pipeline.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaMock: any;
  let localStorageMock: any;
  let extractionPipelineMock: any;

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
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    localStorageMock = {
      saveFile: vi.fn(),
      getFileStream: vi.fn(),
      deleteFile: vi.fn(),
      readFile: vi.fn(),
    };

    extractionPipelineMock = {
      extract: vi.fn(),
    };

    service = new DocumentsService(
      prismaMock as unknown as PrismaService,
      localStorageMock as unknown as LocalStorageService,
      extractionPipelineMock as unknown as ContentExtractionPipeline,
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

  describe('listSessionDocuments', () => {
    it('returns only documents linked to the requested session', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.referenceDocument.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          originalName: 'arq1.pdf',
          storedFileName: 'uuid1.pdf',
          mimeType: 'application/pdf',
          fileSize: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await service.listSessionDocuments('s1');

      expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
      expect(prismaMock.referenceDocument.findMany).toHaveBeenCalledWith({
        where: { sessions: { some: { id: 's1' } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(res).toHaveLength(1);
      expect(res[0].isLinkedToSession).toBe(true);
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

    it('unlinks document from session without deleting from global repository', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.referenceDocument.findUnique.mockResolvedValue({ id: 'd1' });

      const res = await service.unlinkDocumentFromSession('s1', 'd1');
      expect(res.success).toBe(true);
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { referenceDocuments: { disconnect: { id: 'd1' } } },
      });
      // Verifies referenceDocument.delete and localStorage.deleteFile are NEVER called on unlink
      expect(prismaMock.referenceDocument.delete).not.toHaveBeenCalled();
      expect(localStorageMock.deleteFile).not.toHaveBeenCalled();
    });

    it('supports multi-session linking and preserves document when unlinked from one session', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.referenceDocument.findUnique.mockResolvedValue({
        id: 'doc-shared',
        originalName: 'matriz.pdf',
      });

      // Link to session 1
      await service.linkDocumentToSession('s1', 'doc-shared');
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { referenceDocuments: { connect: { id: 'doc-shared' } } },
      });

      // Link to session 2
      prismaMock.session.findUnique.mockResolvedValue({ id: 's2' });
      await service.linkDocumentToSession('s2', 'doc-shared');
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: { referenceDocuments: { connect: { id: 'doc-shared' } } },
      });

      // Unlink from session 1
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1' });
      await service.unlinkDocumentFromSession('s1', 'doc-shared');
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { referenceDocuments: { disconnect: { id: 'doc-shared' } } },
      });

      // Global reference document is NOT deleted
      expect(prismaMock.referenceDocument.delete).not.toHaveBeenCalled();
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

  describe('extractDocument', () => {
    it('throws NotFoundException when document does not exist', async () => {
      prismaMock.referenceDocument.findUnique.mockResolvedValue(null);
      await expect(service.extractDocument('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns cached extraction without reading disk or running pipeline when cached', async () => {
      const cachedData = {
        layout: {
          suggestedGranularity: 'BIMONTHLY',
          hierarchyLevels: ['BIMONTHLY', 'WEEKLY'],
          columns: [{ name: 'metodologia', isCore: true }],
        },
        data: {
          curricularComponent: 'Matemática',
          applicationYear: '3º ano do Ensino Fundamental I',
        },
      };

      prismaMock.referenceDocument.findUnique.mockResolvedValue({
        id: 'doc-cached',
        extractedText: 'Extracted raw text cached',
        extractedData: cachedData,
      });

      const result = await service.extractDocument('doc-cached');

      expect(result).toEqual({
        layout: cachedData.layout,
        data: cachedData.data,
        rawText: 'Extracted raw text cached',
      });
      expect(localStorageMock.readFile).not.toHaveBeenCalled();
      expect(extractionPipelineMock.extract).not.toHaveBeenCalled();
      expect(prismaMock.referenceDocument.update).not.toHaveBeenCalled();
    });

    it('processes document on cache miss, updates database cache, and returns extracted data', async () => {
      prismaMock.referenceDocument.findUnique.mockResolvedValue({
        id: 'doc-uncached',
        localFilePath: '/tmp/doc.pdf',
        mimeType: 'application/pdf',
        originalName: 'doc.pdf',
        extractedText: null,
        extractedData: null,
      });

      const fileBuffer = Buffer.from('pdf contents');
      localStorageMock.readFile.mockResolvedValue(fileBuffer);

      const mockExtracted = {
        layout: {
          suggestedGranularity: 'ANNUAL',
          hierarchyLevels: ['ANNUAL', 'MONTHLY'],
          columns: [{ name: 'metodologia', isCore: true }],
        },
        data: {
          curricularComponent: 'Física',
          applicationYear: '1ª série do Ensino Médio',
        },
        rawText: 'Física EM 1ª série',
      };
      extractionPipelineMock.extract.mockResolvedValue(mockExtracted);

      const result = await service.extractDocument('doc-uncached');

      expect(localStorageMock.readFile).toHaveBeenCalledWith('/tmp/doc.pdf');
      expect(extractionPipelineMock.extract).toHaveBeenCalledWith({
        buffer: fileBuffer,
        mimeType: 'application/pdf',
        originalName: 'doc.pdf',
      });
      expect(prismaMock.referenceDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-uncached' },
        data: {
          extractedText: mockExtracted.rawText,
          extractedData: {
            layout: mockExtracted.layout,
            data: mockExtracted.data,
          },
        },
      });
      expect(result).toEqual(mockExtracted);
    });
  });
});
