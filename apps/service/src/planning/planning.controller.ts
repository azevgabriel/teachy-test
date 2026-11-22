import { Controller, Get, Param } from '@nestjs/common';
import { PlanningService } from './planning.service.js';
import type { PlanningResponseDto } from './dto/planning-response.dto.js';

@Controller('api/sessions/:sessionId/planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get()
  async getPlanning(@Param('sessionId') sessionId: string): Promise<PlanningResponseDto> {
    return this.planningService.getPlanningBySessionId(sessionId);
  }
}
