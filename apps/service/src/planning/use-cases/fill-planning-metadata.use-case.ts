import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { PlanningBlock } from '@prisma/client';

type FillMetadataData = Extract<SinglePatchOperation, { operation: 'FILL_METADATA' }>['data'];

function toDateStr(val: Date | string): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

@Injectable()
export class FillPlanningMetadataUseCase {
  private readonly logger = new Logger(FillPlanningMetadataUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: FillMetadataData) {
    this.logger.log(
      `Preenchendo metadados na sessão ${sessionId} (${data.colName ? `coluna padrão: ${data.colName}` : 'colunas dinâmicas'})`,
    );

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) return;

    // Cache local de especificações para evitar queries repetitivas no banco
    const specCache = new Map<string, any>();

    // Carrega todos os blocos do planejamento com seus filhos para permitir navegação hierárquica completa
    const allBlocks = await this.prisma.planningBlock.findMany({
      where: { planningId: planning.id },
      include: { children: true },
      orderBy: [{ startAt: 'asc' }, { order: 'asc' }],
    });

    for (const val of data.values) {
      const colName = (val.colName || data.colName)?.trim();
      if (!colName) continue;

      const isMetodologia = colName.toLowerCase() === 'metodologia';

      let spec = specCache.get(colName.toLowerCase());
      if (!spec) {
        spec = await this.prisma.specification.findFirst({
          where: {
            sessionId,
            colName: { equals: colName, mode: 'insensitive' },
          },
        });

        if (!spec) {
          const isMacroHint =
            !isMetodologia &&
            !val.blockId &&
            !val.date &&
            val.order === undefined &&
            !val.granularity &&
            !data.granularity;
          spec = await this.prisma.specification.create({
            data: {
              sessionId,
              colName: colName.toLowerCase(),
              customLabel: colName,
              tableRef: isMetodologia ? 'PLANNING_BLOCK' : isMacroHint ? 'PLANNING' : 'PLANNING_BLOCK',
              isRequired: false,
            },
          });
        }
        specCache.set(colName.toLowerCase(), spec);
      }

      const isMacro = !isMetodologia && spec.tableRef === 'PLANNING';

      let blockId: string | null = null;
      if (!isMacro) {
        blockId = this.resolveTargetBlockId(allBlocks, val, data);
        if (!blockId) {
          this.logger.warn(
            `Não foi possível resolver o bloco para metadado da coluna ${colName}. Ignorando item para não violar constraint XOR.`,
          );
          continue;
        }
      }

      // Invariante Anti-Duplicação para metodologia:
      // Persiste na coluna física planning_blocks.metodologia e limpa quaisquer registros EAV duplicados
      if (isMetodologia && blockId) {
        await this.prisma.planningBlock.update({
          where: { id: blockId },
          data: {
            metodologia: val.textValue ?? '',
          },
        });

        // Limpeza de segurança: remove eventual duplicidade em planning_metadata_values
        await this.prisma.planningMetadataValue.deleteMany({
          where: {
            specificationId: spec.id,
            planningBlockId: blockId,
          },
        });
        continue;
      }

      // Persistência EAV padrão para colunas customizadas
      const existing = await this.prisma.planningMetadataValue.findFirst({
        where: {
          specificationId: spec.id,
          ...(isMacro ? { planningId: planning.id } : { planningBlockId: blockId! }),
        },
      });

      if (existing) {
        await this.prisma.planningMetadataValue.update({
          where: { id: existing.id },
          data: {
            textValue: val.textValue !== undefined ? val.textValue : existing.textValue,
            jsonbValue: (val.jsonbValue as any) ?? existing.jsonbValue,
          },
        });
      } else {
        await this.prisma.planningMetadataValue.create({
          data: {
            specificationId: spec.id,
            planningId: isMacro ? planning.id : null,
            planningBlockId: isMacro ? null : blockId,
            textValue: val.textValue ?? null,
            jsonbValue: (val.jsonbValue as any) ?? null,
          },
        });
      }
    }
  }

  /**
   * Desambigua e resolve o ID do bloco alvo respeitando a hierarquia de múltiplos níveis,
   * granularidade, parentId e priorizando nós folha (leaf nodes) em preenchimentos atômicos.
   */
  private resolveTargetBlockId(
    allBlocks: Array<PlanningBlock & { children?: PlanningBlock[] }>,
    val: FillMetadataData['values'][number],
    data: FillMetadataData,
  ): string | null {
    // 1. blockId explícito
    if (val.blockId) {
      const direct = allBlocks.find((b) => b.id === val.blockId);
      if (direct) return direct.id;
    }

    const targetGranularity = val.granularity || data.granularity;
    const targetParentId = val.parentId || data.parentId;

    let candidates = allBlocks;

    // Filtra por parentId se informado
    if (targetParentId) {
      candidates = candidates.filter((b) => b.parentId === targetParentId);
    }

    // Filtra por granularidade se informada
    if (targetGranularity) {
      candidates = candidates.filter((b) => b.granularity === targetGranularity);
    }

    // Se nem parentId nem granularidade foram especificados, prioriza blocos folha (sem filhos)
    if (!targetParentId && !targetGranularity) {
      const hasHierarchy = allBlocks.some((b) => b.children && b.children.length > 0);
      if (hasHierarchy) {
        const leafBlocks = candidates.filter((b) => !b.children || b.children.length === 0);
        if (leafBlocks.length > 0) {
          candidates = leafBlocks;
        }
      }
    }

    // 2. Resolução por data
    if (val.date) {
      const targetDateStr = toDateStr(val.date);
      const matchingDate = candidates.find((b) => {
        if (!b.startAt) return false;
        const startStr = toDateStr(b.startAt);
        if (b.endAt) {
          const endStr = toDateStr(b.endAt);
          return targetDateStr >= startStr && targetDateStr <= endStr;
        }
        return targetDateStr === startStr;
      });

      if (matchingDate) return matchingDate.id;
    }

    // 3. Resolução por order
    if (val.order !== undefined) {
      // Correspondência direta no campo order
      const exactOrder = candidates.find((b) => b.order === val.order);
      if (exactOrder) return exactOrder.id;

      // Fallback: índice 1-based na lista ordenada de candidatos
      if (val.order >= 1 && val.order <= candidates.length) {
        return candidates[val.order - 1].id;
      }
    }

    // 4. Fallback global se a lista de candidatos foi estreitada
    if (candidates !== allBlocks) {
      if (val.date) {
        const targetDateStr = toDateStr(val.date);
        const fallbackDate = allBlocks.find((b) => {
          if (!b.startAt) return false;
          const startStr = toDateStr(b.startAt);
          if (b.endAt) {
            const endStr = toDateStr(b.endAt);
            return targetDateStr >= startStr && targetDateStr <= endStr;
          }
          return targetDateStr === startStr;
        });
        if (fallbackDate) return fallbackDate.id;
      }

      if (val.order !== undefined) {
        const fallbackOrder = allBlocks.find((b) => b.order === val.order);
        if (fallbackOrder) return fallbackOrder.id;
      }
    }

    return null;
  }
}
