import { BASE_SYSTEM_PROMPT } from './base.system.js';
import { PEDAGOGICAL_RULES_SYSTEM_PROMPT } from './pedagogical-rules.system.js';
import { EVALUATION_RULES_SYSTEM_PROMPT } from './evaluation-rules.system.js';
import { INTENT_MATRIX_SYSTEM_PROMPT } from './intent-matrix.system.js';
import { PATCH_PROTOCOL_SYSTEM_PROMPT } from './patch-protocol.system.js';
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
  bnccSkills?: Array<{ code: string; description: string }>;
  availableYears?: Array<{ id: string; name: string }>;
  availableCurricularComponents?: Array<{ id: string; name: string }>;
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
      PATCH_PROTOCOL_SYSTEM_PROMPT,
      '---',
      `# Orientações da Fase Atual\n\n${phasePrompt}`,
      '---',
      snapshotPrompt,
    ];

    if (
      (context?.availableYears && context.availableYears.length > 0) ||
      (context?.availableCurricularComponents && context.availableCurricularComponents.length > 0)
    ) {
      const yearsFormatted = (context.availableYears || [])
        .map((y) => `- "${y.name}"`)
        .join('\n');
      const compsFormatted = (context.availableCurricularComponents || [])
        .map((c) => `- "${c.name}"`)
        .join('\n');

      const catalogSection = `
# Catálogo Oficial de Anos de Aplicação & Componentes Curriculares (PostgreSQL)
Para garantir persistência relacional perfeita e evitar divergências de nomenclatura, utilize RIGOROSAMENTE as strings abaixo ao sugerir etapas, campos de experiência ou registrar em \`applicationYearName\` e \`curricularComponentNames\` no patch:

## Anos de Aplicação / Etapas Elegíveis Cadastrados:
${yearsFormatted || '*(Nenhum ano informado)*'}

## Componentes Curriculares & Campos de Experiência Cadastrados:
${compsFormatted || '*(Nenhum componente informado)*'}
`.trim();

      sections.push('---', catalogSection);
    }

    if (context?.bnccSkills && context.bnccSkills.length > 0) {
      const skillsFormatted = context.bnccSkills
        .map((s) => `- [${s.code}] ${s.description}`)
        .join('\n');

      const bnccSection = `
# Catálogo de Habilidades Oficiais da BNCC (Fonte Oficial: MEC)
Abaixo estão as habilidades oficiais da Base Nacional Comum Curricular cadastradas no banco de dados para esta etapa e componente curricular:

${skillsFormatted}

## ⚠️ Diretrizes Estritas para Uso da BNCC:
1. **Fidelidade Literal:** Ao propor, sugerir ou associar habilidades ao planejamento, utilize **rigorosamente os códigos e as descrições oficiais exatas** listadas acima.
2. **Proibição de Paráfrases ou Alucinações:** Jamais invente ou reescreva livremente descrições de habilidades da BNCC quando as oficiais estiverem fornecidas.
3. **Soberania do Professor:** Se o professor pedir especificamente habilidades de recomposição ou avanço, respeite a escolha mantendo a precisão dos códigos.
`.trim();

      sections.push('---', bnccSection);
    }

    if (context?.teacherName) {
      sections.push('---', `Professor atendido: ${context.teacherName}`);
    }

    if (context?.customInstructions) {
      sections.push('---', `Instruções adicionais da sessão:\n${context.customInstructions}`);
    }

    return sections.join('\n\n');
  }
}
