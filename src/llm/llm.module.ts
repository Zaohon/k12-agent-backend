import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [LlmService, PrismaService],
  exports: [LlmService],
})
export class LlmModule {}
