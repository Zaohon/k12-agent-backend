import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ModelConfigService {
  constructor(private prisma: PrismaService) {}

  /**
   * 检查用户是否为管理员（学校管理员或超级管理员）
   */
  private isAdmin(role: string): boolean {
    return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
  }

  /**
   * 获取当前用户所在组织的配置
   */
  async getConfigForOrg(orgId: number | null) {
    if (!orgId) {
      return null;
    }
    return this.prisma.modelConfig.findFirst({
      where: { orgId, deletedAt: null },
    });
  }

  /**
   * 创建或更新当前用户所在组织的配置
   */
  async upsertConfigForOrg(currentUser: any, data: any) {
    if (!this.isAdmin(currentUser.role)) {
      throw new ForbiddenException('仅管理员可操作');
    }
    if (!currentUser.orgId) {
      throw new ForbiddenException('当前用户未关联组织');
    }

    const orgId = currentUser.orgId;

    const existing = await this.prisma.modelConfig.findFirst({
      where: { orgId, deletedAt: null },
    });

    if (existing) {
      return this.prisma.modelConfig.update({
        where: { id: existing.id },
        data: {
          defaultModel: data.defaultModel ?? existing.defaultModel,
          apiBaseUrl: data.apiBaseUrl ?? existing.apiBaseUrl,
          apiKey: data.apiKey ?? existing.apiKey,
          orgMaxTokenLimit: data.orgMaxTokenLimit ?? existing.orgMaxTokenLimit,
          requestTimeout: data.requestTimeout ?? existing.requestTimeout,
          enableContextMemory: data.enableContextMemory ?? existing.enableContextMemory,
        },
      });
    }

    return this.prisma.modelConfig.create({
      data: {
        orgId,
        defaultModel: data.defaultModel || 'qwen3.6-plus',
        apiBaseUrl: data.apiBaseUrl || '',
        apiKey: data.apiKey || null,
        orgMaxTokenLimit: data.orgMaxTokenLimit ?? 4096,
        requestTimeout: data.requestTimeout ?? 60,
        enableContextMemory: data.enableContextMemory ?? false,
      },
    });
  }

}
