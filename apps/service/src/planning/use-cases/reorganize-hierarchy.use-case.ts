import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { PlanningGranularity } from '@prisma/client';

type ReorganizeTreeData = Extract<SinglePatchOperation, { operation: 'REORGANIZE_TREE' }>['data'];

@Injectable()
export class ReorganizeHierarchyUseCase {
  private readonly logger = new Logger(ReorganizeHierarchyUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: ReorganizeTreeData) {
    this.logger.log(`Reorganizando hierarquia na sessão ${sessionId}`);

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) return;

    const childBlocks = await this.prisma.planningBlock.findMany({
      where: {
        planningId: planning.id,
        granularity: data.childGranularity as PlanningGranularity,
      },
      orderBy: [{ startAt: 'asc' }, { order: 'asc' }],
    });

    if (childBlocks.length === 0) return;

    // Agrupa blocos filhos em semanas ou blocos pais
    const chunkSize = data.parentGranularity === 'WEEKLY' ? 5 : 4;
    for (let i = 0; i < childBlocks.length; i += chunkSize) {
      const slice = childBlocks.slice(i, i + chunkSize);
      const first = slice[0];
      const last = slice[slice.length - 1];

      const parentBlock = await this.prisma.planningBlock.create({
        data: {
          planningId: planning.id,
          granularity: data.parentGranularity as PlanningGranularity,
          startAt: first.startAt,
          endAt: last.endAt || last.startAt,
          order: Math.floor(i / chunkSize) + 1,
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
    }
  }
}
