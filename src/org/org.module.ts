import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OrgController],
  providers: [OrgService, PrismaService]
})
export class OrgModule {}
