import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrgService {
  private static readonly DEFAULT_ORG_CATEGORY_NAMES = ['精选页', '推荐页'];

  constructor(private prisma: PrismaService) {}

  async listOrganizations(currentUser: any) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('仅超级管理员可操作');
    return this.prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, agents: true },
        },
        users: {
          where: { role: 'SCHOOL_ADMIN' },
          select: { username: true },
        },
      },
    });
  }

  async createOrganization(currentUser: any, orgName: string) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('仅超级管理员可操作');

    const exist = await this.prisma.organization.findUnique({ where: { orgName } });
    if (exist) throw new BadRequestException('该组织名已存在');

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { orgName },
      });

      await tx.category.createMany({
        data: OrgService.DEFAULT_ORG_CATEGORY_NAMES.map((name, idx) => ({
          name,
          orgId: org.id,
          weight: 100 - idx,
        })),
      });

      // 为新组织创建默认模型配置
      await tx.modelConfig.create({
        data: {
          orgId: org.id,
          defaultModel: 'qwen3.6-plus',
          apiBaseUrl: '',
          apiKey: null,
          orgMaxTokenLimit: 4096,
          requestTimeout: 60,
          enableContextMemory: false,
        },
      });

      return org;
    });
  }

  async createOrgAdmin(currentUser: any, orgId: number, userId: number) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('仅超级管理员可操作');

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org || org.deletedAt) {
      throw new BadRequestException('组织不存在');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      throw new BadRequestException('目标用户不存在');
    }
    if (targetUser.role === 'SUPER_ADMIN') {
      throw new BadRequestException('超级管理员账号不能移交为组织管理员');
    }

    return this.prisma.$transaction(async (tx) => {
      // 先撤销当前组织已有管理员（移交语义：仅保留一个组织管理员）
      await tx.user.updateMany({
        where: {
          orgId,
          role: 'SCHOOL_ADMIN',
          deletedAt: null,
        },
        data: { role: 'TEACHER' },
      });

      return tx.user.update({
        where: { id: targetUser.id },
        data: {
          role: 'SCHOOL_ADMIN',
          orgId,
          status: 'ACTIVE',
        },
      });
    });
  }

  async getOrgUsers(currentUser: any, orgId: number) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('权限不足');
    return this.prisma.user.findMany({
      where: { orgId },
      orderBy: { role: 'asc' },
      select: { id: true, username: true, role: true, createdAt: true },
    });
  }

  async batchCreateUsers(currentUser: any, orgId: number, users: any[]) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('权限不足');
    let successCount = 0;

    const roleMapping: Record<string, string> = {
      学生: 'STUDENT',
      老师: 'TEACHER',
      家长: 'PARENT',
      管理员: 'SCHOOL_ADMIN',
    };

    for (const u of users) {
      const roleValue = roleMapping[u.role] || 'STUDENT';
      const exist = await this.prisma.user.findUnique({ where: { username: String(u.username) } });
      if (!exist && u.password) {
        const pwHash = await bcrypt.hash(String(u.password), 10);
        await this.prisma.user.create({
          data: {
            username: String(u.username),
            passwordHash: pwHash,
            passwordSetAt: new Date(),
            role: roleValue,
            orgId,
          },
        });
        successCount++;
      }
    }
    return { count: successCount };
  }
}
