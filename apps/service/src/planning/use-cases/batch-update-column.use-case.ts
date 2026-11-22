import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { PlanningGranularity } from '@prisma/client';

type BatchUpdateData = Extract<SinglePatchOperation, { operation: 'BATCH_UPDATE_COLUMN' }>['data'];

@Injectable()
export class BatchUpdateColumnUseCase {
  private readonly logger = new Logger(BatchUpdateColumnUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: BatchUpdateData) {
    this.logger.log(`Executando BatchUpdateColumn para ${data.colName} na granularidade ${data.granularity}`);

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) return;

    const granularity = data.granularity as PlanningGranularity;

    // 1. Se for a coluna física metodologia:
    if (data.colName.toLowerCase() === 'metodologia') {
      await this.prisma.planningBlock.updateMany({
        where: {
          planningId: planning.id,
          granularity,
          ...(data.filterParentId ? { parentId: data.filterParentId } : {}),
        },
        data: {
          metodologia: data.content,
        },
      });
      return;
    }

    // 2. Se for uma coluna customizada EAV de Specification:
    const spec = await this.prisma.specification.findFirst({
      where: {
        sessionId,
        colName: { equals: data.colName, mode: 'insensitive' },
      },
    });

    if (!spec) return;

    const blocks = await this.prisma.planningBlock.findMany({
      where: {
        planningId: planning.id,
        granularity,
        ...(data.filterParentId ? { parentId: data.filterParentId } : {}),
      },
    });

    for (const b of blocks) {
      const existingValue = await this.prisma.planningMetadataValue.findFirst({
        where: {
          specificationId: spec.id,
          planningBlockId: b.id,
        },
      });

      if (existingValue) {
        await this.prisma.planningMetadataValue.update({
          where: { id: existingValue.id },
          data: { textValue: data.content },
        });
      } else {
        await this.prisma.planningMetadataValue.create({
          data: {
            specificationId: spec.id,
            planningBlockId: b.id,
            planningId: null, // XOR
            textValue: data.content,
          },
        });
      }
    }
  }
}
