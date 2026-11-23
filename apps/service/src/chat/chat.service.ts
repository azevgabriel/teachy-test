import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
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
import { DocumentsService } from '../documents/documents.service.js';
import { matchApplicationYear, matchCurricularComponent } from '../planning/utils/index.js';
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
 * Verifica se a mensagem representa um comando ou execução de recomeço/reset.
 */
export function isResetConversation(conversation: Conversation): boolean {
  if (conversation.commands) {
    const cmds = conversation.commands as any;
    if (cmds.operation === 'RESET_PLANNING') {
      return true;
    }
    if (
      Array.isArray(cmds.operations) &&
      cmds.operations.some((op: any) => op.operation === 'RESET_PLANNING')
    ) {
      return true;
    }
  }

  if (conversation.type === 'USER' && conversation.text) {
    const norm = conversation.text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /\b(recomecar|comecar do zero|zerar planejamento|resetar planejamento|zerar o planejamento|resetar o planejamento|vamos recomecar)\b/.test(
      norm,
    );
  }

  return false;
}

/**
 * Filtra as mensagens da sessão expurgando rigorosamente mensagens marcadas com interrupted === true,
 * a respectiva mensagem do usuário cujo turno foi abortado/interrompido, e expurgando TODO o histórico
 * anterior ao último comando de recomeço/reset (RESET_PLANNING), garantindo contexto 100% limpo ("zerado").
 * Aplica janela deslizante para reter apenas as interações recentes e evitar poluição contextual.
 */
export function filterCleanChatHistory(
  conversations: Conversation[],
  maxMessages: number = MAX_CHAT_HISTORY_MESSAGES,
): ChatHistoryMessage[] {
  // 1. Identificar o ponto de corte do último comando de recomeço
  let startIdx = 0;
  for (let i = conversations.length - 1; i >= 0; i--) {
    if (isResetConversation(conversations[i])) {
      // Se for mensagem da IA com o patch RESET_PLANNING, o comando de recomeço do usuário foi em (i - 1)
      if (conversations[i].type === 'IA') {
        const prev = conversations[i - 1];
        startIdx = prev && prev.type === 'USER' ? i - 1 : i;
      } else {
        startIdx = i;
      }
      break;
    }
  }

  const scopedConversations = conversations.slice(startIdx);
  const result: ChatHistoryMessage[] = [];

  for (let i = 0; i < scopedConversations.length; i++) {
    const curr = scopedConversations[i];

    // Ignora mensagens marcadas explicitamente como interrompidas
    if (curr.interrupted) {
      continue;
    }

    // Se for mensagem de usuário, verifica se a resposta subsequente da IA foi interrompida
    if (curr.type === 'USER') {
      const next = scopedConversations[i + 1];
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
    @Optional() private readonly documentsService?: DocumentsService,
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
      const textContext = `${userText} ${history.slice(-2).map((h) => h.text).join(' ')}`;

      const allYears = await this.prisma.applicationYear.findMany({
        select: { id: true, name: true, stage: true, targetAge: true },
      });
      const matchedYear = matchApplicationYear(textContext, allYears);

      const allComps = await this.prisma.curricularComponent.findMany({
        select: { id: true, name: true },
      });
      const matchedComp = matchCurricularComponent(textContext, allComps);

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

  async listSessions(): Promise<any[]> {
    const sessions = await this.prisma.session.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { conversations: true },
        },
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

    return sessions.map((session: any) => {
      const { plannings, ...rest } = session;
      return {
        ...rest,
        planning: plannings?.[0] ?? null,
      };
    });
  }

  async getSession(id: string): Promise<any> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        conversations: {
          orderBy: { createdAt: 'asc' },
        },
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

    if (!session) {
      throw new NotFoundException(`Sessão com ID ${id} não encontrada.`);
    }

    const { plannings, ...rest } = session as any;
    return {
      ...rest,
      planning: plannings?.[0] ?? null,
    };
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
    attachment?: {
      id?: string;
      name: string;
      size?: number;
      mimeType?: string;
      url?: string;
    },
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

    // 1. Salvar a mensagem do usuário (incluindo metadados do anexo caso presente)
    const userMessage = await this.prisma.conversation.create({
      data: {
        sessionId,
        text: userText,
        type: 'USER',
        commands: attachment ? ({ attachment } as any) : undefined,
        interrupted: false,
      },
    });

    // 2. Criar a mensagem da IA antecipadamente para obter o ID da mensagem
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

    // 5.1. Carregar documento de referência da escola caso exista anexo ou vínculo na sessão (#45)
    let schoolReference: {
      originalName: string;
      extractedData?: any;
      rawTextSummary?: string;
    } | null = null;

    try {
      let refDoc: any = null;
      if (attachment?.id && this.prisma.referenceDocument?.findUnique) {
        refDoc = await this.prisma.referenceDocument.findUnique({
          where: { id: attachment.id },
        });
      } else if (attachment?.name && this.prisma.referenceDocument?.findFirst) {
        refDoc = await this.prisma.referenceDocument.findFirst({
          where: {
            originalName: attachment.name,
            sessions: { some: { id: sessionId } },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!refDoc && this.prisma.referenceDocument?.findFirst) {
        refDoc = await this.prisma.referenceDocument.findFirst({
          where: { sessions: { some: { id: sessionId } } },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (refDoc) {
        if (!refDoc.extractedData && this.documentsService) {
          try {
            const extracted = await this.documentsService.extractDocument(refDoc.id);
            refDoc.extractedData = extracted;
            refDoc.extractedText = extracted.rawText;
          } catch (err) {
            this.logger.warn(
              `Erro ao extrair referência escolar ${refDoc.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        schoolReference = {
          originalName: refDoc.originalName,
          extractedData: refDoc.extractedData,
          rawTextSummary: refDoc.extractedText || undefined,
        };
      }
    } catch (err) {
      this.logger.debug(
        `Não foi possível carregar documento de referência: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const systemInstruction = SystemInstructionBuilder.build({
      snapshot,
      bnccSkills,
      availableYears,
      availableCurricularComponents,
      schoolReference,
    });

    let accumulatedText = '';
    let cancelled = false;
    const transformer = new DualOutputStreamTransformer();

    const userMessageForAi = attachment
      ? `[Documento de Referência da Escola Anexado: "${attachment.name}"]\n${userText}`
      : userText;

    try {
      await this.aiService.streamChat({
        history,
        userMessage: userMessageForAi,
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
