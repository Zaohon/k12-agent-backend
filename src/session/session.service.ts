import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { LlmService, type AgentLlmConfig, type LlmMessage } from '../llm/llm.service';
import { KnowledgeService, type ChatAttachmentInput } from '../knowledge/knowledge.service';

@Injectable()
export class SessionService {
  private static readonly DEFAULT_TOPIC = '\u65b0\u5bf9\u8bdd';
  private static readonly DEFAULT_AGENT_ID = 59;
  private static readonly ATTACHMENT_MESSAGE_PLACEHOLDER = '[附件消息]';
  private static readonly ATTACHMENT_TEXT_LIMIT = 12000;

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private knowledgeService: KnowledgeService,
  ) {}

  async listSessions(userId: number) {
    return this.prisma.conversation.findMany({
      where: { userId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createSession(userId: number, agentId?: number | null) {
    const effectiveAgentId = agentId ?? SessionService.DEFAULT_AGENT_ID;
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
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: true,
          },
        },
      },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('会话不存在或无权访问');
    }

    return session.messages.map((message) => ({
      ...message,
      attachments: message.attachments.map((attachment) => ({
        type: 'link',
        fileId: attachment.knowledgeFileId,
        name: attachment.fileName,
        url: attachment.url,
        mimeType: attachment.mimeType,
        size: attachment.size,
      })),
    }));
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

  async streamSessionChat(
    userId: number,
    sessionId: number,
    prompt: string | undefined,
    attachments: ChatAttachmentInput[] = [],
    res: Response,
  ) {
    const text = (prompt || '').trim();
    if (!text && (!Array.isArray(attachments) || attachments.length === 0)) {
      throw new BadRequestException('prompt 和 attachments 不能同时为空');
    }

    const session = await this.prisma.conversation.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.isDeleted) {
      throw new ForbiddenException('会话不存在或无权访问');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.consumedToken >= user.tokenLimit) {
      throw new ForbiddenException({
        message: '您的 Token 额度已耗尽，或账号状态异常。',
        error: 'Forbidden',
        statusCode: 4031,
      });
    }

    const history = await this.prisma.message.findMany({
      where: { convId: sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        attachments: {
          include: {
            knowledgeFile: {
              select: {
                id: true,
                name: true,
                parsedText: true,
                parseStatus: true,
              },
            },
          },
        },
      },
    });

    const messages: LlmMessage[] = history.reverse().map((message) => this.mapStoredMessageToLlmMessage(message));

    let model: string | undefined;
    let agentForLlm: AgentLlmConfig | null = null;
    if (session.agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: session.agentId } });
      if (!agent) {
        throw new ForbiddenException('会话绑定的智能体不存在');
      }
      model = agent.model || model;
      agentForLlm = {
        model: agent.model,
        enableWebSearch: agent.enableWebSearch,
        enableWebParse: agent.enableWebParse,
        enableDeepThink: agent.enableDeepThink,
      };
      messages.unshift({
        role: 'system',
        content: agent.systemPrompt,
      });
    }

    const attachedFiles = await this.knowledgeService.resolveAttachmentsForChat(user, attachments);
    const storedUserContent = text || SessionService.ATTACHMENT_MESSAGE_PLACEHOLDER;
    const userMessage = await this.prisma.message.create({
      data: { convId: sessionId, role: 'user', content: storedUserContent },
    });

    if (attachedFiles.length > 0) {
      await this.prisma.messageAttachment.createMany({
        data: attachedFiles.map((file) => ({
          messageId: userMessage.id,
          convId: sessionId,
          knowledgeFileId: file.id,
          sourceType: 'KNOWLEDGE_FILE',
          fileName: file.name,
          mimeType: file.mimeType,
          size: file.size,
          ossKey: file.ossKey,
          url: file.url,
        })),
      });
    }

    messages.push({
      role: 'user',
      content: this.buildUserMessageContent(text, attachedFiles),
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { fullResponse, fullReasoning } = await this.llmService.streamToSse(messages, res, agentForLlm, model, {
      orgId: user.orgId,
    });

    if (fullResponse) {
      await this.prisma.message.create({
        data: {
          convId: sessionId,
          role: 'assistant',
          content: fullResponse,
          reasoningContent: fullReasoning || null,
        },
      });

      const consumed = storedUserContent.length + fullResponse.length;
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
        this.generateTopic(sessionId, text || storedUserContent, fullResponse, model, user.orgId).catch((e) =>
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

  private async generateTopic(
    sessionId: number,
    userMsg: string,
    aiMsg: string,
    model?: string,
    orgId?: number | null,
  ) {
    const summaryPrompt =
      `Summarize this conversation into one short Chinese title within 10 characters. ` +
      `Do not include punctuation or quotes. User: ${userMsg}. Assistant: ${aiMsg}`;
    const result = await this.llmService.completeText(
      [{ role: 'user', content: summaryPrompt }],
      null,
      model,
      { orgId },
    );
    const topic = this.normalizeTopic(result.text);
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
    if (agent.id === SessionService.DEFAULT_AGENT_ID) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    if (agent.creatorId === user.id) return true;
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

  private mapStoredMessageToLlmMessage(message: any): LlmMessage {
    return {
      role: message.role as 'user' | 'assistant',
      content: this.buildStoredMessageContent(message),
    };
  }

  private buildStoredMessageContent(message: any) {
    const text =
      message.content === SessionService.ATTACHMENT_MESSAGE_PLACEHOLDER ? '' : String(message.content || '');
    const attachmentFiles =
      Array.isArray(message.attachments) && message.attachments.length > 0
        ? message.attachments
            .map((attachment: any) => attachment.knowledgeFile)
            .filter((file: any) => file?.parsedText?.trim())
        : [];

    if (message.role === 'user') {
      return this.buildUserMessageContent(text, attachmentFiles);
    }

    return text;
  }

  private buildUserMessageContent(
    text: string,
    attachedFiles: Array<{ name?: string | null; parsedText?: string | null }>,
  ) {
    const question = String(text || '').trim();
    const validFiles = attachedFiles.filter((file) => file?.parsedText?.trim());

    if (validFiles.length === 0) {
      return question || SessionService.ATTACHMENT_MESSAGE_PLACEHOLDER;
    }

    const attachmentContext = validFiles
      .map((file, index) => {
        const parsedText = String(file.parsedText || '').trim().slice(0, SessionService.ATTACHMENT_TEXT_LIMIT);
        return `附件${index + 1}：${file.name || `文件${index + 1}`}\n${parsedText}`;
      })
      .join('\n\n');

    const promptHeader = question
      ? `用户问题：${question}`
      : '请结合下面附件内容进行阅读、分析和回答。';

    return `${promptHeader}\n\n以下是附件解析内容：\n${attachmentContext}`;
  }
}
