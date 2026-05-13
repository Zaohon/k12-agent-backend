import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  async listPending(user: any) {
    if (user.role === 'SUPER_ADMIN') {
      // Super admins see ALL pending agents
      return this.prisma.agent.findMany({
        where: { approvalStatus: 'PENDING' },
        include: { creator: { select: { username: true, role: true } }, organization: { select: { orgName: true } } },
        orderBy: { updatedAt: 'desc' }
      });
    } else if (user.role === 'SCHOOL_ADMIN') {
      // School admin targets org visible applications within their org
      return this.prisma.agent.findMany({
        where: { 
          approvalStatus: 'PENDING', 
          orgId: user.orgId 
        },
        include: { creator: { select: { username: true, role: true } }, organization: { select: { orgName: true } } },
        orderBy: { updatedAt: 'desc' }
      });
    } else {
      throw new ForbiddenException('权限不足');
    }
  }

  async review(user: any, agentId: number, status: 'APPROVED' | 'REJECTED', extra: { categoryId?: number, isFeatured?: boolean } = {}) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new ForbiddenException('Agent not found');

    if (user.role === 'SCHOOL_ADMIN') {
      if (agent.orgId !== user.orgId) throw new ForbiddenException('只能审批当前组织的申请');
      if (agent.visibility === 'PUBLIC') throw new ForbiddenException('发布到公共池需要超级管理员审批');
    } else if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('权限不足');
    }

    // Process category link
    if (status === 'APPROVED' && extra.categoryId) {
       await this.prisma.agentCategory.upsert({
          where: { agentId_categoryId: { agentId, categoryId: extra.categoryId } },
          create: { agentId, categoryId: extra.categoryId },
          update: {} // No change needed if exists
       });
    }

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { 
        approvalStatus: status,
        isFeatured: extra.isFeatured ?? agent.isFeatured
      }
    });
  }
}
