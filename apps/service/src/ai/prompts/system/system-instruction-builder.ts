import { BASE_SYSTEM_PROMPT } from './base.system.js';
import { PEDAGOGICAL_RULES_SYSTEM_PROMPT } from './pedagogical-rules.system.js';
import { EVALUATION_RULES_SYSTEM_PROMPT } from './evaluation-rules.system.js';
import { INTENT_MATRIX_SYSTEM_PROMPT } from './intent-matrix.system.js';
import {
  PHASE_PROMPTS,
  inferPlanningPhase,
  type PlanningPhase,
} from './phases/index.js';
import {
  formatSnapshotPrompt,
  type PlanningSnapshot,
} from './snapshot.system.js';

export interface SystemInstructionContext {
  snapshot?: PlanningSnapshot | null;
  activePhase?: PlanningPhase;
  teacherName?: string;
  customInstructions?: string;
}

export class SystemInstructionBuilder {
  /**
   * Constrói dinamicamente a instrução de sistema modular para o modelo Gemini.
   */
  static build(context?: SystemInstructionContext): string {
    const snapshot = context?.snapshot ?? null;
    const activePhase = context?.activePhase ?? inferPlanningPhase(snapshot);
    const phasePrompt = PHASE_PROMPTS[activePhase];
    const snapshotPrompt = formatSnapshotPrompt(snapshot);

    const sections: string[] = [
      BASE_SYSTEM_PROMPT,
      '---',
      PEDAGOGICAL_RULES_SYSTEM_PROMPT,
      '---',
      EVALUATION_RULES_SYSTEM_PROMPT,
      '---',
      INTENT_MATRIX_SYSTEM_PROMPT,
      '---',
      `# Orientações da Fase Atual\n\n${phasePrompt}`,
      '---',
      snapshotPrompt,
    ];

    if (context?.teacherName) {
      sections.push('---', `Professor atendido: ${context.teacherName}`);
    }

    if (context?.customInstructions) {
      sections.push('---', `Instruções adicionais da sessão:\n${context.customInstructions}`);
    }

    return sections.join('\n\n');
  }
}
