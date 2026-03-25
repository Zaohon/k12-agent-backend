import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TokenLimitGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Assuming user ID is injected by prior JwtAuthGuard
    const user = request.user;
    
    if (!user) {
      return false;
    }

    // Fetch latest user token limit data from DB
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenLimit: true, consumedToken: true }
    });

    if (!dbUser) {
      throw new ForbiddenException('User not found.');
    }

    const remaining = dbUser.tokenLimit - dbUser.consumedToken;
    if (remaining <= 0) {
      throw new ForbiddenException('您的余额大模型额度已耗尽，请联系学校管理员或平台充值。');
    }

    // Add remaining info to request for the controller to use limits
    request.user.remainingTokens = remaining;

    return true;
  }
}
