import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  SystemInstructionBuilder,
  type SystemInstructionContext,
} from './prompts/system/index.js';

export interface ChatHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StreamChatOptions {
  history: ChatHistoryMessage[];
  userMessage: string;
  signal?: AbortSignal;
  onChunk: (chunkText: string) => void;
  systemInstruction?: string;
  systemInstructionContext?: SystemInstructionContext;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY is not set. Real Gemini calls will fail unless configured.');
    }
  }

  async streamChat(options: StreamChatOptions): Promise<string> {
    const { history, userMessage, signal, onChunk } = options;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!this.client && apiKey && apiKey.trim().length > 0) {
      this.client = new GoogleGenAI({ apiKey });
    }

    if (!this.client) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const sanitizedHistory: { role: 'user' | 'model'; parts: [{ text: string }] }[] = [];
    for (const msg of history) {
      const trimmed = msg.text?.trim();
      if (!trimmed) continue;
      const last = sanitizedHistory[sanitizedHistory.length - 1];
      if (last && last.role === msg.role) {
        last.parts[0].text += `\n\n${trimmed}`;
      } else {
        sanitizedHistory.push({
          role: msg.role,
          parts: [{ text: trimmed }],
        });
      }
    }

    const lastMsg = sanitizedHistory[sanitizedHistory.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      lastMsg.parts[0].text += `\n\n${userMessage.trim()}`;
    } else {
      sanitizedHistory.push({
        role: 'user',
        parts: [{ text: userMessage.trim() }],
      });
    }

    const systemInstruction =
      options.systemInstruction ||
      SystemInstructionBuilder.build(options.systemInstructionContext);

    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ].filter(Boolean) as string[];

    let lastError: unknown = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const modelName = candidateModels[i];
      let fullText = '';
      try {
        const responseStream = await this.client.models.generateContentStream({
          model: modelName,
          contents: sanitizedHistory,
          config: {
            abortSignal: signal,
            candidateCount: 1,
            systemInstruction,
          },
        });

        for await (const chunk of responseStream) {
          if (signal?.aborted) {
            break;
          }
          const chunkText = chunk.text ?? '';
          if (chunkText) {
            fullText += chunkText;
            onChunk(chunkText);
          }
        }

        return fullText;
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isUnavailable =
          errMsg.includes('503') ||
          errMsg.includes('404') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE');

        if (
          isUnavailable &&
          i < candidateModels.length - 1 &&
          !signal?.aborted &&
          fullText.length === 0
        ) {
          this.logger.warn(
            `Modelo ${modelName} temporariamente indisponível. Tentando fallback para ${candidateModels[i + 1]}...`,
          );
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error('Nenhum modelo Gemini disponível no momento.');
  }
}
