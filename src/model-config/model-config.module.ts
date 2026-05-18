import { Module } from '@nestjs/common';
import { ModelConfigController } from './model-config.controller';
import { ModelConfigService } from './model-config.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ModelConfigController],
  providers: [ModelConfigService, PrismaService],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
