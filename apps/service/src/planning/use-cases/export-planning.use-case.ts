import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface ExportPlanningOptions {
  format?: 'pdf' | 'docx';
  orientation?: 'portrait' | 'landscape';
  html?: string;
}

export interface ExportPlanningResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

@Injectable()
export class ExportPlanningUseCase {
  private readonly logger = new Logger(ExportPlanningUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    sessionId: string,
    options: ExportPlanningOptions = {},
  ): Promise<ExportPlanningResult> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Sessão não encontrada: ${sessionId}`);
    }

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

    if (!planning) {
      throw new NotFoundException(
        `Nenhum planejamento encontrado para a sessão ${sessionId}`,
      );
    }

    const specifications = await this.prisma.specification.findMany({
      where: { sessionId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const format = (options.format || 'pdf').toLowerCase() as 'pdf' | 'docx';
    const orientation = (options.orientation || 'portrait').toLowerCase() as
      | 'portrait'
      | 'landscape';

    const engineUrl =
      process.env.ENGINE_URL ||
      'http://localhost:8080/2015-03-31/functions/function/invocations';

    this.logger.log(
      `Disparando exportação no microsserviço engine (${format}, ${orientation}) para sessão ${sessionId}`,
    );

    let response: globalThis.Response;
    try {
      response = await fetch(engineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          orientation,
          planning,
          specifications,
          html: options.html,
        }),
      });
    } catch (err: any) {
      this.logger.error(
        `Erro de conexão ao microsserviço engine em ${engineUrl}: ${err.message}`,
      );
      throw new InternalServerErrorException(
        `Falha ao conectar com o serviço de renderização: ${err.message}`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Engine retornou status HTTP ${response.status}: ${errorText}`,
      );
      throw new InternalServerErrorException(
        `Falha no processamento do documento: ${errorText}`,
      );
    }

    const lambdaResult = (await response.json()) as {
      statusCode?: number;
      headers?: Record<string, string>;
      isBase64Encoded?: boolean;
      body?: string;
    };

    if (lambdaResult.statusCode && lambdaResult.statusCode >= 400) {
      this.logger.error(
        `Erro retornado pelo handler do Lambda: ${lambdaResult.body}`,
      );
      throw new InternalServerErrorException(
        `Erro na renderização do arquivo: ${lambdaResult.body}`,
      );
    }

    if (!lambdaResult.body) {
      throw new InternalServerErrorException(
        'Resposta vazia recebida do serviço de renderização.',
      );
    }

    const buffer = Buffer.from(lambdaResult.body, 'base64');
    const contentType =
      lambdaResult.headers?.['Content-Type'] ||
      (format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf');

    const contentDisposition =
      lambdaResult.headers?.['Content-Disposition'] || '';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    const filename =
      filenameMatch?.[1] ||
      `planejamento-${sessionId}-${orientation}.${format}`;

    return {
      buffer,
      contentType,
      filename,
    };
  }
}
