import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService, filterCleanChatHistory } from './chat.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AiService } from '../ai/ai.service.js';
import { NotFoundException } from '@nestjs/common';
import type { Conversation } from '@prisma/client';

describe('ChatService', () => {
  let chatService: ChatService;
  let prismaMock: any;
  let aiServiceMock: any;
  let documentsServiceMock: any;

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
      referenceDocument: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      applicationYear: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      curricularComponent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bnccSkill: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    aiServiceMock = {
      streamChat: vi.fn(),
    };

    const planningServiceMock = {
      applyPatch: vi.fn().mockResolvedValue(undefined),
      getPlanningBySessionId: vi.fn(),
    };

    documentsServiceMock = {
      extractDocument: vi.fn(),
    };

    chatService = new ChatService(
      prismaMock as unknown as PrismaService,
      aiServiceMock as unknown as AiService,
      planningServiceMock as any,
      documentsServiceMock as any,
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
    it('returns sessions ordered by updatedAt descending with planning metadata', async () => {
      const mockList = [
        {
          id: '1',
          name: 'Sessão 1',
          _count: { conversations: 2 },
          plannings: [
            {
              id: 'plan-1',
              granularity: 'WEEKLY',
              startAt: new Date('2026-08-03'),
              endAt: new Date('2026-08-07'),
              applicationYear: { id: 'y1', name: '3º Ano', stage: 'FUNDAMENTAL_1' },
              curricularComponents: [{ id: 'c1', name: 'Língua Portuguesa' }],
            },
          ],
        },
      ];
      prismaMock.session.findMany.mockResolvedValue(mockList);

      const result = await chatService.listSessions();
      expect(prismaMock.session.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { conversations: true } },
          plannings: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              granularity: true,
              startAt: true,
              endAt: true,
              applicationYear: {
                select: { id: true, name: true, stage: true },
              },
              curricularComponents: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
      expect(result).toEqual([
        {
          id: '1',
          name: 'Sessão 1',
          _count: { conversations: 2 },
          planning: mockList[0].plannings[0],
        },
      ]);
    });
  });

  describe('getSession', () => {
    it('throws NotFoundException when session is not found', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(chatService.getSession('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns session with conversations ordered by createdAt ascending and planning metadata', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Conversa',
        conversations: [{ id: 'c1', text: 'Olá', type: 'USER' }],
        plannings: [
          {
            id: 'plan-1',
            granularity: 'WEEKLY',
            startAt: new Date('2026-08-03'),
            endAt: new Date('2026-08-07'),
            applicationYear: { id: 'y1', name: '3º Ano', stage: 'FUNDAMENTAL_1' },
            curricularComponents: [{ id: 'c1', name: 'Língua Portuguesa' }],
          },
        ],
      };
      prismaMock.session.findUnique.mockResolvedValue(mockSession);

      const result = await chatService.getSession('session-1');
      expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: {
          conversations: { orderBy: { createdAt: 'asc' } },
          plannings: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              granularity: true,
              startAt: true,
              endAt: true,
              applicationYear: {
                select: { id: true, name: true, stage: true },
              },
              curricularComponents: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
      expect(result).toEqual({
        id: 'session-1',
        name: 'Conversa',
        conversations: [{ id: 'c1', text: 'Olá', type: 'USER' }],
        planning: mockSession.plannings[0],
      });
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
    it('persists user message with attachment metadata when provided', async () => {
      const mockSession = {
        id: 'session-att',
        name: 'Sessão com Anexo',
        conversations: [],
      };
      prismaMock.session.findUnique.mockResolvedValue(mockSession);
      prismaMock.conversation.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'msg-id', ...args.data }),
      );
      prismaMock.conversation.update.mockImplementation((args: any) =>
        Promise.resolve({ id: args.where.id, ...args.data }),
      );
      prismaMock.session.update.mockResolvedValue({});
      aiServiceMock.streamChat.mockResolvedValue('Ok');

      await chatService.processMessageStream(
        'session-att',
        'Monte o plano com base na matriz',
        new AbortController().signal,
        () => {},
        undefined,
        {
          id: 'doc-123',
          name: 'matriz.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          url: '/api/documents/doc-123/download',
        },
      );

      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-att',
          text: 'Monte o plano com base na matriz',
          type: 'USER',
          commands: {
            attachment: {
              id: 'doc-123',
              name: 'matriz.pdf',
              size: 1024,
              mimeType: 'application/pdf',
              url: '/api/documents/doc-123/download',
            },
          },
        }),
      });
      expect(aiServiceMock.streamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('matriz.pdf'),
        }),
      );
    });

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
          commands: null,
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
          commands: null,
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

    it('passes sanitized history and dynamic systemInstruction to aiService.streamChat', async () => {
      const mockConversations: Partial<Conversation>[] = [
        { id: '1', text: 'Mensagem válida 1', type: 'USER', interrupted: false },
        { id: '2', text: 'Resposta válida 1', type: 'IA', interrupted: false },
        { id: '3', text: 'Mensagem cancelada', type: 'USER', interrupted: true },
        { id: '4', text: 'Resposta cancelada', type: 'IA', interrupted: true },
        { id: '5', text: 'Pergunta do usuário abortada', type: 'USER', interrupted: false },
        { id: '6', text: 'Resposta incompleta com erro', type: 'IA', interrupted: true },
      ];

      prismaMock.session.findUnique.mockResolvedValue({
        id: 's1',
        name: 'Sessão com cancelamentos',
        conversations: mockConversations,
      });

      prismaMock.conversation.create
        .mockResolvedValueOnce({ id: 'u-new', text: 'Nova mensagem', type: 'USER', interrupted: false })
        .mockResolvedValueOnce({ id: 'ia-new', text: '', type: 'IA', interrupted: false });

      prismaMock.conversation.update.mockResolvedValue({ id: 'ia-new', text: 'Resposta gerada' });
      prismaMock.session.update.mockResolvedValue({});

      aiServiceMock.streamChat.mockResolvedValue('Resposta gerada');

      await chatService.processMessageStream(
        's1',
        'Nova mensagem',
        new AbortController().signal,
        () => {},
      );

      expect(aiServiceMock.streamChat).toHaveBeenCalledTimes(1);
      const callArgs = aiServiceMock.streamChat.mock.calls[0][0];

      // Deve conter apenas as mensagens 1 e 2 (as mensagens 3, 4, 5, 6 devem ser excluídas)
      expect(callArgs.history).toEqual([
        { role: 'user', text: 'Mensagem válida 1' },
        { role: 'model', text: 'Resposta válida 1' },
      ]);

      // Deve passar a instrução de sistema construída dinamicamente
      expect(callArgs.systemInstruction).toBeDefined();
      expect(callArgs.systemInstruction).toContain('Assistente Pedagógico Teachy — Co-piloto de Planejamento Escolar');
      expect(callArgs.systemInstruction).toContain('Regra Antidump de Tabelas');
    });

    it('suppresses structured patch delimiters and JSON from onChunk and saves patch into Conversation.commands', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 's1',
        name: 'Sessão com patch',
        conversations: [],
      });

      prismaMock.conversation.create
        .mockResolvedValueOnce({ id: 'u-1', text: 'Quero resetar o plano', type: 'USER', interrupted: false })
        .mockResolvedValueOnce({ id: 'ia-1', text: '', type: 'IA', interrupted: false });

      prismaMock.conversation.update.mockResolvedValue({
        id: 'ia-1',
        text: 'Sem problemas, vamos recomeçar do zero.',
        commands: { operation: 'RESET_PLANNING', data: {} },
        interrupted: false,
      });

      prismaMock.session.update.mockResolvedValue({});

      // Simula streaming emitindo chunks onde os últimos contêm o envelope estruturado
      aiServiceMock.streamChat.mockImplementation(async (options: any) => {
        options.onChunk('Sem problemas, ');
        options.onChunk('vamos recomeçar do zero.\n\n');
        options.onChunk('<!--PLANNING_PATCH:\n');
        options.onChunk('{"operation": "RESET_PLANNING", "data": {}}\n');
        options.onChunk('-->');
        return 'Sem problemas, vamos recomeçar do zero.\n\n<!--PLANNING_PATCH:\n{"operation": "RESET_PLANNING", "data": {}}\n-->';
      });

      const visualChunks: string[] = [];

      const result = await chatService.processMessageStream(
        's1',
        'Quero resetar o plano',
        new AbortController().signal,
        (chunk) => visualChunks.push(chunk),
      );

      // 1. O onChunk visual recebe apenas o texto pedagógico limpo
      const combinedVisual = visualChunks.join('');
      expect(combinedVisual).toBe('Sem problemas, vamos recomeçar do zero.\n\n');
      expect(combinedVisual).not.toContain('PLANNING_PATCH');
      expect(combinedVisual).not.toContain('RESET_PLANNING');

      // 2. O update final do conversation no Prisma grava commands com o patch validado e text limpo
      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ia-1' },
          data: expect.objectContaining({
            text: 'Sem problemas, vamos recomeçar do zero.',
            commands: { operation: 'RESET_PLANNING', data: {} },
            interrupted: false,
          }),
        }),
      );

      // 3. O StreamResult retorna o patch tipado
      expect(result.patch).toEqual({
        operation: 'RESET_PLANNING',
        data: {},
      });
      expect(result.cancelled).toBe(false);
    });

    it('does not save commands when stream is cancelled/interrupted', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 's1',
        name: 'Sessão cancelada',
        conversations: [],
      });

      prismaMock.conversation.create
        .mockResolvedValueOnce({ id: 'u-1', text: 'Quero cancelar', type: 'USER', interrupted: false })
        .mockResolvedValueOnce({ id: 'ia-1', text: '', type: 'IA', interrupted: false });

      prismaMock.conversation.update.mockResolvedValue({
        id: 'ia-1',
        text: 'Iniciando resposta...',
        commands: null,
        interrupted: true,
      });

      prismaMock.session.update.mockResolvedValue({});

      const controller = new AbortController();

      aiServiceMock.streamChat.mockImplementation(async (options: any) => {
        options.onChunk('Iniciando resposta...');
        controller.abort();
        throw new Error('AbortError');
      });

      const result = await chatService.processMessageStream(
        's1',
        'Quero cancelar',
        controller.signal,
        () => {},
      );

      expect(result.cancelled).toBe(true);
      expect(result.patch).toBeNull();
      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ia-1' },
          data: expect.objectContaining({
            commands: null,
            interrupted: true,
          }),
        }),
      );
    });

    it('loads and injects school reference into system instruction when attachment is provided', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 's-ref',
        name: 'Sessão com Matriz',
        conversations: [],
      });

      prismaMock.conversation.create
        .mockResolvedValueOnce({ id: 'u-1', text: 'Analise esse modelo', type: 'USER', interrupted: false })
        .mockResolvedValueOnce({ id: 'ia-1', text: '', type: 'IA', interrupted: false });

      prismaMock.referenceDocument.findUnique.mockResolvedValue({
        id: 'doc-1',
        originalName: 'matriz-escola.pdf',
        extractedData: {
          layout: {
            suggestedGranularity: 'BIMONTHLY',
            hierarchyLevels: ['BIMONTHLY', 'WEEKLY'],
            columns: [
              {
                name: 'metodologia',
                customLabel: 'Sequência Didática',
                isCore: true,
                targetTable: 'PLANNING_BLOCK',
                sampleToneText: 'Metodologia ativa',
                detectedAvgCharLimit: 250,
              },
            ],
          },
          data: {
            curricularComponent: 'Matemática',
            applicationYear: '3º ano do Ensino Fundamental I',
          },
          rawText: 'Matriz Matemática 3º ano',
        },
        extractedText: 'Matriz Matemática 3º ano',
      });

      aiServiceMock.streamChat.mockResolvedValue('Ok');

      await chatService.processMessageStream(
        's-ref',
        'Analise esse modelo da coordenação',
        new AbortController().signal,
        () => {},
        undefined,
        { id: 'doc-1', name: 'matriz-escola.pdf' },
      );

      expect(prismaMock.referenceDocument.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });

      const callArgs = aiServiceMock.streamChat.mock.calls[0][0];
      expect(callArgs.userMessage).toContain('[Documento de Referência da Escola Anexado: "matriz-escola.pdf"]');
      expect(callArgs.systemInstruction).toContain('Matriz Pedagógica Escolar de Referência (Documento Institucional Anexado)');
      expect(callArgs.systemInstruction).toContain('matriz-escola.pdf');
      expect(callArgs.systemInstruction).toContain('Sequência Didática');
      expect(callArgs.systemInstruction).toContain('1️⃣ Apenas o Modelo (Layout)');
    });

    it('triggers document extraction if extractedData is null when document is linked', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 's-ref-2',
        name: 'Sessão',
        conversations: [],
      });

      prismaMock.conversation.create
        .mockResolvedValueOnce({ id: 'u-1', text: 'Use o documento', type: 'USER', interrupted: false })
        .mockResolvedValueOnce({ id: 'ia-1', text: '', type: 'IA', interrupted: false });

      prismaMock.referenceDocument.findUnique.mockResolvedValue({
        id: 'doc-uncached',
        originalName: 'plano.docx',
        extractedData: null,
        extractedText: null,
      });

      documentsServiceMock.extractDocument.mockResolvedValue({
        layout: {
          suggestedGranularity: 'WEEKLY',
          hierarchyLevels: ['WEEKLY'],
          columns: [],
        },
        data: {
          curricularComponent: 'História',
        },
        rawText: 'História 6º ano',
      });

      aiServiceMock.streamChat.mockResolvedValue('Ok');

      await chatService.processMessageStream(
        's-ref-2',
        'Use esse modelo',
        new AbortController().signal,
        () => {},
        undefined,
        { id: 'doc-uncached', name: 'plano.docx' },
      );

      expect(documentsServiceMock.extractDocument).toHaveBeenCalledWith('doc-uncached');
      const callArgs = aiServiceMock.streamChat.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('História');
    });
  });

  describe('filterCleanChatHistory', () => {
    it('removes interrupted messages and aborted user messages', () => {
      const conversations = [
        { id: 'c1', text: 'Planejamento 3º ano', type: 'USER', interrupted: false },
        { id: 'c2', text: 'Ótimo, vamos começar!', type: 'IA', interrupted: false },
        { id: 'c3', text: 'Mensagem cancelada pelo usuário', type: 'USER', interrupted: true },
        { id: 'c4', text: '(interrompido)', type: 'IA', interrupted: true },
        { id: 'c5', text: 'Pergunta cujo modelo deu erro', type: 'USER', interrupted: false },
        { id: 'c6', text: '(erro durante geração)', type: 'IA', interrupted: true },
        { id: 'c7', text: 'Continuando o planejamento', type: 'USER', interrupted: false },
        { id: 'c8', text: 'Aqui estão as sugestões', type: 'IA', interrupted: false },
      ] as Conversation[];

      const filtered = filterCleanChatHistory(conversations);

      expect(filtered).toEqual([
        { role: 'user', text: 'Planejamento 3º ano' },
        { role: 'model', text: 'Ótimo, vamos começar!' },
        { role: 'user', text: 'Continuando o planejamento' },
        { role: 'model', text: 'Aqui estão as sugestões' },
      ]);
    });

    it('ignores empty and whitespace-only messages', () => {
      const conversations = [
        { id: 'c1', text: '   ', type: 'USER', interrupted: false },
        { id: 'c2', text: '', type: 'IA', interrupted: false },
        { id: 'c3', text: 'Mensagem válida', type: 'USER', interrupted: false },
      ] as Conversation[];

      const filtered = filterCleanChatHistory(conversations);

      expect(filtered).toEqual([
        { role: 'user', text: 'Mensagem válida' },
      ]);
    });

    it('limits history to the last 2 turns (4 messages) to avoid context pollution', () => {
      const conversations = [
        { id: 'c1', text: 'Turno 1 - User', type: 'USER', interrupted: false },
        { id: 'c2', text: 'Turno 1 - IA', type: 'IA', interrupted: false },
        { id: 'c3', text: 'Turno 2 - User', type: 'USER', interrupted: false },
        { id: 'c4', text: 'Turno 2 - IA', type: 'IA', interrupted: false },
        { id: 'c5', text: 'Turno 3 - User', type: 'USER', interrupted: false },
        { id: 'c6', text: 'Turno 3 - IA', type: 'IA', interrupted: false },
      ] as Conversation[];

      const filtered = filterCleanChatHistory(conversations);

      expect(filtered).toHaveLength(4);
      expect(filtered).toEqual([
        { role: 'user', text: 'Turno 2 - User' },
        { role: 'model', text: 'Turno 2 - IA' },
        { role: 'user', text: 'Turno 3 - User' },
        { role: 'model', text: 'Turno 3 - IA' },
      ]);
    });

    it('expurga todo o histórico anterior ao comando de recomeço (RESET_PLANNING) para evitar sujeira de contexto', () => {
      const conversations = [
        {
          id: 'c1',
          text: 'Vamos fazer um plano para Educação Infantil bebês',
          type: 'USER',
          interrupted: false,
        },
        {
          id: 'c2',
          text: 'Perfeito! Vamos focar no campo de experiências Corpo, Gestos...',
          type: 'IA',
          interrupted: false,
        },
        {
          id: 'c3',
          text: 'Quero recomeçar do zero',
          type: 'USER',
          interrupted: false,
        },
        {
          id: 'c4',
          text: 'Com certeza, vamos recomeçar do zero! O que deseja planejar agora?',
          type: 'IA',
          commands: { operation: 'RESET_PLANNING', data: {} },
          interrupted: false,
        },
        {
          id: 'c5',
          text: 'Não vamos manter o ensino infantil, vamos mudar para 3º Ano do EM',
          type: 'USER',
          interrupted: false,
        },
        {
          id: 'c6',
          text: 'Excelente! O 3º ano do Ensino Médio é estratégico...',
          type: 'IA',
          interrupted: false,
        },
      ] as unknown as Conversation[];

      const filtered = filterCleanChatHistory(conversations);

      // Deve conter apenas as interações a partir do comando de recomeço (c3 em diante)
      // e respeitar o limite de mensagens (máx 4)
      expect(filtered).toEqual([
        { role: 'user', text: 'Quero recomeçar do zero' },
        { role: 'model', text: 'Com certeza, vamos recomeçar do zero! O que deseja planejar agora?' },
        { role: 'user', text: 'Não vamos manter o ensino infantil, vamos mudar para 3º Ano do EM' },
        { role: 'model', text: 'Excelente! O 3º ano do Ensino Médio é estratégico...' },
      ]);

      // Nenhuma menção a "Educação Infantil bebês" deve constar
      const texts = filtered.map((m) => m.text).join(' ');
      expect(texts).not.toContain('Educação Infantil bebês');
      expect(texts).not.toContain('Corpo, Gestos');
    });
  });
});
