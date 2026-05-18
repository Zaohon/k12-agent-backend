import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('model-config')
@UseGuards(JwtAuthGuard)
export class ModelConfigController {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  /**
   * 获取当前用户所在组织的配置
   */
  @Get()
  async getConfig(@Req() req: any) {
    const config = await this.modelConfigService.getConfigForOrg(req.user.orgId);
    // 隐藏 apiKey 的完整值
    const safeConfig = config ? { ...config, apiKey: config.apiKey ? '***' : null } : null;
    return { success: true, data: safeConfig };
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
