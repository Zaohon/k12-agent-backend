import { Controller, Post, Body, Req, UseGuards, Param, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import type { Response } from 'express';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private prisma: PrismaService) {}

  @Post('stream/:agentId')
  async streamChat(
    @Req() req: any,
    @Param('agentId') agentId: string,
    @Body() body: any,
    @Res() res: Response
  ) {
    const agent = await this.prisma.agent.findUnique({ where: { id: parseInt(agentId) } });
    if (!agent) return res.status(404).send('Agent not found');

    let prompt = agent.systemPrompt + '\n\n【用户填写的内容条件】\n';
    try {
       const formConfig = JSON.parse(agent.formConfig || '[]');
       formConfig.forEach((field: any) => {
           if (body[field.key]) {
               prompt += `- ${field.label}: ${body[field.key]}\n`;
           }
       });
    } catch(e) {}

    // Qwen OpenAI-compatible stream API
    const aiRes = await fetch('https://coding.dashscope.aliyuncs.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer sk-sp-4080f1e7e6cb4f578fa5ebfc0de8e31d`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3.5-plus', 
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (aiRes.body) {
      // Node 18+ Web Streams integration
      // @ts-ignore
      for await (const chunk of aiRes.body) {
        res.write(chunk);
      }
    }
    res.end();
  }
}
