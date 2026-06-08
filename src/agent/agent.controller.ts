import { BadRequestException, Controller, Get, Post, Body, Req, UseGuards, Param, ParseIntPipe, Query, Delete, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LlmService, type AgentLlmConfig, type LlmMessage } from '../llm/llm.service';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly llmService: LlmService,
  ) {}

  @Get('discover')
  async getDiscoverableAgents(@Req() req: any, @Query('categoryId') categoryId?: string) {
    const agents = await this.agentService.getDiscoverableAgents(
      req.user,
      categoryId ? parseInt(categoryId) : undefined,
    );
    return { success: true, data: agents };
  }

  @Get('featured')
  async getFeatured(@Req() req: any) {
    const agents = await this.agentService.getFeaturedAgents(req.user);
    return { success: true, data: agents };
  }

  @Get('org')
  async getOrgAgents(@Req() req: any, @Query('orgId') orgId?: string) {
    const agents = await this.agentService.getOrgAgents(
      req.user,
      orgId ? parseInt(orgId) : undefined,
    );
    return { success: true, data: agents };
  }

  @Get('my')
  async getMyAgents(@Req() req: any) {
    const agents = await this.agentService.getMyAgents(req.user.id);
    return {
      success: true,
      data: agents,
    };
  }

  @Get(':id')
  async getAgent(@Param('id', ParseIntPipe) id: number) {
    const agent = await this.agentService.getAgentById(id);
    return {
      success: true,
      data: agent,
    };
  }

  @Post('update/:id')
  async updateAgent(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const agent = await this.agentService.updateAgent(req.user, id, body);
    return {
      success: true,
      data: agent,
    };
  }

  @Post('create')
  async createAgent(@Req() req: any, @Body() body: any) {
    const agent = await this.agentService.createAgent(req.user, body);
    return {
      success: true,
      data: agent,
    };
  }

  @Post('optimize')
  async optimizePrompt(@Body() body: { text?: string }) {
    if (!body?.text || typeof body.text !== 'string') {
      throw new BadRequestException('请输入要优化的提示词');
    }

    const rawText = body.text.trim();
    if (!rawText) {
      throw new BadRequestException('请输入要优化的提示词');
    }

    const prompt = `请将下面的提示词做“一键优化”，用于直接给大模型执行。

优化要求：
1. 保留原始意图，不改变任务目标；
2. 表达更清晰、具体、可执行，避免空泛措辞；
3. 补齐必要约束：输出格式、边界条件、风格要求；
4. 删除冗余与重复内容，避免歧义；
5. 输出为中文，仅返回“优化后的提示词”最终版本，不要解释过程；
6. 严格控制长度：不超过220字。

待优化提示词：
${rawText}`;

    const optimizedText = await this.callAI(prompt);

    return {
      success: true,
      data: {
        optimizedText,
      },
    };
  }

  /**
   * Agent debug endpoint — streams LLM response for prompt testing.
   *
   * Request body:
   *   systemPrompt  (required) — the agent's system prompt
   *   userMessage   (required unless messages contains at least one user message) — the user's test message
   *   messages      (optional) — previous debug messages, supports user/assistant roles
   */
  @Post('debug')
  async debugAgent(@Req() req: any, @Res() res: Response, @Body() body: any) {
    const systemPrompt = body?.systemPrompt;
    const userMessage = body?.userMessage;
    const historyMessages = this.normalizeDebugMessages(body?.messages);

    if (!systemPrompt || typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
      throw new BadRequestException('systemPrompt 不能为空');
    }
    if (
      (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) &&
      !historyMessages.some((message) => message.role === 'user')
    ) {
      throw new BadRequestException('userMessage 不能为空');
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt.trim() },
      ...historyMessages,
    ];
    if (typeof userMessage === 'string' && userMessage.trim()) {
      messages.push({ role: 'user', content: userMessage.trim() });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await this.llmService.streamToSse(messages, res, null);
  }

  @Delete(':id')
  async deleteAgent(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.agentService.deleteAgent(req.user, id);
    return {
      success: true,
    };
  }

  private async callAI(inputText: string): Promise<string> {
    const result = await this.llmService.completeText(
      [
        {
          role: 'system',
          content:
            '你是资深提示词工程师。你的任务是把用户提示词改写为更高质量版本，并严格遵守用户给出的长度限制。',
        },
        { role: 'user', content: inputText },
      ],
      null,
    );

    const content = result.text;
    if (!content) {
      throw new BadRequestException('大模型优化失败，请稍后重试');
    }

    return content.trim();
  }

  private normalizeDebugMessages(messages: unknown): LlmMessage[] {
    if (messages === undefined || messages === null) {
      return [];
    }
    if (!Array.isArray(messages)) {
      throw new BadRequestException('messages 必须是数组');
    }

    const normalized: LlmMessage[] = [];

    for (const message of messages) {
        const role = (message as any)?.role;
        const content = (message as any)?.content;
        if (role !== 'user' && role !== 'assistant') {
          continue;
        }
        if (typeof content !== 'string' || !content.trim()) {
          continue;
        }
        normalized.push({
          role,
          content: content.trim(),
        });
    }

    return normalized;
  }
}
