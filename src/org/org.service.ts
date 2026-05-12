import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  async listOrganizations(currentUser: any) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('仅超级管理员可操作');
    return this.prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, agents: true }
        },
        users: {
          where: { role: 'SCHOOL_ADMIN' },
          select: { username: true }
        }
      }
    });
  }

  async createOrganization(currentUser: any, orgName: string) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('仅超级管理员可操作');
    
    const exist = await this.prisma.organization.findUnique({ where: { orgName } });
    if (exist) throw new BadRequestException('该组织名已存在');
    
    return this.prisma.organization.create({
      data: { orgName }
    });
  }

  async createOrgAdmin(currentUser: any, orgId: number, username: string, passwordHash: string) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('仅超级管理员可操作');
    
    const existInfo = await this.prisma.user.findUnique({ where: { username } });
    if (existInfo) throw new BadRequestException('该管理员账号名已被占用');

    const hash = await bcrypt.hash(passwordHash, 10);
    return this.prisma.user.create({
      data: {
        username,
        passwordHash: hash,
        passwordSetAt: new Date(),
        role: 'SCHOOL_ADMIN',
        orgId
      }
    });
  }

  async getOrgUsers(currentUser: any, orgId: number) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('权限不足');
    return this.prisma.user.findMany({
      where: { orgId },
      orderBy: { role: 'asc' },
      select: { id: true, username: true, role: true, createdAt: true }
    });
  }

  async batchCreateUsers(currentUser: any, orgId: number, users: any[]) {
    if (currentUser.role !== 'SUPER_ADMIN') throw new ForbiddenException('权限不足');
    let successCount = 0;
    
    // Identity mapping based on Excel chinese descriptions
    const roleMapping: Record<string, string> = {
       '学生': 'STUDENT',
       '老师': 'TEACHER',
       '家长': 'PARENT',
       '管理员': 'SCHOOL_ADMIN'
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
                 orgId 
              }
           });
           successCount++;
       }
    }
    return { count: successCount };
  }
}
