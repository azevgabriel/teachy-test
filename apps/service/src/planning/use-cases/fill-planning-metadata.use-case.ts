import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';

type FillMetadataData = Extract<SinglePatchOperation, { operation: 'FILL_METADATA' }>['data'];

@Injectable()
export class FillPlanningMetadataUseCase {
  private readonly logger = new Logger(FillPlanningMetadataUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: FillMetadataData) {
    this.logger.log(`Preenchendo metadados para coluna ${data.colName} na sessão ${sessionId}`);

    let spec = await this.prisma.specification.findFirst({
      where: {
        sessionId,
        colName: { equals: data.colName, mode: 'insensitive' },
      },
    });

    if (!spec) {
      const isMacroHint = data.values.some((v) => !v.blockId && !v.date && v.order === undefined);
      spec = await this.prisma.specification.create({
        data: {
          sessionId,
          colName: data.colName.toLowerCase().trim(),
          customLabel: data.colName,
          tableRef: isMacroHint ? 'PLANNING' : 'PLANNING_BLOCK',
          isRequired: false,
        },
      });
    }

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) return;

    for (const val of data.values) {
      let blockId = val.blockId;

      if (!blockId && val.date) {
        const d = new Date(val.date);
        const nextD = new Date(d);
        nextD.setUTCDate(nextD.getUTCDate() + 1);
        const b = await this.prisma.planningBlock.findFirst({
          where: {
            planningId: planning.id,
            startAt: { gte: d, lt: nextD },
          },
        });
        if (b) blockId = b.id;
      }

      if (!blockId && val.order !== undefined) {
        const b = await this.prisma.planningBlock.findFirst({
          where: {
            planningId: planning.id,
            order: val.order,
          },
        });
        if (b) blockId = b.id;
      }

      const isMacro = spec.tableRef === 'PLANNING';

      if (!isMacro && !blockId) {
        this.logger.warn(
          `Não foi possível resolver o bloco para metadado da coluna ${data.colName}. Ignorando item para não violar constraint XOR.`,
        );
        continue;
      }

      const existing = await this.prisma.planningMetadataValue.findFirst({
        where: {
          specificationId: spec.id,
          ...(isMacro ? { planningId: planning.id } : { planningBlockId: blockId }),
        },
      });

      if (existing) {
        await this.prisma.planningMetadataValue.update({
          where: { id: existing.id },
          data: {
            textValue: val.textValue || existing.textValue,
            jsonbValue: (val.jsonbValue as any) ?? existing.jsonbValue,
          },
        });
      } else {
        await this.prisma.planningMetadataValue.create({
          data: {
            specificationId: spec.id,
            planningId: isMacro ? planning.id : null,
            planningBlockId: isMacro ? null : blockId,
            textValue: val.textValue || null,
            jsonbValue: (val.jsonbValue as any) ?? null,
          },
        });
      }
    }
  }
}
