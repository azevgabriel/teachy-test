import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { AiModule } from '../ai/ai.module.js';
import { PlanningModule } from '../planning/planning.module.js';

@Module({
  imports: [AiModule, PlanningModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
