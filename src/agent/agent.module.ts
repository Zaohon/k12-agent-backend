import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { PrismaService } from '../prisma.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [AgentController],
  providers: [AgentService, PrismaService],
  exports: [AgentService],
})
export class AgentModule {}
