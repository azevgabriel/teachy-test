import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiService, type ChatHistoryMessage } from '../ai/ai.service.js';
import {
  SystemInstructionBuilder,
  type PlanningSnapshot,
} from '../ai/prompts/system/index.js';
import {
  DualOutputStreamTransformer,
  type PlanningPatchPayload,
} from '../ai/patch/index.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import type { Conversation, Session } from '@prisma/client';

export interface StreamResult {
  message: Conversation;
  cancelled: boolean;
  patch?: PlanningPatchPayload | null;
}

/**
 * Filtra as mensagens da sessão expurgando rigorosamente mensagens marcadas com interrupted === true
 * e a respectiva mensagem do usuário cujo turno foi abortado/interrompido.
 */
export function filterCleanChatHistory(conversations: Conversation[]): ChatHistoryMessage[] {
  const result: ChatHistoryMessage[] = [];
  for (let i = 0; i < conversations.length; i++) {
    const curr = conversations[i];

    // Ignora mensagens marcadas explicitamente como interrompidas
    if (curr.interrupted) {
      continue;
    }

    // Se for mensagem de usuário, verifica se a resposta subsequente da IA foi interrompida
    if (curr.type === 'USER') {
      const next = conversations[i + 1];
      if (next && next.type === 'IA' && next.interrupted) {
        continue;
      }
    }

    const trimmed = curr.text?.trim();
    if (!trimmed) {
      continue;
    }

    result.push({
      role: curr.type === 'USER' ? ('user' as const) : ('model' as const),
      text: curr.text,
    });
  }
  return result;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async createSession(dto?: CreateSessionDto): Promise<Session> {
    const name = dto?.name?.trim() || 'Nova Conversa';
    return this.prisma.session.create({
      data: { name },
    });
  }

  async listSessions(): Promise<(Session & { _count: { conversations: number } })[]> {
    return this.prisma.session.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });
  }

  async getSession(id: string): Promise<Session & { conversations: Conversation[] }> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        conversations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Sessão com ID ${id} não encontrada.`);
    }

    return session;
  }

  async renameSession(id: string, name: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException(`Sessão com ID ${id} não encontrada.`);
    }

    return this.prisma.session.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async deleteSession(id: string): Promise<{ success: boolean }> {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException(`Sessão com ID ${id} não encontrada.`);
    }

    await this.prisma.session.delete({
      where: { id },
    });

    return { success: true };
  }

  async processMessageStream(
    sessionId: string,
    userText: string,
    signal: AbortSignal,
    onChunk: (chunk: string, messageId: string) => void,
    onInit?: (messageId: string) => void,
  ): Promise<StreamResult> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        conversations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Sessão com ID ${sessionId} não encontrada.`);
    }

    // 1. Salvar a mensagem do usuário
    const userMessage = await this.prisma.conversation.create({
      data: {
        sessionId,
        text: userText,
        type: 'USER',
        interrupted: false,
      },
    });

    // 2. Se a sessão tem o nome padrão, atualiza com base na primeira mensagem
    if (session.name === 'Nova Conversa' && session.conversations.length === 0) {
      const summaryName = userText.length > 30 ? `${userText.slice(0, 30)}...` : userText;
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { name: summaryName },
      });
    }

    // 3. Criar a mensagem da IA antecipadamente para obter o ID da mensagem
    const aiMessage = await this.prisma.conversation.create({
      data: {
        sessionId,
        text: '',
        type: 'IA',
        interrupted: false,
      },
    });

    onInit?.(aiMessage.id);

    // 4. Montar histórico para a LLM com higiene rigorosa de mensagens interrompidas
    const history = filterCleanChatHistory(session.conversations);

    // 5. Carregar snapshot do planejamento para compor dinamicamente a instrução do Gemini
    const planning = this.prisma.planning?.findFirst
      ? await this.prisma.planning.findFirst({
          where: { sessionId },
          include: {
            school: true,
            applicationYear: true,
            curricularComponents: true,
            learningObjectives: {
              include: { bnccSkill: true },
            },
            evaluations: true,
            metadataValues: {
              include: { specification: true },
            },
            blocks: {
              orderBy: [{ order: 'asc' }, { startAt: 'asc' }],
              include: {
                learningObjectives: {
                  include: { bnccSkill: true },
                },
                evaluations: true,
                metadataValues: {
                  include: { specification: true },
                },
              },
            },
          },
        })
      : null;

    const specifications = this.prisma.specification?.findMany
      ? await this.prisma.specification.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const snapshot: PlanningSnapshot = {
      planning: planning as any,
      blocks: (planning?.blocks as any) || [],
      specifications: specifications as any,
    };

    const systemInstruction = SystemInstructionBuilder.build({
      snapshot,
    });

    let accumulatedText = '';
    let cancelled = false;
    const transformer = new DualOutputStreamTransformer();

    try {
      await this.aiService.streamChat({
        history,
        userMessage: userText,
        signal,
        systemInstruction,
        onChunk: (chunk) => {
          transformer.processChunk(chunk, (visualChunk) => {
            accumulatedText += visualChunk;
            onChunk(visualChunk, aiMessage.id);
            this.prisma.conversation
              .update({
                where: { id: aiMessage.id },
                data: { text: accumulatedText },
              })
              .catch(() => {});
          });
        },
      });
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        cancelled = true;
      } else {
        await this.prisma.conversation.update({
          where: { id: aiMessage.id },
          data: {
            text: accumulatedText || '(Erro durante a geração da resposta)',
            interrupted: true,
          },
        });
        throw err;
      }
    }

    if (signal.aborted) {
      cancelled = true;
    }

    if (cancelled) {
      // Sempre marca a mensagem do usuário que originou a requisição como interrompida
      await this.prisma.conversation.update({
        where: { id: userMessage.id },
        data: { interrupted: true },
      });
    }

    const parseResult = transformer.finalize();
    const cleanFinalText = parseResult.cleanText || accumulatedText;

    // 5. Se cancelado antes de gerar qualquer resposta (fase de pensamento/preparação):
    // Exclui a mensagem vazia da IA e retorna a mensagem do usuário interrompida
    if (cancelled && cleanFinalText.trim().length === 0) {
      const updatedUserMessage = await this.prisma.conversation.findUnique({
        where: { id: userMessage.id },
      });

      await this.prisma.conversation.delete({
        where: { id: aiMessage.id },
      });

      await this.prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      return {
        message: updatedUserMessage!,
        cancelled: true,
        patch: null,
      };
    }

    // 6. Atualizar o registro da mensagem da IA com o texto final, comandos estruturados e flag de interrupção
    const finalAiMessage = await this.prisma.conversation.update({
      where: { id: aiMessage.id },
      data: {
        text: cleanFinalText || (cancelled ? '(Resposta interrompida pelo usuário)' : ''),
        commands: cancelled ? null : ((parseResult.patch as any) ?? null),
        interrupted: cancelled,
      },
    });

    // Atualiza o updatedAt da sessão
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return {
      message: finalAiMessage,
      cancelled,
      patch: cancelled ? null : parseResult.patch,
    };
  }
}
