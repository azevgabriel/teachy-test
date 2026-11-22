import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { PlanningService } from '../planning/planning.service.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import type { Conversation, Session } from '@prisma/client';

export interface StreamResult {
  message: Conversation;
  cancelled: boolean;
  patch?: PlanningPatchPayload | null;
}

/**
 * Quantidade máxima de turnos conversacionais recentes mantidos no histórico enviado à LLM.
 * 2 turnos = 2 mensagens do usuário e 2 respostas do modelo (4 mensagens no total).
 * Evita contaminação de contexto com dados obsoletos já superados pelo snapshot relacional.
 */
export const MAX_CHAT_HISTORY_TURNS = 2;
export const MAX_CHAT_HISTORY_MESSAGES = MAX_CHAT_HISTORY_TURNS * 2;

/**
 * Filtra as mensagens da sessão expurgando rigorosamente mensagens marcadas com interrupted === true
 * e a respectiva mensagem do usuário cujo turno foi abortado/interrompido.
 * Aplica janela deslizante para reter apenas as interações recentes e evitar poluição contextual.
 */
export function filterCleanChatHistory(
  conversations: Conversation[],
  maxMessages: number = MAX_CHAT_HISTORY_MESSAGES,
): ChatHistoryMessage[] {
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

  if (maxMessages > 0 && result.length > maxMessages) {
    return result.slice(-maxMessages);
  }

  return result;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly planningService: PlanningService,
  ) {}

  private async fetchRelevantBnccSkills(
    planning: any,
    userText: string,
    history: ChatHistoryMessage[],
  ): Promise<Array<{ code: string; description: string }>> {
    try {
      const yearId = planning?.applicationYearId;
      const compIds = planning?.curricularComponents?.map((c: any) => c.id) || [];

      if (yearId || compIds.length > 0) {
        return await this.prisma.bnccSkill.findMany({
          where: {
            ...(yearId ? { applicationYears: { some: { id: yearId } } } : {}),
            ...(compIds.length > 0
              ? { curricularComponents: { some: { id: { in: compIds } } } }
              : {}),
          },
          select: { code: true, description: true },
          take: 35,
          orderBy: { code: 'asc' },
        });
      }

      // Se ainda não há planejamento criado, busca palavras-chave na conversa recente
      const textContext = `${userText} ${history.slice(-2).map((h) => h.text).join(' ')}`.toLowerCase();

      const allYears = await this.prisma.applicationYear.findMany({ select: { id: true, name: true } });
      const matchedYear = allYears.find((y) => {
        const lowerY = y.name.toLowerCase();
        if (
          textContext.includes('bebê') ||
          textContext.includes('berçário') ||
          textContext.includes('0 a 1') ||
          textContext.includes('zero a 1') ||
          textContext.includes('sensorial') ||
          textContext.includes('balbucio')
        ) {
          return lowerY.includes('zero a 1 ano e 6 meses') || lowerY.includes('bebês');
        }
        if (
          textContext.includes('bem pequena') ||
          (textContext.includes('infantil') && (textContext.includes('2') || textContext.includes('1 ano')))
        ) {
          return lowerY.includes('1 ano e 7 meses a 3 anos e 11 meses');
        }
        if (
          textContext.includes('pequena') ||
          (textContext.includes('infantil') && (textContext.includes('4') || textContext.includes('5')))
        ) {
          return lowerY.includes('4 anos a 5 anos e 11 meses');
        }
        if (textContext.includes('infantil')) {
          return lowerY.includes('infantil');
        }
        if (textContext.includes('1º') || textContext.includes('1o') || textContext.includes('primeiro')) {
          return lowerY.includes('1º ano do ensino fundamental');
        }
        if (textContext.includes('2º') || textContext.includes('2o') || textContext.includes('segundo')) {
          return lowerY.includes('2º ano do ensino fundamental');
        }
        if (textContext.includes('3º') || textContext.includes('3o') || textContext.includes('terceiro')) {
          return lowerY.includes('3º ano do ensino fundamental');
        }
        if (textContext.includes('4º') || textContext.includes('4o') || textContext.includes('quarto')) {
          return lowerY.includes('4º ano do ensino fundamental');
        }
        if (textContext.includes('5º') || textContext.includes('5o') || textContext.includes('quinto')) {
          return lowerY.includes('5º ano do ensino fundamental');
        }
        return textContext.includes(lowerY);
      });

      const allComps = await this.prisma.curricularComponent.findMany({ select: { id: true, name: true } });
      const matchedComp = allComps.find((c) => {
        const lowerC = c.name.toLowerCase();
        if (
          textContext.includes('corpo') ||
          textContext.includes('gesto') ||
          textContext.includes('movimento') ||
          textContext.includes('motora') ||
          textContext.includes('sensorial')
        ) {
          return lowerC.includes('corpo, gestos');
        }
        if (
          textContext.includes('escuta') ||
          textContext.includes('fala') ||
          textContext.includes('balbucio') ||
          textContext.includes('linguag') ||
          textContext.includes('comunicação oral')
        ) {
          return lowerC.includes('escuta, fala');
        }
        if (
          textContext.includes('eu') ||
          textContext.includes('outro') ||
          textContext.includes('nós') ||
          textContext.includes('afetiv') ||
          textContext.includes('vínculo')
        ) {
          return lowerC.includes('eu, o outro');
        }
        if (
          textContext.includes('traço') ||
          textContext.includes('som') ||
          textContext.includes('cor') ||
          textContext.includes('forma') ||
          textContext.includes('música')
        ) {
          return lowerC.includes('traços, sons');
        }
        if (
          textContext.includes('espaço') ||
          textContext.includes('tempo') ||
          textContext.includes('quantidade') ||
          textContext.includes('natureza')
        ) {
          return lowerC.includes('espaços, tempos');
        }
        if (textContext.includes('portugu') || textContext.includes('leitura')) {
          return lowerC.includes('portuguesa');
        }
        if (textContext.includes('matem') || textContext.includes('números')) {
          return lowerC.includes('matemática');
        }
        if (textContext.includes('ciênc')) {
          return lowerC.includes('ciências');
        }
        return textContext.includes(lowerC);
      });

      if (matchedYear || matchedComp) {
        return await this.prisma.bnccSkill.findMany({
          where: {
            ...(matchedYear ? { applicationYears: { some: { id: matchedYear.id } } } : {}),
            ...(matchedComp ? { curricularComponents: { some: { id: matchedComp.id } } } : {}),
          },
          select: { code: true, description: true },
          take: 35,
          orderBy: { code: 'asc' },
        });
      }

      return [];
    } catch {
      return [];
    }
  }

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

    const [bnccSkills, availableYears, availableCurricularComponents] = await Promise.all([
      this.fetchRelevantBnccSkills(planning, userText, history),
      this.prisma.applicationYear?.findMany
        ? this.prisma.applicationYear.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.curricularComponent?.findMany
        ? this.prisma.curricularComponent.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const systemInstruction = SystemInstructionBuilder.build({
      snapshot,
      bnccSkills,
      availableYears,
      availableCurricularComponents,
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

    // 7. Persistência relacional atômica no banco de dados via PlanningModule
    if (!cancelled && parseResult.patch) {
      try {
        await this.planningService.applyPatch(sessionId, parseResult.patch);
      } catch (patchErr) {
        this.logger.error(
          `Falha ao aplicar patch relacional para a sessão ${sessionId}: ${String(patchErr)}`,
        );
      }
    }

    return {
      message: finalAiMessage,
      cancelled,
      patch: cancelled ? null : parseResult.patch,
    };
  }
}
