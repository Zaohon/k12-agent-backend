import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Standard Login issuance
   */
  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role, orgId: user.orgId };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        remaining_tokens: user.tokenLimit - user.consumedToken
      }
    };
  }

  /**
   * Manual Single Registry (For test/admin purposes or loose signup)
   */
  async register(data: any) {
    const existing = await this.prisma.user.findUnique({ where: { username: data.username }});
    if (existing) {
      throw new BadRequestException('该账号已被注册。');
    }
    
    const hash = await bcrypt.hash(data.password, 10);

    // Bootstrap standard public organization if not exists
    let publicOrg = await this.prisma.organization.findUnique({ where: { orgName: '公共网点 (默认)' } });
    if (!publicOrg) {
      publicOrg = await this.prisma.organization.create({ data: { orgName: '公共网点 (默认)' } });
    }

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hash,
        role: data.role || 'STUDENT', // Defaults to normal user / student
        orgId: publicOrg.id
      }
    });

    return this.login(user);
  }

  async findFullUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true }
    });
    if (!user) return null;
    const { passwordHash, ...result } = user;
    return result;
  }

  async updatePassword(userId: number, newPass: string) {
    const hash = await bcrypt.hash(newPass, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash }
    });
  }
}
