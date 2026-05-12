import { Body, Controller, Get, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sms_send')
  async smsSend(@Body() body: any) {
    if (!body?.phone) {
      throw new UnauthorizedException('缺少手机号');
    }
    return this.authService.sendLoginCode(body.phone);
  }

  @Post('login')
  async login(@Body() body: any) {
    if (!body?.phone || !body?.code) {
      throw new UnauthorizedException('缺少手机号或验证码');
    }
    return this.authService.loginByPhoneCode(body.phone, body.code);
  }

  @Post('password-login')
  async passwordLogin(@Body() body: any) {
    if (!body?.account || !body?.password) {
      throw new UnauthorizedException('缺少账号或密码');
    }
    return this.authService.loginByPassword(body.account, body.password);
  }

  @Post('register')
  async register(@Body() body: any) {
    if (!body?.phone || !body?.code) {
      throw new UnauthorizedException('缺少手机号或验证码');
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
    await this.authService.updatePassword(req.user.id, body);
    return { success: true };
  }
}
