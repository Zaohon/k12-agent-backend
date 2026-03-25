import { Controller, Request, Post, UseGuards, Body, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误！');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: any) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('缺少账号或密码信息！');
    }
    return this.authService.register(body);
  }

  @UseGuards(require('../auth/jwt-auth.guard').JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const user = await this.authService.findFullUser(req.user.id);
    return { success: true, data: user };
  }

  @UseGuards(require('../auth/jwt-auth.guard').JwtAuthGuard)
  @Post('update-password')
  async updatePassword(@Request() req: any, @Body() body: any) {
    await this.authService.updatePassword(req.user.id, body.newPassword);
    return { success: true };
  }
}
