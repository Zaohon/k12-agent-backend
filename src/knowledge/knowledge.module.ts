import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma.service';
import { OssModule } from '../oss/oss.module';

@Module({
  imports: [OssModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, PrismaService],
})
export class KnowledgeModule {}
