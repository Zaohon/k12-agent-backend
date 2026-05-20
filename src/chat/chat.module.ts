import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChatController],
  providers: [PrismaService],
})
export class ChatModule {}
