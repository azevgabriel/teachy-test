import { DISCOVERY_PHASE_PROMPT } from './discovery.phase.js';
import { SCHEDULE_PHASE_PROMPT } from './schedule.phase.js';
import { ELABORATION_PHASE_PROMPT } from './elaboration.phase.js';
import { REFINEMENT_PHASE_PROMPT } from './refinement.phase.js';
import type { PlanningSnapshot } from '../snapshot.system.js';

export type PlanningPhase = 'discovery' | 'schedule' | 'elaboration' | 'refinement';

export const PHASE_PROMPTS: Record<PlanningPhase, string> = {
  discovery: DISCOVERY_PHASE_PROMPT,
  schedule: SCHEDULE_PHASE_PROMPT,
  elaboration: ELABORATION_PHASE_PROMPT,
  refinement: REFINEMENT_PHASE_PROMPT,
};

/**
 * Infere automaticamente a fase do planejamento a partir do snapshot do banco de dados (Gap Analysis)
 */
export function inferPlanningPhase(snapshot?: PlanningSnapshot | null): PlanningPhase {
  if (!snapshot || !snapshot.planning) {
    return 'discovery';
  }

  const { planning, blocks } = snapshot;

  // 1. Descoberta: faltam ano, componentes ou período
  const hasSubject = (planning.curricularComponents && planning.curricularComponents.length > 0);
  const hasYear = Boolean(planning.applicationYearId || planning.applicationYear);
  const hasDates = Boolean(planning.startAt && planning.endAt);

  if (!hasSubject || !hasYear || !hasDates) {
    return 'discovery';
  }

  // 2. Cronograma: tem cabeçalho macro, mas não tem blocos estruturados
  if (!blocks || blocks.length === 0) {
    return 'schedule';
  }

  // 3. Elaboração: tem blocos, mas alguns blocos ainda não possuem metodologia ou habilidades
  const hasUnelaboratedBlocks = blocks.some(
    (b) => !b.metodologia || (b.learningObjectives && b.learningObjectives.length === 0),
  );

  if (hasUnelaboratedBlocks) {
    return 'elaboration';
  }

  // 4. Refinamento: todos os blocos possuem estrutura básica, foco em refinamento e consultas
  return 'refinement';
}

export {
  DISCOVERY_PHASE_PROMPT,
  SCHEDULE_PHASE_PROMPT,
  ELABORATION_PHASE_PROMPT,
  REFINEMENT_PHASE_PROMPT,
};
