import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ChatService } from './chat.service.js';
import { createSessionSchema } from './dto/create-session.dto.js';
import { renameSessionSchema } from './dto/rename-session.dto.js';
import { sendMessageSchema } from './dto/send-message.dto.js';

@Controller('api/sessions')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async listSessions() {
    return this.chatService.listSessions();
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.chatService.getSession(id);
  }

  @Post()
  async createSession(@Body() body: unknown) {
    const parseResult = createSessionSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.format());
    }
    return this.chatService.createSession(parseResult.data);
  }

  @Patch(':id')
  async renameSession(@Param('id') id: string, @Body() body: unknown) {
    const parseResult = renameSessionSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.format());
    }
    return this.chatService.renameSession(id, parseResult.data.name);
  }

  @Delete(':id')
  async deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const parseResult = sendMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Corpo da requisição inválido',
        errors: parseResult.error.format(),
      });
    }

    const { text } = parseResult.data;

    // Configurar headers para Server-Sent Events / Chunked streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abortController = new AbortController();

    const onClose = () => {
      if (!res.writableEnded && !abortController.signal.aborted) {
        abortController.abort();
      }
    };

    res.on('close', onClose);

    try {
      const result = await this.chatService.processMessageStream(
        sessionId,
        text,
        abortController.signal,
        (chunk, messageId) => {
          if (!res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({ type: 'chunk', content: chunk, messageId })}\n\n`,
            );
            (res as any).flush?.();
          }
        },
        (messageId) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'init', messageId })}\n\n`);
            (res as any).flush?.();
          }
        },
      );

      if (!res.writableEnded) {
        if (result.cancelled) {
          res.write(
            `data: ${JSON.stringify({ type: 'cancelled', message: result.message })}\n\n`,
          );
        } else {
          res.write(
            `data: ${JSON.stringify({ type: 'done', message: result.message })}\n\n`,
          );
        }
        res.end();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro interno ao processar resposta';
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`,
        );
        res.end();
      }
    } finally {
      res.off('close', onClose);
    }
  }
}
