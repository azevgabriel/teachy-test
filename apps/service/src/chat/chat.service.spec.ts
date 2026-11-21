import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from './chat.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AiService } from '../ai/ai.service.js';
import { NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let chatService: ChatService;
  let prismaMock: any;
  let aiServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      session: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      conversation: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    aiServiceMock = {
      streamChat: vi.fn(),
    };

    chatService = new ChatService(
      prismaMock as unknown as PrismaService,
      aiServiceMock as unknown as AiService,
    );
  });

  describe('createSession', () => {
    it('creates a session with default name when none provided', async () => {
      prismaMock.session.create.mockResolvedValue({
        id: 'session-1',
        name: 'Nova Conversa',
      });

      const session = await chatService.createSession();
      expect(prismaMock.session.create).toHaveBeenCalledWith({
        data: { name: 'Nova Conversa' },
      });
      expect(session.name).toBe('Nova Conversa');
    });

    it('creates a session with custom name when provided', async () => {
      prismaMock.session.create.mockResolvedValue({
        id: 'session-2',
        name: 'Planejamento de Aula',
      });

      const session = await chatService.createSession({ name: 'Planejamento de Aula' });
      expect(prismaMock.session.create).toHaveBeenCalledWith({
        data: { name: 'Planejamento de Aula' },
      });
      expect(session.name).toBe('Planejamento de Aula');
    });
  });

  describe('listSessions', () => {
    it('returns sessions ordered by updatedAt descending', async () => {
      const mockList = [
        { id: '1', name: 'Sessão 1', _count: { conversations: 2 } },
      ];
      prismaMock.session.findMany.mockResolvedValue(mockList);

      const result = await chatService.listSessions();
      expect(prismaMock.session.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { conversations: true } } },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('getSession', () => {
    it('throws NotFoundException when session is not found', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(chatService.getSession('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns session with conversations ordered by createdAt ascending', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Conversa',
        conversations: [{ id: 'c1', text: 'Olá', type: 'USER' }],
      };
      prismaMock.session.findUnique.mockResolvedValue(mockSession);

      const result = await chatService.getSession('session-1');
      expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: { conversations: { orderBy: { createdAt: 'asc' } } },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('renameSession', () => {
    it('throws NotFoundException when session not found', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(chatService.renameSession('s1', 'Novo')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates session name when found', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1', name: 'Antigo' });
      prismaMock.session.update.mockResolvedValue({ id: 's1', name: 'Novo' });

      const res = await chatService.renameSession('s1', ' Novo ');
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { name: 'Novo' },
      });
      expect(res.name).toBe('Novo');
    });
  });

  describe('deleteSession', () => {
    it('throws NotFoundException when session not found', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(chatService.deleteSession('s1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes session from database when found', async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: 's1', name: 'Para Deletar' });
      prismaMock.session.delete.mockResolvedValue({ id: 's1' });

      const res = await chatService.deleteSession('s1');
      expect(prismaMock.session.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe('processMessageStream', () => {
    it('records user message, streams chunks, and saves completed IA response', async () => {
      const mockSession = {
        id: 's1',
        name: 'Nova Conversa',
        conversations: [],
      };
      prismaMock.session.findUnique.mockResolvedValue(mockSession);
      prismaMock.conversation.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'msg-id', ...args.data }),
      );
      prismaMock.conversation.update.mockImplementation((args: any) =>
        Promise.resolve({
          id: args.where.id,
          type: args.where.id === 'msg-USER' ? 'USER' : 'IA',
          ...args.data,
        }),
      );
      prismaMock.session.update.mockResolvedValue({});

      aiServiceMock.streamChat.mockImplementation(async (opts: any) => {
        opts.onChunk('Olá');
        opts.onChunk(' mundo!');
        return 'Olá mundo!';
      });

      const chunks: string[] = [];
      const abortController = new AbortController();

      const result = await chatService.processMessageStream(
        's1',
        'Meu prompt inicial',
        abortController.signal,
        (chunk) => chunks.push(chunk),
      );

      expect(chunks).toEqual(['Olá', ' mundo!']);
      expect(result.cancelled).toBe(false);
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          sessionId: 's1',
          text: 'Meu prompt inicial',
          type: 'USER',
          interrupted: false,
        },
      });
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          sessionId: 's1',
          text: '',
          type: 'IA',
          interrupted: false,
        },
      });
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'msg-id' },
        data: {
          text: 'Olá mundo!',
          interrupted: false,
        },
      });
    });

    it('marks IA response as interrupted when aborted mid-flight', async () => {
      const mockSession = {
        id: 's1',
        name: 'Sessão Existente',
        conversations: [{ id: 'prev', text: 'Oi', type: 'USER' }],
      };
      prismaMock.session.findUnique.mockResolvedValue(mockSession);
      prismaMock.conversation.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'msg-id', ...args.data }),
      );
      prismaMock.conversation.update.mockImplementation((args: any) =>
        Promise.resolve({
          id: args.where.id,
          type: args.where.id === 'msg-USER' ? 'USER' : 'IA',
          ...args.data,
        }),
      );
      prismaMock.session.update.mockResolvedValue({});

      const abortController = new AbortController();

      aiServiceMock.streamChat.mockImplementation(async (opts: any) => {
        opts.onChunk('Parte 1');
        abortController.abort();
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      });

      const result = await chatService.processMessageStream(
        's1',
        'Outro prompt',
        abortController.signal,
        () => {},
      );

      expect(result.cancelled).toBe(true);
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          sessionId: 's1',
          text: 'Outro prompt',
          type: 'USER',
          interrupted: false,
        },
      });
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          sessionId: 's1',
          text: '',
          type: 'IA',
          interrupted: false,
        },
      });
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'msg-id' },
        data: {
          interrupted: true,
        },
      });
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'msg-id' },
        data: {
          text: 'Parte 1',
          interrupted: true,
        },
      });
    });

    it('marks user message as interrupted and deletes empty IA placeholder when cancelled while thinking', async () => {
      const mockSession = {
        id: 's1',
        name: 'Sessão Existente',
        conversations: [{ id: 'prev', text: 'Oi', type: 'USER' }],
      };
      prismaMock.session.findUnique.mockResolvedValue(mockSession);
      prismaMock.conversation.create.mockImplementation((args: any) =>
        Promise.resolve({ id: `msg-${args.data.type}`, ...args.data }),
      );
      prismaMock.conversation.update.mockImplementation((args: any) =>
        Promise.resolve({
          id: args.where.id,
          type: args.where.id === 'msg-USER' ? 'USER' : 'IA',
          ...args.data,
        }),
      );
      prismaMock.conversation.findUnique = vi.fn().mockResolvedValue({
        id: 'msg-USER',
        type: 'USER',
        text: 'Pergunta pedagógica complexa',
        interrupted: true,
      });
      prismaMock.conversation.delete.mockResolvedValue({ id: 'msg-IA' });
      prismaMock.session.update.mockResolvedValue({});

      const abortController = new AbortController();

      // O usuário cancela antes que qualquer chunk seja gerado (fase de pensamento)
      aiServiceMock.streamChat.mockImplementation(async () => {
        abortController.abort();
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      });

      const result = await chatService.processMessageStream(
        's1',
        'Pergunta pedagógica complexa',
        abortController.signal,
        () => {},
      );

      expect(result.cancelled).toBe(true);
      expect(result.message.type).toBe('USER');
      expect(result.message.interrupted).toBe(true);

      // Deve ter atualizado a mensagem do usuário para interrupted: true
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'msg-USER' },
        data: { interrupted: true },
      });

      // Deve ter removido a mensagem de IA vazia criada como placeholder
      expect(prismaMock.conversation.delete).toHaveBeenCalledWith({
        where: { id: 'msg-IA' },
      });
    });
  });
});
