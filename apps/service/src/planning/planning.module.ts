import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PlanningController } from './planning.controller.js';
import { PlanningService } from './planning.service.js';
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

@Module({
  imports: [PrismaModule],
  controllers: [PlanningController],
  providers: [
    PlanningService,
    UpsertPlanningUseCase,
    SwapBlockByDateUseCase,
    BatchUpdateColumnUseCase,
    AddSpecificationWithSlotsUseCase,
    FillPlanningMetadataUseCase,
    DeleteBlockUseCase,
    ReorganizeHierarchyUseCase,
    ResetPlanningUseCase,
    ReallocateLessonsUseCase,
  ],
  exports: [PlanningService, ReallocateLessonsUseCase],
})
export class PlanningModule {}
