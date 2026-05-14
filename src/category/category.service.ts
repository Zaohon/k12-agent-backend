import { BadRequestException, ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoryService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.category.count();
    if (count === 0) {
      const demo = [
        { name: '理科实验室', weight: 10 },
        { name: '语文提分宝典', weight: 9 },
        { name: '英语口语角', weight: 8 },
        { name: '班主任助手', weight: 7 },
        { name: '兴趣特长营', weight: 6 },
      ];
      for (const c of demo) {
        await this.prisma.category.create({ data: c });
      }
      console.log('Seeded educational categories.');
    }
  }

  async list(currentUser: { id: number; role: string; orgId?: number }) {
    if (currentUser.role === 'SUPER_ADMIN') {
      return this.prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: { weight: 'desc' },
      });
    }

    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        OR: [{ orgId: null }, { orgId: currentUser.orgId ?? -1 }],
      },
      orderBy: { weight: 'desc' },
    });
  }

  async getAgentsByCategory(
    currentUser: { id: number; role: string; orgId?: number },
    categoryId: number,
  ) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.deletedAt) {
      throw new ForbiddenException('分类不存在或已删除');
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      if (category.orgId !== null && category.orgId !== currentUser.orgId) {
        throw new ForbiddenException('只能查看当前组织分类');
      }
    }

    const categoryAgents = await this.prisma.agentCategory.findMany({
      where: {
        categoryId,
        deletedAt: null,
        agent: {
          deletedAt: null,
        },
      },
      include: {
        agent: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return categoryAgents.map((item) => item.agent);
  }

  async removeAgentFromCategory(
    currentUser: { id: number; role: string; orgId?: number },
    categoryId: number,
    agentId: number,
  ) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.deletedAt) {
      throw new ForbiddenException('分类不存在或已删除');
    }
    if (currentUser.role !== 'SUPER_ADMIN' && category.orgId !== null && category.orgId !== currentUser.orgId) {
      throw new ForbiddenException('只能操作当前组织分类');
    }

    const relation = await this.prisma.agentCategory.findUnique({
      where: { agentId_categoryId: { agentId, categoryId } },
    });
    if (!relation || relation.deletedAt) {
      throw new ForbiddenException('分类关联不存在');
    }

    await this.prisma.agentCategory.update({
      where: { agentId_categoryId: { agentId, categoryId } },
      data: { status: 'DELETED', deletedAt: new Date() },
    });

    return { success: true };
  }

  async updateCategoryAgentRelation(
    currentUser: { id: number; role: string; orgId?: number },
    categoryId: number,
    agentId: number,
    data: { targetCategoryId?: number; status?: string },
  ) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.deletedAt) {
      throw new ForbiddenException('分类不存在或已删除');
    }
    if (currentUser.role !== 'SUPER_ADMIN' && category.orgId !== null && category.orgId !== currentUser.orgId) {
      throw new ForbiddenException('只能操作当前组织分类');
    }

    const relation = await this.prisma.agentCategory.findUnique({
      where: { agentId_categoryId: { agentId, categoryId } },
      include: { agent: true },
    });
    if (!relation || relation.deletedAt) {
      throw new ForbiddenException('分类关联不存在');
    }

    if (data.targetCategoryId) {
      const targetCategory = await this.prisma.category.findUnique({
        where: { id: data.targetCategoryId },
      });
      if (!targetCategory || targetCategory.deletedAt) {
        throw new ForbiddenException('目标分类不存在或已删除');
      }
      if (currentUser.role !== 'SUPER_ADMIN' && targetCategory.orgId !== null && targetCategory.orgId !== currentUser.orgId) {
        throw new ForbiddenException('只能移动到当前组织分类');
      }
      if (targetCategory.orgId !== null && relation.agent.orgId !== targetCategory.orgId) {
        throw new ForbiddenException('智能体必须与目标分类同组织');
      }

      await this.prisma.$transaction([
        this.prisma.agentCategory.update({
          where: { agentId_categoryId: { agentId, categoryId } },
          data: { status: 'DELETED', deletedAt: new Date() },
        }),
        this.prisma.agentCategory.upsert({
          where: { agentId_categoryId: { agentId, categoryId: data.targetCategoryId } },
          update: { status: 'ACTIVE', deletedAt: null },
          create: {
            agentId,
            categoryId: data.targetCategoryId,
          },
        }),
      ]);

      return { success: true };
    }

    if (data.status) {
      const updateData: any = { status: data.status };
      if (data.status === 'DELETED') {
        updateData.deletedAt = new Date();
      }
      if (data.status === 'ACTIVE') {
        updateData.deletedAt = null;
      }
      await this.prisma.agentCategory.update({
        where: { agentId_categoryId: { agentId, categoryId } },
        data: updateData,
      });
      return { success: true };
    }

    throw new BadRequestException('缺少更新参数');
  }

  async setCategoryAgents(
    currentUser: { id: number; role: string; orgId?: number },
    categoryId: number,
    agentIds: number[],
  ) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.deletedAt) {
      throw new ForbiddenException('分类不存在或已删除');
    }
    if (currentUser.role !== 'SUPER_ADMIN' && category.orgId !== null && category.orgId !== currentUser.orgId) {
      throw new ForbiddenException('只能操作当前组织分类');
    }

    const agents = await this.prisma.agent.findMany({
      where: {
        id: { in: agentIds },
        deletedAt: null,
      },
    });
    if (agents.length !== agentIds.length) {
      throw new BadRequestException('存在无效智能体ID');
    }
    if (category.orgId !== null) {
      const invalidAgent = agents.find((agent) => agent.orgId !== category.orgId);
      if (invalidAgent) {
        throw new ForbiddenException('智能体必须与分类同组织');
      }
    }

    const existingRelations = await this.prisma.agentCategory.findMany({
      where: {
        categoryId,
        deletedAt: null,
      },
    });
    const existingAgentIds = existingRelations.map((item) => item.agentId);
    const toRemove = existingAgentIds.filter((id) => !agentIds.includes(id));
    const toAdd = agentIds.filter((id) => !existingAgentIds.includes(id));

    const operations: any[] = [];
    if (toRemove.length) {
      operations.push(
        this.prisma.agentCategory.updateMany({
          where: {
            categoryId,
            agentId: { in: toRemove },
            deletedAt: null,
          },
          data: {
            status: 'DELETED',
            deletedAt: new Date(),
          },
        }),
      );
    }
    for (const agentId of toAdd) {
      operations.push(
        this.prisma.agentCategory.upsert({
          where: { agentId_categoryId: { agentId, categoryId } },
          update: { status: 'ACTIVE', deletedAt: null },
          create: { agentId, categoryId },
        }),
      );
    }

    await this.prisma.$transaction(operations);
    return { success: true };
  }

  async create(
    currentUser: { id: number; role: string; orgId?: number },
    data: { name: string; weight?: number; parentId?: number; orgId?: number },
  ) {
    if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SCHOOL_ADMIN') {
      throw new ForbiddenException('仅超级管理员或组织管理员可创建分类');
    }

    const categoryOrgId =
      currentUser.role === 'SUPER_ADMIN' ? (data.orgId ?? null) : (currentUser.orgId ?? null);

    return this.prisma.category.create({
      data: {
        name: data.name,
        weight: data.weight ?? 0,
        parentId: data.parentId ?? null,
        orgId: categoryOrgId,
      },
    });
  }

  async update(
    currentUser: { id: number; role: string; orgId?: number },
    id: number,
    data: any,
  ) {
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (!current || current.deletedAt) {
      throw new ForbiddenException('分类不存在或已删除');
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      if (currentUser.role !== 'SCHOOL_ADMIN') {
        throw new ForbiddenException('权限不足');
      }
      if (!currentUser.orgId || current.orgId !== currentUser.orgId) {
        throw new ForbiddenException('只能操作当前组织分类');
      }
    }

    const nextData = { ...data };
    if (currentUser.role !== 'SUPER_ADMIN') {
      delete nextData.orgId;
    }

    return this.prisma.category.update({ where: { id }, data: nextData });
  }

  async delete(currentUser: { id: number; role: string; orgId?: number }, id: number) {
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (!current || current.deletedAt) {
      throw new ForbiddenException('分类不存在或已删除');
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      if (currentUser.role !== 'SCHOOL_ADMIN') {
        throw new ForbiddenException('权限不足');
      }
      if (!currentUser.orgId || current.orgId !== currentUser.orgId) {
        throw new ForbiddenException('只能操作当前组织分类');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });
  }
}
