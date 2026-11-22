import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExportPlanningUseCase } from './export-planning.use-case.js';

describe('ExportPlanningUseCase', () => {
  let useCase: ExportPlanningUseCase;
  let mockPrisma: any;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockPrisma = {
      session: {
        findUnique: vi.fn(),
      },
      planning: {
        findFirst: vi.fn(),
      },
      specification: {
        findMany: vi.fn(),
      },
    };

    useCase = new ExportPlanningUseCase(mockPrisma as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deve lançar NotFoundException quando a sessão não existir', async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute('session-1', { format: 'pdf' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deve lançar NotFoundException quando a sessão não tiver planejamento', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.planning.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute('session-1', { format: 'pdf' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deve lançar InternalServerErrorException quando a chamada HTTP ao engine falhar', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.planning.findFirst.mockResolvedValue({ id: 'plan-1', blocks: [] });
    mockPrisma.specification.findMany.mockResolvedValue([]);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(
      useCase.execute('session-1', { format: 'pdf' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('deve lançar InternalServerErrorException quando o engine retornar status de erro', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.planning.findFirst.mockResolvedValue({ id: 'plan-1', blocks: [] });
    mockPrisma.specification.findMany.mockResolvedValue([]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal error in Playwright'),
    });

    await expect(
      useCase.execute('session-1', { format: 'pdf' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('deve exportar com sucesso retornando buffer, contentType e filename para PDF', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.planning.findFirst.mockResolvedValue({ id: 'plan-1', blocks: [] });
    mockPrisma.specification.findMany.mockResolvedValue([]);

    const fakePdfBase64 = Buffer.from('%PDF-1.4 test').toString('base64');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="planejamento-aula-portrait.pdf"',
        },
        isBase64Encoded: true,
        body: fakePdfBase64,
      }),
    });

    const result = await useCase.execute('session-1', {
      format: 'pdf',
      orientation: 'portrait',
    });

    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toBe('planejamento-aula-portrait.pdf');
    expect(result.buffer.toString()).toBe('%PDF-1.4 test');
  });

  it('deve exportar com sucesso para formato DOCX', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.planning.findFirst.mockResolvedValue({ id: 'plan-1', blocks: [] });
    mockPrisma.specification.findMany.mockResolvedValue([]);

    const fakeDocxBase64 = Buffer.from('PK\x03\x04 fake docx').toString('base64');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        statusCode: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="planejamento-aula-landscape.docx"',
        },
        isBase64Encoded: true,
        body: fakeDocxBase64,
      }),
    });

    const result = await useCase.execute('session-1', {
      format: 'docx',
      orientation: 'landscape',
    });

    expect(result.contentType).toContain('wordprocessingml.document');
    expect(result.filename).toBe('planejamento-aula-landscape.docx');
    expect(result.buffer.toString()).toBe('PK\x03\x04 fake docx');
  });
});
