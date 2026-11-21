import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AiModule } from './ai/ai.module.js';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [PrismaModule, AiModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

