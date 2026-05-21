import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { PrismaService } from '../prisma.service';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [LlmModule, KnowledgeModule],
  providers: [SessionService, PrismaService],
  controllers: [SessionController]
})
export class SessionModule {}
