import { Controller, Post, Body, Req, UseGuards, Param, Res, NotFoundException, ForbiddenException, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import type { Response } from 'express';

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
    @Res() res: Response
  ) {
    // 0. Quota Check
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.consumedToken >= user.tokenLimit) {
       throw new ForbiddenException('您的 Token 额度已耗尽，或账号状态异常。');
    }

    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    let prompt = agent.systemPrompt + '\n\n【用户填写的内容条件】\n';
    try {
       const formConfig = JSON.parse(agent.formConfig || '[]');
       formConfig.forEach((field: any) => {
           if (body[field.key]) {
               prompt += `- ${field.label}: ${body[field.key]}\n`;
           }
       });
    } catch(e) {}

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
             for(let line of lines) {
                 if (line.startsWith('data:')) {
                    const data = JSON.parse(line.slice(5));
                    fullResponse += data.choices?.[0]?.delta?.content || '';
                 }
             }
          } catch(e) {}
          res.write(chunk);
       }
       
       // Deduct tokens roughly
       const consumed = prompt.length + fullResponse.length;
       await this.prisma.user.update({
          where: { id: req.user.id },
          data: { consumedToken: { increment: consumed } }
       });
    } else {
       res.write('data: {"error": "AI Service Error"}\n\n');
    }
    res.end();
  }

  /**
   * Persistent General AI Q&A - Multi-turn with History
   */
  @Post('stream-session/:sessionId')
  async streamSession(
    @Req() req: any,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() body: { prompt: string },
    @Res() res: Response
  ) {
    const session = await this.prisma.conversation.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== req.user.id) throw new ForbiddenException();

    // 0. Quota Check
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.consumedToken >= user.tokenLimit) {
       throw new ForbiddenException('您的 Token 额度已耗尽，或账号状态异常。');
    }

    // 1. Fetch history (last 10 messages)
    const history = await this.prisma.message.findMany({
      where: { convId: sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    // Reverse to chronological order
    const messages = history.reverse().map(m => ({ 
      role: m.role as 'user' | 'assistant', 
      content: m.content 
    }));

    // 2. Save User Message
    await this.prisma.message.create({
      data: { convId: sessionId, role: 'user', content: body.prompt }
    });
    messages.push({ role: 'user', content: body.prompt });

    // 3. Call AI
    const aiRes = await this.callAI(messages, true);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    
    let fullResponse = '';
    if (aiRes.body) {
      // @ts-ignore
      for await (const chunk of aiRes.body) {
         const decoder = new TextDecoder();
         const str = decoder.decode(chunk);
         // Extract content from SSE format "data: {...}\n\n"
         try {
            const lines = str.split('\n');
            for(let line of lines) {
                if (line.startsWith('data:')) {
                    const data = JSON.parse(line.slice(5));
                    const content = data.choices?.[0]?.delta?.content || '';
                    fullResponse += content;
                }
            }
         } catch(e) {}
         res.write(chunk);
      }
    }

    // 4. Save Assistant Message after stream ends
    if (fullResponse) {
       await this.prisma.message.create({
         data: { convId: sessionId, role: 'assistant', content: fullResponse }
       });
       
       // Deduct tokens
       const consumed = body.prompt.length + fullResponse.length;
       await this.prisma.user.update({
         where: { id: req.user.id },
         data: { consumedToken: { increment: consumed } }
       });

       const currentSession = await this.prisma.conversation.findUnique({ where: { id: sessionId } });
       if (currentSession && currentSession.topic === '新对话') {
          // Trigger title generation in background
          this.generateTopic(sessionId, body.prompt, fullResponse).catch(e => console.error('Topic gen error', e));
       }

       await this.prisma.conversation.update({ 
         where: { id: sessionId }, 
         data: { updatedAt: new Date() } 
       });
    }

    res.end();
  }

  private async generateTopic(sessionId: number, userMsg: string, aiMsg: string) {
    const summaryPrompt = `针对以下对话，总结出一个不超过10个字符的简短标题，不要包含标点符号或引号。对话内容： 用户：${userMsg}。 AI：${aiMsg}`;
    const res = await (await this.callAI([{ role: 'user', content: summaryPrompt }], false)).json();
    const topic = res.choices?.[0]?.message?.content?.trim() || '新对话';
    await this.prisma.conversation.update({
      where: { id: sessionId },
      data: { topic }
    });
  }

  private async callAI(messages: any[], stream = false) {
    const apiKey = process.env.AI_API_KEY || 'sk-sp-4080f1e7e6cb4f578fa5ebfc0de8e31d';
    return fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages,
        stream
      })
    });
  }
}
