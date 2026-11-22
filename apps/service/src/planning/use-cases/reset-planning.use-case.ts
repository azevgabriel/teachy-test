import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ResetPlanningUseCase {
  private readonly logger = new Logger(ResetPlanningUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string) {
    this.logger.log(`Executando reset completo do planejamento para a sessão ${sessionId}`);

    await this.prisma.planning.deleteMany({
      where: { sessionId },
    });

    await this.prisma.specification.deleteMany({
      where: { sessionId },
    });
  }
}
