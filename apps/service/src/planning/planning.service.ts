import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  PlanningPatchPayload,
  SinglePatchOperation,
} from '../ai/patch/planning-patch.schema.js';
import {
  UpsertPlanningUseCase,
  SwapBlockByDateUseCase,
  BatchUpdateColumnUseCase,
  AddSpecificationWithSlotsUseCase,
  FillPlanningMetadataUseCase,
  DeleteBlockUseCase,
  ReorganizeHierarchyUseCase,
  ResetPlanningUseCase,
  ReallocateLessonsUseCase,
} from './use-cases/index.js';
import type { PlanningResponseDto } from './dto/planning-response.dto.js';

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly upsertPlanningUseCase: UpsertPlanningUseCase,
    private readonly swapBlockByDateUseCase: SwapBlockByDateUseCase,
    private readonly batchUpdateColumnUseCase: BatchUpdateColumnUseCase,
    private readonly addSpecificationWithSlotsUseCase: AddSpecificationWithSlotsUseCase,
    private readonly fillPlanningMetadataUseCase: FillPlanningMetadataUseCase,
    private readonly deleteBlockUseCase: DeleteBlockUseCase,
    private readonly reorganizeHierarchyUseCase: ReorganizeHierarchyUseCase,
    private readonly resetPlanningUseCase: ResetPlanningUseCase,
    private readonly reallocateLessonsUseCase: ReallocateLessonsUseCase,
  ) {}

  /**
   * Aplica um payload estruturado de patch emitido pela IA na sessão informada.
   */
  async applyPatch(sessionId: string, payload: PlanningPatchPayload): Promise<void> {
    const operations: SinglePatchOperation[] =
      'operations' in payload ? payload.operations : [payload];

    for (const op of operations) {
      this.logger.log(`Aplicando operação ${op.operation} na sessão ${sessionId}`);
      switch (op.operation) {
        case 'UPSERT_PLANNING':
          await this.upsertPlanningUseCase.execute(sessionId, op.data);
          break;
        case 'UPDATE_BLOCK_BY_DATE':
          await this.swapBlockByDateUseCase.execute(sessionId, op.data);
          break;
        case 'BATCH_UPDATE_COLUMN':
          await this.batchUpdateColumnUseCase.execute(sessionId, op.data);
          break;
        case 'ADD_SPECIFICATION':
          await this.addSpecificationWithSlotsUseCase.execute(sessionId, op.data);
          break;
        case 'FILL_METADATA':
          await this.fillPlanningMetadataUseCase.execute(sessionId, op.data);
          break;
        case 'DELETE_BLOCK_WITH_GAP':
          await this.deleteBlockUseCase.execute(sessionId, op.data);
          break;
        case 'REORGANIZE_TREE':
          await this.reorganizeHierarchyUseCase.execute(sessionId, op.data);
          break;
        case 'RESET_PLANNING':
          await this.resetPlanningUseCase.execute(sessionId);
          break;
        case 'REALLOCATE_LESSONS':
          await this.reallocateLessonsUseCase.execute(sessionId, op.data);
          break;
        case 'READ_ONLY':
          // Consulta somente leitura: zero mutações
          break;
      }
    }
  }

  /**
   * Retorna a árvore completa do planejamento e especificações da sessão (pronta para o PlanningViewer).
   */
  async getPlanningBySessionId(sessionId: string): Promise<PlanningResponseDto> {
    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
      include: {
        school: true,
        applicationYear: true,
        curricularComponents: true,
        learningObjectives: {
          include: { bnccSkill: true },
        },
        evaluations: true,
        metadataValues: {
          include: { specification: true },
        },
        blocks: {
          orderBy: [{ order: 'asc' }, { startAt: 'asc' }],
          include: {
            learningObjectives: {
              include: { bnccSkill: true },
            },
            evaluations: true,
            metadataValues: {
              include: { specification: true },
            },
          },
        },
      },
    });

    const specifications = await this.prisma.specification.findMany({
      where: { sessionId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      planning: planning as any,
      specifications,
    };
  }
}
