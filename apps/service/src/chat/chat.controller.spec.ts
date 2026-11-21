import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatController } from './chat.controller.js';
import type { ChatService } from './chat.service.js';
import { BadRequestException } from '@nestjs/common';

describe('ChatController', () => {
  let controller: ChatController;
  let chatServiceMock: any;

  beforeEach(() => {
    chatServiceMock = {
      listSessions: vi.fn(),
      getSession: vi.fn(),
      createSession: vi.fn(),
      renameSession: vi.fn(),
      deleteSession: vi.fn(),
      processMessageStream: vi.fn(),
    };

    controller = new ChatController(chatServiceMock as unknown as ChatService);
  });

  describe('listSessions', () => {
    it('delegates to chatService.listSessions', async () => {
      chatServiceMock.listSessions.mockResolvedValue([{ id: 's1', name: 'Chat 1' }]);
      const res = await controller.listSessions();
      expect(res).toEqual([{ id: 's1', name: 'Chat 1' }]);
    });
  });

  describe('getSession', () => {
    it('delegates to chatService.getSession with id', async () => {
      chatServiceMock.getSession.mockResolvedValue({ id: 's1', name: 'Chat 1' });
      const res = await controller.getSession('s1');
      expect(chatServiceMock.getSession).toHaveBeenCalledWith('s1');
      expect(res).toEqual({ id: 's1', name: 'Chat 1' });
    });
  });

  describe('createSession', () => {
    it('validates schema and delegates to chatService.createSession', async () => {
      chatServiceMock.createSession.mockResolvedValue({ id: 's2', name: 'Novo' });
      const res = await controller.createSession({ name: 'Novo' });
      expect(chatServiceMock.createSession).toHaveBeenCalledWith({ name: 'Novo' });
      expect(res).toEqual({ id: 's2', name: 'Novo' });
    });

    it('rejects invalid body format', async () => {
      await expect(controller.createSession({ name: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('renameSession', () => {
    it('validates schema and delegates to chatService.renameSession', async () => {
      chatServiceMock.renameSession.mockResolvedValue({ id: 's1', name: 'Renomeado' });
      const res = await controller.renameSession('s1', { name: 'Renomeado' });
      expect(chatServiceMock.renameSession).toHaveBeenCalledWith('s1', 'Renomeado');
      expect(res).toEqual({ id: 's1', name: 'Renomeado' });
    });

    it('rejects empty name', async () => {
      await expect(controller.renameSession('s1', { name: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteSession', () => {
    it('delegates to chatService.deleteSession', async () => {
      chatServiceMock.deleteSession.mockResolvedValue({ success: true });
      const res = await controller.deleteSession('s1');
      expect(chatServiceMock.deleteSession).toHaveBeenCalledWith('s1');
      expect(res).toEqual({ success: true });
    });
  });

  describe('sendMessage', () => {
    it('returns 400 when body text is missing or empty', async () => {
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const resMock = { status: statusMock } as any;

      await controller.sendMessage('s1', { text: '' }, {} as any, resMock);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalled();
    });

    it('streams events to response when payload is valid', async () => {
      const writtenChunks: string[] = [];
      const resMock = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn().mockImplementation((chunk) => writtenChunks.push(chunk)),
        end: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        writableEnded: false,
      } as any;

      const reqMock = {} as any;

      chatServiceMock.processMessageStream.mockImplementation(
        async (_sid: string, _text: string, _sig: any, onChunk: any) => {
          onChunk('Chunk 1');
          return {
            message: { id: 'm1', text: 'Chunk 1', type: 'IA', interrupted: false },
            cancelled: false,
          };
        },
      );

      await controller.sendMessage('s1', { text: 'Olá!' }, reqMock, resMock);

      expect(resMock.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(writtenChunks.some((c) => c.includes('Chunk 1'))).toBe(true);
      expect(writtenChunks.some((c) => c.includes('"type":"done"'))).toBe(true);
      expect(resMock.end).toHaveBeenCalled();
    });
  });
});
