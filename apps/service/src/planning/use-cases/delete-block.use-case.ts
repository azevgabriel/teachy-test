import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';

type DeleteBlockData = Extract<SinglePatchOperation, { operation: 'DELETE_BLOCK_WITH_GAP' }>['data'];

@Injectable()
export class DeleteBlockUseCase {
  private readonly logger = new Logger(DeleteBlockUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: DeleteBlockData) {
    this.logger.log(`Excluindo bloco para sessão ${sessionId}`);

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) return null;

    let targetBlock = null;

    if (data.blockId) {
      targetBlock = await this.prisma.planningBlock.findFirst({
        where: { id: data.blockId, planningId: planning.id },
      });
    } else if (data.date) {
      const d = new Date(data.date);
      const nextD = new Date(d);
      nextD.setUTCDate(nextD.getUTCDate() + 1);
      targetBlock = await this.prisma.planningBlock.findFirst({
        where: {
          planningId: planning.id,
          startAt: { gte: d, lt: nextD },
        },
      });
    } else if (data.order !== undefined) {
      targetBlock = await this.prisma.planningBlock.findFirst({
        where: {
          planningId: planning.id,
          order: data.order,
        },
      });
    }

    if (!targetBlock) {
      this.logger.warn(`Bloco para exclusão não localizado na sessão ${sessionId}`);
      return null;
    }

    // Exclusão em cascata pelo Prisma
    await this.prisma.planningBlock.delete({
      where: { id: targetBlock.id },
    });

    return {
      deletedBlockId: targetBlock.id,
      gapDate: targetBlock.startAt,
    };
  }
}
