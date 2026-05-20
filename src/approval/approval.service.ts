import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  async listPending(user: any) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
      throw new ForbiddenException('权限不足');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { orgId: true },
    });

    let orgId = currentUser?.orgId ?? user.orgId;
    if (!orgId && user.role === 'SUPER_ADMIN') {
      orgId = (
        await this.prisma.organization.findUnique({
          where: { orgName: '公共网点 (默认)' },
          select: { id: true },
        })
      )?.id;
    }

    if (!orgId) {
      throw new ForbiddenException('当前账号未绑定组织');
    }

    // 审批列表按“当前账号所属组织”返回，包含该组织下所有审批状态
    return this.prisma.agent.findMany({
      where: {
        orgId,
        deletedAt: null,
      },
      include: {
        creator: { select: { username: true, role: true } },
        organization: { select: { orgName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async review(user: any, agentId: number, status: 'APPROVED' | 'REJECTED', extra: { categoryId?: number, isFeatured?: boolean } = {}) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new ForbiddenException('Agent not found');

    if (user.role !== 'SCHOOL_ADMIN') {
      throw new ForbiddenException('权限不足');
    }

    if (agent.orgId !== user.orgId) throw new ForbiddenException('只能审批当前组织的申请');
    if (agent.visibility === 'PUBLIC') throw new ForbiddenException('发布到公共池需要超级管理员审批');

    // Process category link
    if (status === 'APPROVED' && extra.categoryId) {
      await this.prisma.agentCategory.upsert({
        where: { agentId_categoryId: { agentId, categoryId: extra.categoryId } },
        create: { agentId, categoryId: extra.categoryId },
        update: {},
      });
    }

    return this.prisma.agent.update({
      where: { id: agentId },
      data: {
        approvalStatus: status,
        isFeatured: extra.isFeatured ?? agent.isFeatured,
      },
    });
  }
}
