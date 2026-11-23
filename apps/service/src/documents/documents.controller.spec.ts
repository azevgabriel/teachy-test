import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsController } from './documents.controller.js';
import type { DocumentsService } from './documents.service.js';
import type { LocalStorageService } from './local-storage.service.js';
import { BadRequestException } from '@nestjs/common';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentsServiceMock: any;
  let localStorageServiceMock: any;

  beforeEach(() => {
    documentsServiceMock = {
      uploadDocument: vi.fn(),
      listDocuments: vi.fn(),
      getDocument: vi.fn(),
      getDocumentEntity: vi.fn(),
      linkDocumentToSession: vi.fn(),
      unlinkDocumentFromSession: vi.fn(),
      deleteDocument: vi.fn(),
    };

    localStorageServiceMock = {
      getFileStream: vi.fn(),
    };

    controller = new DocumentsController(
      documentsServiceMock as unknown as DocumentsService,
      localStorageServiceMock as unknown as LocalStorageService,
    );
  });

  it('rejects upload when file is missing', async () => {
    await expect(controller.uploadDocument(null)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('delegates upload to documentsService', async () => {
    const file = { originalname: 'doc.pdf' };
    documentsServiceMock.uploadDocument.mockResolvedValue({ id: 'doc-1' });

    const res = await controller.uploadDocument(file, 's1');
    expect(documentsServiceMock.uploadDocument).toHaveBeenCalledWith(file, 's1');
    expect(res).toEqual({ id: 'doc-1' });
  });

  it('lists documents with optional sessionId filter', async () => {
    documentsServiceMock.listDocuments.mockResolvedValue([{ id: 'doc-1' }]);

    const res = await controller.listDocuments('s1');
    expect(documentsServiceMock.listDocuments).toHaveBeenCalledWith('s1');
    expect(res).toEqual([{ id: 'doc-1' }]);
  });

  it('links and unlinks document from session', async () => {
    documentsServiceMock.linkDocumentToSession.mockResolvedValue({ success: true });
    documentsServiceMock.unlinkDocumentFromSession.mockResolvedValue({ success: true });

    expect(await controller.linkDocument('s1', 'd1')).toEqual({ success: true });
    expect(await controller.unlinkDocument('s1', 'd1')).toEqual({ success: true });
  });
});
