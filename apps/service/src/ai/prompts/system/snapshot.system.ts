export interface SnapshotLearningObjective {
  id: string;
  bnccSkill?: {
    id: string;
    code: string;
    description: string;
  } | null;
}

export interface SnapshotEvaluation {
  id: string;
  name?: string | null;
  instrumentType?: string | null;
  grade?: number | string | null;
  criteria?: string | null;
  description?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
}

export interface SnapshotMetadataValue {
  id: string;
  specificationId: string;
  specification?: {
    id: string;
    colName: string;
    customLabel?: string | null;
  } | null;
  textValue?: string | null;
  jsonbValue?: unknown;
}

export interface SnapshotPlanningBlock {
  id: string;
  parentId?: string | null;
  granularity?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  order?: number;
  metodologia?: string | null;
  learningObjectives?: SnapshotLearningObjective[];
  evaluations?: SnapshotEvaluation[];
  metadataValues?: SnapshotMetadataValue[];
}

export interface SnapshotSpecification {
  id: string;
  colName: string;
  customLabel?: string | null;
  tableRef: string;
  isRequired?: boolean;
  description?: string | null;
}

export interface PlanningSnapshot {
  planning?: {
    id: string;
    schoolId?: string | null;
    school?: { id: string; name: string } | null;
    applicationYearId?: string | null;
    applicationYear?: { id: string; name: string } | null;
    curricularComponents?: Array<{ id: string; name: string }>;
    startAt?: Date | string | null;
    endAt?: Date | string | null;
    granularity?: string | null;
    learningObjectives?: SnapshotLearningObjective[];
    evaluations?: SnapshotEvaluation[];
    metadataValues?: SnapshotMetadataValue[];
  } | null;
  blocks?: SnapshotPlanningBlock[];
  specifications?: SnapshotSpecification[];
}

function formatDate(d?: Date | string | null): string {
  if (!d) return 'N/A';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Formata o Snapshot do Planejamento para compor o System Prompt do Gemini.
 * Atua como Fonte Única da Verdade com precedência absoluta sobre o histórico conversacional.
 */
export function formatSnapshotPrompt(snapshot?: PlanningSnapshot | null): string {
  if (!snapshot || !snapshot.planning) {
    return `
# Snapshot Consolidado do Banco de Dados (Fonte Única da Verdade)
*Status: Nenhum planejamento iniciado ainda para esta sessão (estado inicial / descoberta).*
`.trim();
  }

  const { planning, blocks = [], specifications = [] } = snapshot;

  const schoolName = planning.school?.name || (planning.schoolId ? `Escola (${planning.schoolId})` : 'Não informada');
  const yearName = planning.applicationYear?.name || (planning.applicationYearId ? `Ano (${planning.applicationYearId})` : 'Não informado');
  const subjects = planning.curricularComponents?.map((c) => c.name).join(', ') || 'Não informados';
  const granularity = planning.granularity || 'Não definida';
  const period = `${formatDate(planning.startAt)} até ${formatDate(planning.endAt)}`;

  let blocksText = '';
  if (blocks.length === 0) {
    blocksText = '  *Nenhum bloco de planejamento cadastrado ainda.*\n';
  } else {
    blocksText = blocks
      .map((b, idx) => {
        const dates = b.endAt ? `${formatDate(b.startAt)} a ${formatDate(b.endAt)}` : formatDate(b.startAt);
        const skills = b.learningObjectives && b.learningObjectives.length > 0
          ? b.learningObjectives.map((o) => o.bnccSkill?.code || o.id).join(', ')
          : 'Nenhuma BNCC vinculada';
        const evals = b.evaluations && b.evaluations.length > 0
          ? b.evaluations.map((e) => `[${e.instrumentType || 'AVAL'}] ${e.name || 'Sem título'}`).join('; ')
          : 'Nenhuma';
        const method = b.metodologia ? `Metodologia/Sequência: "${b.metodologia.slice(0, 120)}${b.metodologia.length > 120 ? '...' : ''}"` : 'Metodologia: Não preenchida';
        const parentInfo = b.parentId ? ` (Pai: ${b.parentId})` : '';

        const blockMetas = b.metadataValues && b.metadataValues.length > 0
          ? b.metadataValues.map((m) => `${m.specification?.customLabel || m.specification?.colName || 'Meta'}: "${m.textValue || ''}"`).join('; ')
          : 'Nenhum';

        return `  ${idx + 1}. Bloco [${b.granularity || 'BLOCO'}] ID: ${b.id}${parentInfo} | Datas: ${dates} | Ordem: ${b.order ?? 0}
     - ${method}
     - BNCC: ${skills}
     - Colunas Customizadas EAV: ${blockMetas}
     - Avaliações: ${evals}`;
      })
      .join('\n');
  }

  let specsText = '';
  if (specifications.length === 0) {
    specsText = '  *Nenhuma coluna customizada (Specification) configurada.*\n';
  } else {
    specsText = specifications
      .map((s) => {
        const label = s.customLabel || s.colName;
        const required = s.isRequired ? ' [OBRIGATÓRIA / Slot-filling]' : '';
        const scope = s.tableRef === 'PLANNING' ? 'Cabeçalho (Macro)' : 'Blocos (Diário)';
        const macroCount = planning.metadataValues?.filter((m) => m.specificationId === s.id).length || 0;
        const blockCount = blocks.reduce((acc, b) => acc + (b.metadataValues?.filter((m) => m.specificationId === s.id).length || 0), 0);
        const totalValues = macroCount + blockCount;
        const status = totalValues > 0
          ? `✅ [PREENCHIDA: ${totalValues} registro(s)]`
          : `⚠️ [SEM VALOR CADASTRADO / PENDENTE SLOT-FILLING]`;
        return `  - "${label}" (colName: ${s.colName}, Escopo: ${scope})${required} ${status}${s.description ? `: ${s.description}` : ''}`;
      })
      .join('\n');
  }

  // Metadados Macro do Planejamento
  let macroMetaText = '';
  if (planning.metadataValues && planning.metadataValues.length > 0) {
    macroMetaText = planning.metadataValues
      .map((m) => `  - [${m.specification?.customLabel || m.specification?.colName || 'Metadado'}]: "${m.textValue || '(sem texto)'}"`)
      .join('\n');
  } else {
    macroMetaText = '  *Nenhum metadado de ciclo configurado.*\n';
  }

  // Avaliações Macro do Planejamento
  let macroEvalsText = '';
  if (planning.evaluations && planning.evaluations.length > 0) {
    macroEvalsText = planning.evaluations
      .map((e) => `  - [${e.instrumentType || 'AVAL'}] ${e.name || 'Sem título'}${e.criteria ? ` (Critérios: ${e.criteria})` : ''}${e.description ? ` - ${e.description}` : ''}`)
      .join('\n');
  } else {
    macroEvalsText = '  *Nenhuma avaliação de ciclo/geral configurada.*\n';
  }

  // Análise de Gaps (Gap Analysis)
  const missingHeader: string[] = [];
  if (!planning.applicationYearId && !planning.applicationYear) missingHeader.push('Ano de aplicação');
  if (!planning.curricularComponents || planning.curricularComponents.length === 0) missingHeader.push('Componente curricular');
  if (!planning.startAt || !planning.endAt) missingHeader.push('Período letivo (datas globais)');

  const missingBlocks: string[] = [];
  if (blocks.length === 0) {
    missingBlocks.push('Divisão temporal em blocos');
  } else {
    const unmethod = blocks.filter((b) => !b.metodologia).length;
    if (unmethod > 0) missingBlocks.push(`${unmethod} bloco(s) sem metodologia`);
  }

  // Gaps de especificações órfãs
  const orphanSpecs = specifications.filter((s) => {
    const macroCount = planning.metadataValues?.filter((m) => m.specificationId === s.id).length || 0;
    const blockCount = blocks.reduce((acc, b) => acc + (b.metadataValues?.filter((m) => m.specificationId === s.id).length || 0), 0);
    return (macroCount + blockCount) === 0;
  });

  const gapsSummary = [
    ...(missingHeader.length > 0 ? [`Cabeçalho: faltam ${missingHeader.join(', ')}`] : []),
    ...(missingBlocks.length > 0 ? [`Cronograma: faltam ${missingBlocks.join(', ')}`] : []),
    ...orphanSpecs.map((o) => `Coluna customizada "${o.customLabel || o.colName}" (${o.tableRef}) está SEM NENHUM VALOR. Preencha imediatamente ou solicite o conteúdo ao professor.`),
  ];

  return `
# Snapshot Consolidado do Banco de Dados (Fonte Única da Verdade)
> ⚠️ **REGRA DE PRECEDÊNCIA COGNITIVA ABSOLUTA:** 
> O estado abaixo é o retrato real e consolidado da persistência. Ele se sobrepõe a qualquer mensagem histórica anterior. Se algo não está listado abaixo, não existe no banco de dados.

## 1. Cabeçalho Macro do Planejamento (\`Planning\`)
- **ID:** ${planning.id}
- **Escola:** ${schoolName}
- **Ano Escolar / Série:** ${yearName}
- **Componentes Curriculares:** ${subjects}
- **Granularidade Macro:** ${granularity}
- **Período do Ciclo:** ${period}
- **Metadados do Ciclo (EAV):**
${macroMetaText}
- **Avaliações Gerais do Ciclo (Macro):**
${macroEvalsText}

## 2. Especificações / Colunas Customizadas Ativas (\`Specification\` EAV)
${specsText}

## 3. Estrutura de Blocos (\`PlanningBlock\`)
${blocksText}

## 4. Análise Contínua de Gaps (O que está pendente no plano)
${gapsSummary.length > 0 ? gapsSummary.map((g) => `- ⏳ Pendência: ${g}`).join('\n') : '- ✅ Todos os componentes essenciais foram estruturados.'}
`.trim();
}
