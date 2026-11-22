import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { PlanningService } from './planning.service.js';
import { ExportPlanningUseCase } from './use-cases/export-planning.use-case.js';
import type { PlanningResponseDto } from './dto/planning-response.dto.js';

@Controller('api/sessions/:sessionId/planning')
export class PlanningController {
  constructor(
    private readonly planningService: PlanningService,
    private readonly exportPlanningUseCase: ExportPlanningUseCase,
  ) {}

  @Get()
  async getPlanning(
    @Param('sessionId') sessionId: string,
  ): Promise<PlanningResponseDto> {
    return this.planningService.getPlanningBySessionId(sessionId);
  }

  @Get('export')
  async exportPlanning(
    @Param('sessionId') sessionId: string,
    @Query('format') format?: 'pdf' | 'docx',
    @Query('orientation') orientation?: 'portrait' | 'landscape',
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.exportPlanningUseCase.execute(sessionId, {
      format,
      orientation,
    });

    res?.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  @Post('export')
  async exportPlanningPost(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      format?: 'pdf' | 'docx';
      orientation?: 'portrait' | 'landscape';
      html?: string;
    },
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.exportPlanningUseCase.execute(sessionId, body);

    res?.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  @Get('pdf')
  async exportPdfAlias(
    @Param('sessionId') sessionId: string,
    @Query('orientation') orientation?: 'portrait' | 'landscape',
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    return this.exportPlanning(sessionId, 'pdf', orientation, res);
  }
}

