import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SessionService {
  private static readonly DEFAULT_TOPIC = '\u65b0\u5bf9\u8bdd';

  constructor(private prisma: PrismaService) {}

  async listSessions(userId: number) {
    return this.prisma.conversation.findMany({
      where: { userId, isDeleted: false, agentId: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createSession(userId: number) {
    return this.prisma.conversation.create({
      data: {
        userId,
        topic: SessionService.DEFAULT_TOPIC,
        agentId: null,
      },
    });
  }

  async getHistory(userId: number, sessionId: number) {
    const session = await this.prisma.conversation.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('会话不存在或无权访问');
    }
    return session.messages;
  }

  async deleteSession(userId: number, sessionId: number) {
    const session = await this.prisma.conversation.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('会话不存在或无权访问');
    }

    return this.prisma.conversation.update({
      where: { id: sessionId },
      data: { isDeleted: true },
    });
  }

  async updateTopic(userId: number, sessionId: number, topic: string) {
    const session = await this.prisma.conversation.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('会话不存在或无权访问');
    }

    return this.prisma.conversation.update({
      where: { id: sessionId },
      data: { topic: topic?.trim() || SessionService.DEFAULT_TOPIC },
    });
  }

  async streamSessionChat(userId: number, sessionId: number, prompt: string, res: Response) {
    const text = (prompt || '').trim();
    if (!text) {
      throw new BadRequestException('prompt 不能为空');
    }

    const session = await this.prisma.conversation.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.isDeleted) {
      throw new ForbiddenException('会话不存在或无权访问');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.consumedToken >= user.tokenLimit) {
      throw new ForbiddenException('您的 Token 额度已耗尽，或账号状态异常。');
    }

    const history = await this.prisma.message.findMany({
      where: { convId: sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const messages = history.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    await this.prisma.message.create({
      data: { convId: sessionId, role: 'user', content: text },
    });
    messages.push({ role: 'user', content: text });

    const aiRes = await this.callAI(messages, true);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';
    if (aiRes.ok && aiRes.body) {
      // @ts-ignore
      for await (const chunk of aiRes.body) {
        const decoder = new TextDecoder();
        const str = decoder.decode(chunk);
        try {
          const lines = str.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            const data = JSON.parse(payload);
            fullResponse += data.choices?.[0]?.delta?.content || '';
          }
        } catch (e) {}
        res.write(chunk);
      }
    } else {
      const errText = await aiRes.text().catch(() => '{"error":"AI Service Error"}');
      res.write(errText);
    }

    if (fullResponse) {
      await this.prisma.message.create({
        data: { convId: sessionId, role: 'assistant', content: fullResponse },
      });

      const consumed = text.length + fullResponse.length;
      await this.prisma.user.update({
        where: { id: userId },
        data: { consumedToken: { increment: consumed } },
      });

      const currentSession = await this.prisma.conversation.findUnique({ where: { id: sessionId } });
      if (
        currentSession &&
        (!currentSession.topic ||
          currentSession.topic.trim() === '' ||
          currentSession.topic === SessionService.DEFAULT_TOPIC)
      ) {
        this.generateTopic(sessionId, text, fullResponse).catch((e) =>
          console.error('Topic gen error', e),
        );
      }

      await this.prisma.conversation.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    }

    res.end();
  }

  private async generateTopic(sessionId: number, userMsg: string, aiMsg: string) {
    const summaryPrompt =
      `Summarize this conversation into one short Chinese title within 10 characters. ` +
      `Do not include punctuation or quotes. User: ${userMsg}. Assistant: ${aiMsg}`;
    const result = await (
      await this.callAI([{ role: 'user', content: summaryPrompt }], false)
    ).json();
    const topic = result.choices?.[0]?.message?.content?.trim() || SessionService.DEFAULT_TOPIC;
    await this.prisma.conversation.update({
      where: { id: sessionId },
      data: { topic },
    });
  }

  private async callAI(messages: any[], stream = false) {
    const apiKey = process.env.AI_API_KEY || 'sk-sp-4080f1e7e6cb4f578fa5ebfc0de8e31d';
    const apiBase = (process.env.AI_API_BASE || 'https://coding.dashscope.aliyuncs.com/v1').replace(
      /\/$/,
      '',
    );
    const model = process.env.AI_MODEL || 'qwen3.5-plus';
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
