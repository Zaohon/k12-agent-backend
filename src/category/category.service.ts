import { Injectable, OnModuleInit } from '@nestjs/common';
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
        { name: '兴趣特长生', weight: 6 }
      ];
      for (const c of demo) {
        await this.prisma.category.create({ data: c });
      }
      console.log('Seeded educational categories.');
    }
  }

  async list() {
    return this.prisma.category.findMany({
      orderBy: { weight: 'desc' }
    });
  }

  async create(data: { name: string, weight?: number, parentId?: number }) {
    return this.prisma.category.create({ data });
  }

  async update(id: number, data: any) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }
}
