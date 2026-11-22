import type { PlanningGranularity } from '@prisma/client';

export const GRANULARITY_RANK: Record<string, number> = {
  ANNUAL: 7,
  SEMESTER: 6,
  TRIMESTER: 5,
  BIMONTHLY: 4,
  MONTHLY: 3,
  WEEKLY: 2,
  DAILY: 1,
  CUSTOM: 0,
};

export const DEFAULT_DESCENDING_CHILD: Record<string, PlanningGranularity> = {
  ANNUAL: 'SEMESTER',
  SEMESTER: 'MONTHLY',
  TRIMESTER: 'MONTHLY',
  BIMONTHLY: 'MONTHLY',
  MONTHLY: 'WEEKLY',
  WEEKLY: 'DAILY',
  DAILY: 'DAILY',
  CUSTOM: 'DAILY',
};

/**
 * Valida se childGranularity é estritamente descendente em relação a parentGranularity.
 */
export function isStrictlyDescendingGranularity(
  parentGranularity: PlanningGranularity | null | undefined,
  childGranularity: PlanningGranularity | null | undefined,
): boolean {
  if (!parentGranularity || !childGranularity) return true;
  const parentRank = GRANULARITY_RANK[parentGranularity] ?? 99;
  const childRank = GRANULARITY_RANK[childGranularity] ?? 0;
  return childRank < parentRank;
}

/**
 * Resolve a granularidade normalizada do bloco filho respeitando a hierarquia descendente:
 * 1. Preserva a granularidade já existente no bloco se for válida e descendente.
 * 2. Se for solicitada uma nova granularidade e for estritamente menor que a do pai, utiliza-a.
 * 3. Se o pai for WEEKLY, força estritamente DAILY.
 * 4. Aplica o fallback padrão descendente do pai.
 */
export function resolveChildGranularity(
  parentGranularity: PlanningGranularity | null | undefined,
  requestedGranularity?: PlanningGranularity | null,
  existingGranularity?: PlanningGranularity | null,
): PlanningGranularity {
  const parentRank = parentGranularity ? GRANULARITY_RANK[parentGranularity] ?? 99 : 99;

  // 1. Blindagem: se o bloco já possui uma granularidade válida previamente persistida
  if (existingGranularity) {
    const existingRank = GRANULARITY_RANK[existingGranularity] ?? 0;
    if (existingRank < parentRank) {
      // Se não há nova granularidade solicitada ou se a solicitada for inválida (>= pai), preserva a existente
      if (!requestedGranularity || (GRANULARITY_RANK[requestedGranularity] ?? 0) >= parentRank) {
        return existingGranularity;
      }
    }
  }

  // 2. Se a granularidade solicitada for estritamente menor que a do pai, acolhe
  if (requestedGranularity) {
    const reqRank = GRANULARITY_RANK[requestedGranularity] ?? 0;
    if (reqRank < parentRank) {
      return requestedGranularity;
    }
  }

  // 3. Invariante explícito: se o planejamento pai for WEEKLY, blocos diretos são estritamente DAILY
  if (parentGranularity === 'WEEKLY') {
    return 'DAILY';
  }

  // 4. Fallback descendente imediato
  if (parentGranularity && DEFAULT_DESCENDING_CHILD[parentGranularity]) {
    return DEFAULT_DESCENDING_CHILD[parentGranularity];
  }

  return 'DAILY';
}
