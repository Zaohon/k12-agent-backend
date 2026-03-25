import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGatewayService } from './chat.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChatController],
  providers: [ChatGatewayService, PrismaService],
})
export class ChatModule {}
