import { Controller, Get, Post, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('model-config')
@UseGuards(JwtAuthGuard)
export class ModelConfigController {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  /**
   * 获取当前用户所在组织的配置（仅管理员可访问）
   */
  @Get()
  async getConfig(@Req() req: any) {
    const user = req.user;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
      throw new ForbiddenException('仅管理员可访问');
    }
    const config = await this.modelConfigService.getConfigForOrg(user.orgId);
    return { success: true, data: config };
  }

  /**
   * 创建或更新当前组织的配置
   */
  @Post()
  async upsertConfig(@Req() req: any, @Body() body: any) {
    const config = await this.modelConfigService.upsertConfigForOrg(req.user, body);
    return { success: true, data: config };
  }
}
