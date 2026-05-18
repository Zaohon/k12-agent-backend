import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SessionService {
  private static readonly DEFAULT_TOPIC = '\u65b0\u5bf9\u8bdd';
  private static readonly DEFAULT_AGENT_ID = 10;

  constructor(private prisma: PrismaService) {}

  async listSessions(userId: number) {
    return this.prisma.conversation.findMany({
      where: { userId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createSession(userId: number, agentId?: number) {
    const effectiveAgentId = agentId || SessionService.DEFAULT_AGENT_ID;
    if (effectiveAgentId) {
      const [user, agent] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.agent.findUnique({ where: { id: effectiveAgentId } }),
      ]);
      if (!user || !agent || !this.canAccessAgent(user, agent)) {
        throw new ForbiddenException('智能体不存在或无权访问');
      }
    }

    return this.prisma.conversation.create({
      data: {
        userId,
        topic: SessionService.DEFAULT_TOPIC,
        agentId: effectiveAgentId,
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
      data: { topic: this.normalizeTopic(topic) },
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

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = history
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    let model = process.env.AI_MODEL || 'deepseek-v4-flash';
    if (session.agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: session.agentId } });
      if (!agent) {
        throw new ForbiddenException('会话绑定的智能体不存在');
      }
      model = agent.model || model;
      messages.unshift({
        role: 'system',
        content: agent.systemPrompt,
      });
    }

    await this.prisma.message.create({
      data: { convId: sessionId, role: 'user', content: text },
    });
    messages.push({ role: 'user', content: text });

    const aiRes = await this.callAI(messages, true, model);

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
          currentSession.topic === SessionService.DEFAULT_TOPIC ||
          this.isClearlyBrokenTopic(currentSession.topic))
      ) {
        this.generateTopic(sessionId, text, fullResponse, model).catch((e) =>
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

  private async generateTopic(sessionId: number, userMsg: string, aiMsg: string, model?: string) {
    const summaryPrompt =
      `Summarize this conversation into one short Chinese title within 10 characters. ` +
      `Do not include punctuation or quotes. User: ${userMsg}. Assistant: ${aiMsg}`;
    const result = await (
      await this.callAI([{ role: 'user', content: summaryPrompt }], false, model)
    ).json();
    const topic = this.normalizeTopic(result.choices?.[0]?.message?.content);
    await this.prisma.conversation.update({
      where: { id: sessionId },
      data: { topic },
    });
  }

  private normalizeTopic(raw: unknown) {
    const text = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return SessionService.DEFAULT_TOPIC;
    if (this.isClearlyBrokenTopic(text)) return SessionService.DEFAULT_TOPIC;
    return text.slice(0, 32);
  }

  private isClearlyBrokenTopic(text: string) {
    const t = String(text || '').trim();
    return !!t && /^[\?锛焅uFFFD]+$/.test(t);
  }

  private canAccessAgent(user: any, agent: any) {
    if (user.role === 'SUPER_ADMIN') return true;
    if (agent.creatorId === user.id) return true;
    if (agent.visibility === 'PUBLIC' && agent.approvalStatus === 'APPROVED') return true;
    if (
      agent.visibility === 'ORG_VISIBLE' &&
      agent.approvalStatus === 'APPROVED' &&
      user.orgId &&
      agent.orgId === user.orgId
    ) {
      return true;
    }
    return false;
  }

  private async callAI(messages: any[], stream = false, modelOverride?: string) {
    const apiKey = process.env.AI_API_KEY || '';
    const apiBase = (process.env.AI_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
    const model = modelOverride || process.env.AI_MODEL || 'deepseek-v4-flash';

    // 处理自签名证书问题 - 使用 undici 的 Agent
    let fetchImpl: any = fetch;
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      const { Agent, setGlobalDispatcher } = require('undici');
      const insecureAgent = new Agent({
        connect: { rejectUnauthorized: false },
      });
      setGlobalDispatcher(insecureAgent);
    }

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
