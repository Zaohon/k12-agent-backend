import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './agent/agent.module';
import { PrismaService } from './prisma.service';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { OrgModule } from './org/org.module';
import { ApprovalModule } from './approval/approval.module';
import { CategoryModule } from './category/category.module';
import { SessionModule } from './session/session.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { OssModule } from './oss/oss.module';
import { ModelConfigModule } from './model-config/model-config.module';

@Module({
  imports: [
    AgentModule,
    AuthModule,
    ChatModule,
    OrgModule,
    ApprovalModule,
    CategoryModule,
    SessionModule,
    KnowledgeModule,
    OssModule,
    ModelConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
