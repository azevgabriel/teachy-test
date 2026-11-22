import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';

type SwapBlockData = Extract<SinglePatchOperation, { operation: 'UPDATE_BLOCK_BY_DATE' }>['data'];

@Injectable()
export class SwapBlockByDateUseCase {
  private readonly logger = new Logger(SwapBlockByDateUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: SwapBlockData) {
    this.logger.log(`Executando SwapBlockByDate para data ${data.date} na sessão ${sessionId}`);

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) {
      throw new NotFoundException(`Planejamento não encontrado para a sessão ${sessionId}`);
    }

    const targetDate = new Date(data.date);
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const block = await this.prisma.planningBlock.findFirst({
      where: {
        planningId: planning.id,
        startAt: { gte: targetDate, lt: nextDay },
      },
    });

    if (!block) {
      this.logger.warn(`Bloco na data ${data.date} não encontrado.`);
      return null;
    }

    const updated = await this.prisma.planningBlock.update({
      where: { id: block.id },
      data: data.metodologia ? { metodologia: data.metodologia } : {},
    });

    if (data.bnccCodes && data.bnccCodes.length > 0) {
      const skills = await this.prisma.bnccSkill.findMany({
        where: { code: { in: data.bnccCodes } },
      });

      for (const s of skills) {
        const hasObj = await this.prisma.learningObjective.findFirst({
          where: { planningBlockId: block.id, bnccSkillId: s.id },
        });
        if (!hasObj) {
          await this.prisma.learningObjective.create({
            data: {
              planningBlockId: block.id,
              bnccSkillId: s.id,
              planningId: null,
            },
          });
        }
      }
    }

    return updated;
  }
}
