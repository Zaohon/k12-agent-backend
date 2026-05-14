import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
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
