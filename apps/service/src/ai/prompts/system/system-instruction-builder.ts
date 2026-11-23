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
import type { ExtractedSchoolReference } from '../../../ingestion/types.js';

export interface SystemInstructionContext {
  snapshot?: PlanningSnapshot | null;
  activePhase?: PlanningPhase;
  teacherName?: string;
  customInstructions?: string;
  bnccSkills?: Array<{ code: string; description: string }>;
  availableYears?: Array<{ id: string; name: string }>;
  availableCurricularComponents?: Array<{ id: string; name: string }>;
  schoolReference?: {
    originalName: string;
    extractedData?: ExtractedSchoolReference | null;
    rawTextSummary?: string;
  } | null;
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

    if (context?.schoolReference) {
      const { originalName, extractedData, rawTextSummary } = context.schoolReference;
      const layout = extractedData?.layout;
      const data = extractedData?.data;

      const columnsFormatted = layout?.columns?.length
        ? layout.columns
            .map(
              (c) =>
                `- [${c.targetTable}] "${c.name}" (Rótulo: "${c.customLabel}") - Core: ${c.isCore ? 'Sim' : 'Não'}${c.sampleToneText ? ` | Tom/Redação: "${c.sampleToneText}"` : ''}${c.detectedAvgCharLimit ? ` | Limite sugerido: ${c.detectedAvgCharLimit} chars` : ''}`,
            )
            .join('\n')
        : '*(Nenhuma coluna identificada)*';

      const hierarchyFormatted = layout?.hierarchyLevels?.join(' -> ') || 'Não detectada';

      const evalsFormatted = data?.evaluationsFound?.length
        ? data.evaluationsFound
            .map(
              (e) =>
                `- [${e.instrumentType || 'AVAL'}] ${e.name || 'Instrumento'}${e.description ? ` (${e.description})` : ''}`,
            )
            .join('\n')
        : '*(Nenhuma avaliação identificada)*';

      const referenceSection = `
# Matriz Pedagógica Escolar de Referência (Documento Institucional Anexado)
O professor vinculou o documento oficial da escola: "${originalName}".
O pipeline de extração de duas camadas identificou os seguintes moldes e instâncias:

## 📐 Camada de Layout (Estrutura / Molde da Coordenação):
- Granularidade temporal sugerida: ${layout?.suggestedGranularity || 'Não especificada'}
- Progressão hierárquica: ${hierarchyFormatted}
- Colunas e especificações detectadas:
${columnsFormatted}

## 📊 Camada de Dados (Conteúdos Pré-existentes no Documento):
- Componente Curricular: ${data?.curricularComponent || 'Não detectado'}
- Ano / Etapa de Aplicação: ${data?.applicationYear || 'Não detectado'}
- Período / Datas: ${data?.dates?.startAt ? `${data.dates.startAt} a ${data.dates.endAt}` : 'Não detectado'}
- Habilidades BNCC encontradas: ${data?.bnccCodesFound?.join(', ') || 'Nenhuma'}
- Instrumentos avaliativos:
${evalsFormatted}
- Quantidade de aulas/blocos brutos extraídos: ${data?.rawLessonBlocks?.length || 0} bloco(s)

${rawTextSummary ? `## 📄 Trecho do Texto Bruto:\n${rawTextSummary.slice(0, 1500)}\n` : ''}
## 🚨 Diretrizes Obrigatórias de Atuação para Matriz Escolar:
1. **Primeira Interação com o Documento:** Acolha o professor com empatia na sala dos professores, valide a estrutura encontrada e apresente com clareza as duas opções de importação (1️⃣ Apenas o Modelo vs 2️⃣ Importação Completa).
2. **Se o professor escolher "1️⃣ Apenas o Modelo (Layout)":** Emita \`UPSERT_PLANNING\` cadastrando todas as colunas em \`specifications\` com seus respectivos tons (\`description\`) e limites de densidade (\`avgCharLimit\`). Em seguida, faça a Análise de Gaps imediata e guie o professor para o início do novo planejamento do zero.
3. **Se o professor escolher "2️⃣ Importação Completa":** Emita \`UPSERT_PLANNING\` com todas as \`specifications\` E popule todos os blocos, metodologias nativas (\`metodologia\`), datas e BNCCs extraídos.
`.trim();

      sections.push('---', referenceSection);
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
