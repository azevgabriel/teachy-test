import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { PlanningGranularity, PlanningBlock } from '@prisma/client';
import {
  getMondayOfWeek,
  getFridayOfWeek,
  computeWeeksForPeriod,
} from '../utils/calendar-hierarchy.js';

type ReorganizeTreeData = Extract<SinglePatchOperation, { operation: 'REORGANIZE_TREE' }>['data'];

@Injectable()
export class ReorganizeHierarchyUseCase {
  private readonly logger = new Logger(ReorganizeHierarchyUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: ReorganizeTreeData) {
    this.logger.log(
      `Reorganizando hierarquia na sessão ${sessionId} (parent: ${data.parentGranularity}, child: ${data.childGranularity}, mode: ${data.mode || 'auto'})`,
    );

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
      include: {
        blocks: {
          orderBy: [{ order: 'asc' }, { startAt: 'asc' }],
        },
      },
    });

    if (!planning) return;

    const parentGranularity = data.parentGranularity as PlanningGranularity;
    const childGranularity = data.childGranularity as PlanningGranularity;

    const existingParentBlocks = planning.blocks.filter((b) => b.granularity === parentGranularity);
    const existingChildBlocks = planning.blocks.filter((b) => b.granularity === childGranularity);

    const isSubdivideMode =
      data.mode === 'SUBDIVIDE' ||
      (parentGranularity === 'MONTHLY' && childGranularity === 'WEEKLY' && existingParentBlocks.length > 0) ||
      (existingParentBlocks.length > 0 && existingChildBlocks.length === 0);

    if (isSubdivideMode) {
      await this.executeSubdivision(planning.id, planning, existingParentBlocks, childGranularity);
    } else {
      await this.executeGrouping(planning.id, planning.blocks, parentGranularity, childGranularity);
    }
  }

  /**
   * Subdivisão Top-Down: detalha blocos pais (ex: MONTHLY) em blocos filhos (ex: WEEKLY).
   */
  private async executeSubdivision(
    planningId: string,
    planning: { startAt: Date | null; endAt: Date | null },
    parentBlocks: PlanningBlock[],
    childGranularity: PlanningGranularity,
  ) {
    let globalWeekOrder = 1;

    for (const parentBlock of parentBlocks) {
      // Verifica se o mês já possui a grade semanal completa (ordem >= 4)
      const alreadySubdivided = await this.prisma.planningBlock.findFirst({
        where: {
          planningId,
          parentId: parentBlock.id,
          granularity: childGranularity,
          order: { gte: 4 },
        },
      });
      if (alreadySubdivided) {
        continue;
      }

      // Verifica se existem blocos diários vinculados diretamente a este bloco pai
      const directDailyChildren = await this.prisma.planningBlock.findMany({
        where: {
          planningId,
          parentId: parentBlock.id,
          granularity: 'DAILY',
        },
        orderBy: [{ order: 'asc' }, { startAt: 'asc' }],
      });

      if (directDailyChildren.length > 0) {
        // Agrupa os dias existentes por semana e gera os blocos semanais vinculados ao mês
        const weekGroups = this.groupBlocksByWeek(directDailyChildren);
        for (let wIdx = 0; wIdx < weekGroups.length; wIdx++) {
          const group = weekGroups[wIdx];
          const first = group[0];
          const last = group[group.length - 1];

          const weeklyBlock = await this.prisma.planningBlock.create({
            data: {
              planningId,
              parentId: parentBlock.id,
              granularity: childGranularity,
              order: wIdx + 1,
              startAt: first.startAt ? getMondayOfWeek(first.startAt) : first.startAt,
              endAt: last.endAt || (last.startAt ? getFridayOfWeek(getMondayOfWeek(last.startAt)) : last.startAt),
              metodologia: `Semana ${wIdx + 1}`,
            },
          });

          await this.prisma.planningBlock.updateMany({
            where: {
              id: { in: group.map((b) => b.id) },
            },
            data: {
              parentId: weeklyBlock.id,
            },
          });
        }
      } else {
        // Gera novos blocos semanais calculados dentro do intervalo do mês, preservando semanas já existentes
        const pStart = parentBlock.startAt || planning.startAt;
        const pEnd = parentBlock.endAt || planning.endAt;

        if (pStart && pEnd && childGranularity === 'WEEKLY') {
          const weeks = computeWeeksForPeriod(pStart, pEnd);
          for (const week of weeks) {
            const exists = await this.prisma.planningBlock.findFirst({
              where: {
                planningId,
                parentId: parentBlock.id,
                granularity: childGranularity,
                order: week.order,
              },
            });
            if (exists) continue;

            await this.prisma.planningBlock.create({
              data: {
                planningId,
                parentId: parentBlock.id,
                granularity: childGranularity,
                order: week.order,
                startAt: week.startAt,
                endAt: week.endAt,
                metodologia: `Semana ${week.order}`,
              },
            });
          }
        } else {
          // Fallback para 4 blocos se datas precisas não estiverem disponíveis
          const fallbackCount = childGranularity === 'WEEKLY' ? 4 : 2;
          for (let i = 1; i <= fallbackCount; i++) {
            const exists = await this.prisma.planningBlock.findFirst({
              where: {
                planningId,
                parentId: parentBlock.id,
                granularity: childGranularity,
                order: i,
              },
            });
            if (exists) continue;

            await this.prisma.planningBlock.create({
              data: {
                planningId,
                parentId: parentBlock.id,
                granularity: childGranularity,
                order: i,
                metodologia: `Semana ${i}`,
              },
            });
          }
        }
      }

      globalWeekOrder += 4;
    }
  }

  /**
   * Agrupamento Bottom-Up: agrupa blocos filhos existentes (ex: DAILY) em blocos pais (ex: WEEKLY)
   * respeitando as semanas do calendário real e preservando a árvore de pais (ex: mês pai).
   */
  private async executeGrouping(
    planningId: string,
    allBlocks: PlanningBlock[],
    parentGranularity: PlanningGranularity,
    childGranularity: PlanningGranularity,
  ) {
    const childBlocks = allBlocks.filter((b) => b.granularity === childGranularity);
    if (childBlocks.length === 0) return;

    // Agrupa por parentId existente primeiro (para não mesclar semanas entre meses distintos)
    const blocksByParent = new Map<string, PlanningBlock[]>();
    for (const b of childBlocks) {
      const pKey = b.parentId || 'root';
      if (!blocksByParent.has(pKey)) {
        blocksByParent.set(pKey, []);
      }
      blocksByParent.get(pKey)!.push(b);
    }

    let globalOrder = 1;

    for (const [pKey, blocks] of blocksByParent.entries()) {
      const parentMonthId = pKey === 'root' ? null : pKey;
      const weekGroups = this.groupBlocksByWeek(blocks);

      for (let i = 0; i < weekGroups.length; i++) {
        const slice = weekGroups[i];
        const first = slice[0];
        const last = slice[slice.length - 1];

        const startAt = first.startAt ? getMondayOfWeek(first.startAt) : first.startAt;
        const endAt = last.endAt || (last.startAt ? getFridayOfWeek(getMondayOfWeek(last.startAt)) : last.startAt);

        const parentBlock = await this.prisma.planningBlock.create({
          data: {
            planningId,
            granularity: parentGranularity,
            parentId: parentMonthId,
            startAt,
            endAt,
            order: i + 1,
            metodologia: `Semana ${i + 1}`,
          },
        });

        await this.prisma.planningBlock.updateMany({
          where: {
            id: { in: slice.map((s) => s.id) },
          },
          data: {
            parentId: parentBlock.id,
          },
        });

        globalOrder++;
      }
    }
  }

  /**
   * Agrupa blocos por semana real do calendário ou por tamanho fixo (5) se não houver datas.
   */
  private groupBlocksByWeek(blocks: PlanningBlock[]): PlanningBlock[][] {
    const hasDates = blocks.some((b) => b.startAt !== null);

    if (!hasDates) {
      const groups: PlanningBlock[][] = [];
      const chunkSize = 5;
      for (let i = 0; i < blocks.length; i += chunkSize) {
        groups.push(blocks.slice(i, i + chunkSize));
      }
      return groups;
    }

    const weekMap = new Map<string, PlanningBlock[]>();

    for (const block of blocks) {
      if (block.startAt) {
        const monday = getMondayOfWeek(block.startAt);
        const key = monday.toISOString().slice(0, 10);
        if (!weekMap.has(key)) {
          weekMap.set(key, []);
        }
        weekMap.get(key)!.push(block);
      } else {
        const key = 'sem-data';
        if (!weekMap.has(key)) {
          weekMap.set(key, []);
        }
        weekMap.get(key)!.push(block);
      }
    }

    return Array.from(weekMap.values());
  }
}
