import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { PlanningGranularity } from '@prisma/client';

type DeleteBlockData = Extract<SinglePatchOperation, { operation: 'DELETE_BLOCK_WITH_GAP' }>['data'];

@Injectable()
export class DeleteBlockUseCase {
  private readonly logger = new Logger(DeleteBlockUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: DeleteBlockData) {
    this.logger.log(`Executando exclusão de bloco na sessão ${sessionId}: ${JSON.stringify(data)}`);

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) return null;

    // Caso 1: Exclusão de uma camada inteira de granularidade (ex: "remove o diário", "deixe apenas mês e semana")
    if (data.granularity && !data.blockId && !data.date && data.order === undefined) {
      const granularity = data.granularity as PlanningGranularity;
      this.logger.log(`Removendo toda a camada de granularidade ${granularity} na sessão ${sessionId}`);

      const blocksToDelete = await this.prisma.planningBlock.findMany({
        where: {
          planningId: planning.id,
          granularity,
        },
        include: {
          children: true,
        },
      });

      if (blocksToDelete.length === 0) {
        this.logger.warn(`Nenhum bloco com granularidade ${granularity} encontrado na sessão ${sessionId}`);
        return null;
      }

      // Se os blocos a serem removidos possuem filhos, reparenta os filhos para o pai do bloco removido
      // para evitar que onDelete: Cascade apague acidentalmente camadas filhas que o professor deseja manter
      for (const block of blocksToDelete) {
        if (block.children && block.children.length > 0) {
          await this.prisma.planningBlock.updateMany({
            where: { parentId: block.id },
            data: { parentId: block.parentId || null },
          });
        }
      }

      const deleted = await this.prisma.planningBlock.deleteMany({
        where: {
          planningId: planning.id,
          granularity,
        },
      });

      return {
        deletedCount: deleted.count,
        granularity: data.granularity,
      };
    }

    // Caso 2: Exclusão pontual de um único bloco por ID, data ou ordem
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
          ...(data.granularity ? { granularity: data.granularity as PlanningGranularity } : {}),
        },
      });
    } else if (data.order !== undefined) {
      targetBlock = await this.prisma.planningBlock.findFirst({
        where: {
          planningId: planning.id,
          order: data.order,
          ...(data.granularity ? { granularity: data.granularity as PlanningGranularity } : {}),
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
