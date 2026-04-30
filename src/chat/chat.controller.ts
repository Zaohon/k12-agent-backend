import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private prisma: PrismaService) {}

  /**
   * Educational Agent Usage - One-shot, No persistence
   */
  @Post('stream/:agentId')
  async streamChat(
    @Req() req: any,
    @Param('agentId', ParseIntPipe) agentId: number,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.consumedToken >= user.tokenLimit) {
      throw new ForbiddenException('您的 Token 额度已耗尽，或账号状态异常。');
    }

    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    let prompt = `${agent.systemPrompt}\n\n【用户填写的内容条件】\n`;
    try {
      const formConfig = JSON.parse(agent.formConfig || '[]');
      formConfig.forEach((field: any) => {
        if (body[field.key]) {
          prompt += `- ${field.label}: ${body[field.key]}\n`;
        }
      });
    } catch (e) {}

    const aiRes = await this.callAI([{ role: 'user', content: prompt }], true);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');

    let fullResponse = '';
    if (aiRes.ok && aiRes.body) {
      // @ts-ignore
      for await (const chunk of aiRes.body) {
        const decoder = new TextDecoder();
        const str = decoder.decode(chunk);
        try {
          const lines = str.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = JSON.parse(line.slice(5));
              fullResponse += data.choices?.[0]?.delta?.content || '';
            }
          }
        } catch (e) {}
        res.write(chunk);
      }

      const consumed = prompt.length + fullResponse.length;
      await this.prisma.user.update({
        where: { id: req.user.id },
        data: { consumedToken: { increment: consumed } },
      });
    } else {
      res.write('data: {"error":"AI Service Error"}\n\n');
    }

    res.end();
  }

  private async callAI(messages: any[], stream = false) {
    const apiKey = process.env.AI_API_KEY || '';
    const apiBase = (process.env.AI_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
    const model = process.env.AI_MODEL || 'deepseek-v4-flash';
    return fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
    });
  }
}
