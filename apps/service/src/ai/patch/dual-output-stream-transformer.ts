import {
  planningPatchPayloadSchema,
  type PlanningPatchPayload,
} from './planning-patch.schema.js';

export interface FinalizeResult {
  cleanText: string;
  patch: PlanningPatchPayload | null;
  rawPatch: string | null;
  error?: string;
}

const START_DELIMITER = '<!--PLANNING_PATCH:';
const END_DELIMITER = '-->';

export class DualOutputStreamTransformer {
  private state: 'VISUAL' | 'IN_PATCH' | 'FINISHED' = 'VISUAL';
  private pendingBuffer = '';
  private patchBuffer = '';
  private accumulatedVisualText = '';

  /**
   * Processa cada chunk recebido da LLM.
   * Chama `onVisualChunk` exclusivamente com o conteúdo limpo em Markdown para o professor.
   */
  processChunk(chunk: string, onVisualChunk?: (visualChunk: string) => void): void {
    if (!chunk) return;

    if (this.state === 'FINISHED') {
      // Quando o patch já foi concluído, qualquer texto remanescente não deve vazar
      return;
    }

    if (this.state === 'IN_PATCH') {
      this.patchBuffer += chunk;
      const endIdx = this.patchBuffer.indexOf(END_DELIMITER);
      if (endIdx !== -1) {
        this.patchBuffer = this.patchBuffer.slice(0, endIdx);
        this.state = 'FINISHED';
      }
      return;
    }

    // Estado VISUAL:
    const combined = this.pendingBuffer + chunk;
    const startIdx = combined.indexOf(START_DELIMITER);

    if (startIdx !== -1) {
      // Encontrou o delimitador de abertura do patch!
      const visualPart = combined.slice(0, startIdx);
      if (visualPart.length > 0) {
        this.accumulatedVisualText += visualPart;
        onVisualChunk?.(visualPart);
      }

      this.pendingBuffer = '';
      this.state = 'IN_PATCH';
      this.patchBuffer = combined.slice(startIdx + START_DELIMITER.length);

      const endIdx = this.patchBuffer.indexOf(END_DELIMITER);
      if (endIdx !== -1) {
        this.patchBuffer = this.patchBuffer.slice(0, endIdx);
        this.state = 'FINISHED';
      }
      return;
    }

    // Não encontrou o delimitador completo.
    // Verifica se o final do `combined` pode ser um prefixo de `START_DELIMITER` (lookahead buffer).
    let matchedPrefixLen = 0;
    const maxLookahead = Math.min(START_DELIMITER.length - 1, combined.length);

    for (let len = maxLookahead; len >= 1; len--) {
      const candidatePrefix = START_DELIMITER.slice(0, len);
      if (combined.endsWith(candidatePrefix)) {
        matchedPrefixLen = len;
        break;
      }
    }

    if (matchedPrefixLen > 0) {
      const safeVisualPart = combined.slice(0, combined.length - matchedPrefixLen);
      if (safeVisualPart.length > 0) {
        this.accumulatedVisualText += safeVisualPart;
        onVisualChunk?.(safeVisualPart);
      }
      this.pendingBuffer = combined.slice(combined.length - matchedPrefixLen);
    } else {
      this.accumulatedVisualText += combined;
      onVisualChunk?.(combined);
      this.pendingBuffer = '';
    }
  }

  /**
   * Finaliza o processamento do stream, descarrega qualquer buffer visual pendente
   * e extrai e valida o payload estruturado Zod.
   */
  finalize(): FinalizeResult {
    // Se ainda estava em estado visual e havia caracteres retidos no lookahead buffer
    // que não eram o início de um patch, descarrega no texto visual limpo.
    if (this.state === 'VISUAL' && this.pendingBuffer.length > 0) {
      this.accumulatedVisualText += this.pendingBuffer;
      this.pendingBuffer = '';
    }

    const cleanText = this.accumulatedVisualText.trimEnd();

    if (!this.patchBuffer || this.patchBuffer.trim().length === 0) {
      return {
        cleanText,
        patch: null,
        rawPatch: null,
      };
    }

    const rawPatch = this.patchBuffer.trim();

    try {
      const parsedJson = JSON.parse(rawPatch);
      const validationResult = planningPatchPayloadSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        return {
          cleanText,
          patch: null,
          rawPatch,
          error: `Falha na validação do schema Zod: ${JSON.stringify(validationResult.error.format())}`,
        };
      }

      return {
        cleanText,
        patch: validationResult.data,
        rawPatch,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        cleanText,
        patch: null,
        rawPatch,
        error: `JSON malformado no envelope estruturado: ${errorMessage}`,
      };
    }
  }
}
