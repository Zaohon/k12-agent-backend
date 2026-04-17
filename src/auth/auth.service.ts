import { Injectable, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';

type SmsCodeRecord = {
  code: string;
  expiresAt: number;
  lastSentAt: number;
};

@Injectable()
export class AuthService {
  private readonly smsCodeStore = new Map<string, SmsCodeRecord>();
  private readonly codeTtlMs = 5 * 60 * 1000;
  private readonly codeCooldownMs = 60 * 1000;
  private readonly smsClient: Dysmsapi20170525;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    const config = new OpenApi.Config({
      accessKeyId: process.env.ALI_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALI_SMS_ACCESS_KEY_SECRET,
    });
    config.endpoint = 'dysmsapi.aliyuncs.com';
    this.smsClient = new Dysmsapi20170525(config);
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').trim();
  }

  private validatePhone(phone: string): string {
    const normalized = this.normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized)) {
      throw new BadRequestException('请输入有效的11位手机号');
    }
    return normalized;
  }

  private assertSmsConfig() {
    if (!process.env.ALI_SMS_ACCESS_KEY_ID || !process.env.ALI_SMS_ACCESS_KEY_SECRET) {
      throw new InternalServerErrorException('短信服务配置缺失：AccessKey 未配置');
    }
    if (!process.env.ALI_SMS_TEMPLATE_CODE || !process.env.ALI_SMS_SIGN_NAME) {
      throw new InternalServerErrorException('短信服务配置缺失：签名或模板未配置');
    }
  }

  private async sendAliyunSms(phone: string, code: string) {
    this.assertSmsConfig();
    const signName = (process.env.ALI_SMS_SIGN_NAME || '\u9F99\u8D77\u672A\u6765').trim();

    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName,
      templateCode: process.env.ALI_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    });

    const runtime = new Util.RuntimeOptions({});
    const response = await this.smsClient.sendSmsWithOptions(request, runtime);

    if (response.body?.code !== 'OK') {
      throw new BadRequestException(`短信发送失败: ${response.body?.message || response.body?.code || 'UNKNOWN'}`);
    }

    return response.body;
  }

  async sendLoginCode(phone: string) {
    const normalized = this.validatePhone(phone);
    const now = Date.now();
    const record = this.smsCodeStore.get(normalized);

    if (record && now - record.lastSentAt < this.codeCooldownMs) {
      const retryAfter = Math.ceil((this.codeCooldownMs - (now - record.lastSentAt)) / 1000);
      throw new BadRequestException(`发送过于频繁，请 ${retryAfter}s 后重试`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.sendAliyunSms(normalized, code);

    this.smsCodeStore.set(normalized, {
      code,
      expiresAt: now + this.codeTtlMs,
      lastSentAt: now,
    });

    return {
      success: true,
      message: '验证码已发送',
      expireInSeconds: Math.floor(this.codeTtlMs / 1000),
      ...(process.env.NODE_ENV === 'production' ? {} : { debug_code: code }),
    };
  }

  private async ensurePublicOrg() {
    let publicOrg = await this.prisma.organization.findUnique({
      where: { orgName: '公共网点 (默认)' },
    });
    if (!publicOrg) {
      publicOrg = await this.prisma.organization.create({
        data: { orgName: '公共网点 (默认)' },
      });
    }
    return publicOrg;
  }

  private async makeDefaultUsername(phone: string) {
    const base = 'default';
    const baseUser = await this.prisma.user.findUnique({ where: { username: base } });
    if (!baseUser) return base;

    const suffix = phone.slice(-4);
    let counter = 1;
    while (true) {
      const candidate = `${base}_${suffix}_${counter}`;
      const existed = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!existed) return candidate;
      counter++;
    }
  }

  async loginByPhoneCode(phone: string, code: string) {
    const normalized = this.validatePhone(phone);
    const normalizedCode = String(code || '').trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException('验证码格式错误');
    }

    const record = this.smsCodeStore.get(normalized);
    if (!record) {
      throw new UnauthorizedException('验证码不存在或已过期');
    }

    if (Date.now() > record.expiresAt) {
      this.smsCodeStore.delete(normalized);
      throw new UnauthorizedException('验证码已过期，请重新获取');
    }

    if (record.code !== normalizedCode) {
      throw new UnauthorizedException('验证码错误');
    }

    this.smsCodeStore.delete(normalized);

    let user = await this.prisma.user.findFirst({
      where: { phone: normalized, deletedAt: null },
    });

    if (!user) {
      const org = await this.ensurePublicOrg();
      const username = await this.makeDefaultUsername(normalized);
      const passwordHash = await bcrypt.hash(`${normalized}_${Date.now()}`, 10);

      user = await this.prisma.user.create({
        data: {
          username,
          phone: normalized,
          passwordHash,
          role: 'STUDENT',
          orgId: org.id,
        },
      });
    }

    return this.login(user);
  }

  async login(user: any) {
    const payload = {
      username: user.username,
      phone: user.phone || null,
      sub: user.id,
      role: user.role,
      orgId: user.orgId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone || null,
        role: user.role,
        remaining_tokens: user.tokenLimit - user.consumedToken,
      },
    };
  }

  async register(data: any) {
    if (!data?.phone || !data?.code) {
      throw new BadRequestException('请提供手机号和验证码');
    }
    return this.loginByPhoneCode(data.phone, data.code);
  }

  async findFullUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });
    if (!user) return null;
    const { passwordHash, ...result } = user;
    return result;
  }

  async updatePassword(userId: number, newPass: string) {
    const hash = await bcrypt.hash(newPass, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
  }
}
