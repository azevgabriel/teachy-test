import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { SpecificationTableRef } from '@prisma/client';

type AddSpecificationData = Extract<SinglePatchOperation, { operation: 'ADD_SPECIFICATION' }>['data'];

@Injectable()
export class AddSpecificationWithSlotsUseCase {
  private readonly logger = new Logger(AddSpecificationWithSlotsUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: AddSpecificationData) {
    this.logger.log(`Registrando especificação ${data.colName} na sessão ${sessionId}`);

    const existing = await this.prisma.specification.findFirst({
      where: {
        sessionId,
        colName: { equals: data.colName, mode: 'insensitive' },
      },
    });

    const tableRef = data.tableRef as SpecificationTableRef;

    let spec;
    if (existing) {
      spec = await this.prisma.specification.update({
        where: { id: existing.id },
        data: {
          customLabel: data.customLabel || existing.customLabel,
          tableRef,
          description: data.description || existing.description,
          isRequired: data.isRequired ?? existing.isRequired,
          order: data.order !== undefined ? data.order : existing.order,
          isVisible: data.isVisible !== undefined ? data.isVisible : existing.isVisible,
          showLabel: data.showLabel !== undefined ? data.showLabel : existing.showLabel,
        },
      });
    } else {
      spec = await this.prisma.specification.create({
        data: {
          sessionId,
          colName: data.colName.toLowerCase().trim(),
          customLabel: data.customLabel || data.colName,
          tableRef,
          description: data.description || null,
          isRequired: data.isRequired ?? false,
          order: data.order ?? 0,
          isVisible: data.isVisible ?? true,
          showLabel: data.showLabel ?? true,
        },
      });
    }

    // Se fornecido initialValue, persiste imediatamente o PlanningMetadataValue para evitar especificação órfã
    if (data.initialValue) {
      const planning = await this.prisma.planning.findFirst({
        where: { sessionId },
      });

      if (planning) {
        if (tableRef === 'PLANNING') {
          const existingMeta = await this.prisma.planningMetadataValue.findFirst({
            where: { specificationId: spec.id, planningId: planning.id },
          });

          if (existingMeta) {
            await this.prisma.planningMetadataValue.update({
              where: { id: existingMeta.id },
              data: { textValue: data.initialValue },
            });
          } else {
            await this.prisma.planningMetadataValue.create({
              data: {
                specificationId: spec.id,
                planningId: planning.id,
                planningBlockId: null,
                textValue: data.initialValue,
              },
            });
          }
        }
      }
    }

    return spec;
  }
}
