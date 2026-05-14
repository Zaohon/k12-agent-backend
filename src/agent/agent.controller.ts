import { BadRequestException, Controller, Get, Post, Body, Req, UseGuards, Param, ParseIntPipe, Query, Delete } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('discover')
  async getDiscoverableAgents(@Req() req: any, @Query('categoryId') categoryId?: string) {
    const agents = await this.agentService.getDiscoverableAgents(
      req.user, 
      categoryId ? parseInt(categoryId) : undefined
    );
    return { success: true, data: agents };
  }

  @Get('featured')
  async getFeatured(@Req() req: any) {
    const agents = await this.agentService.getFeaturedAgents(req.user);
    return { success: true, data: agents };
  }

  @Get('my')
  async getMyAgents(@Req() req: any) {
    const agents = await this.agentService.getMyAgents(req.user.id);
    return {
      success: true,
      data: agents
    };
  }

  @Get(':id')
  async getAgent(@Param('id', ParseIntPipe) id: number) {
    const agent = await this.agentService.getAgentById(id);
    return {
      success: true,
      data: agent
    };
  }

  @Post('update/:id')
  async updateAgent(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const agent = await this.agentService.updateAgent(req.user, id, body);
    return {
      success: true,
      data: agent
    };
  }

  @Post('create')
  async createAgent(@Req() req: any, @Body() body: any) {
    const agent = await this.agentService.createAgent(req.user, body);
    return {
      success: true,
      data: agent
    };
  }

  @Post('optimize')
  async optimizePrompt(@Body() body: { text?: string }) {
    if (!body?.text || typeof body.text !== 'string') {
      throw new BadRequestException('请输入要优化的文本');
    }

    const prompt = `请将以下提示词优化为更清晰、简洁、表达更自然，并保留原意：\n\n${body.text}`;
    const optimizedText = await this.callAI(prompt);

    return {
      success: true,
      data: {
        optimizedText,
      },
    };
  }

  @Delete(':id')
  async deleteAgent(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.agentService.deleteAgent(req.user, id);
    return {
      success: true
    };
  }

  private async callAI(inputText: string): Promise<string> {
    const apiKey = process.env.AI_API_KEY || '';
    const apiBase = (process.env.AI_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
    const model = process.env.AI_MODEL || 'deepseek-v4-flash';

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个提示词优化助手。' },
          { role: 'user', content: inputText },
        ],
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
    if (!response.ok || !content) {
      throw new BadRequestException('大模型优化失败，请稍后重试');
    }

    return content.trim();
  }
}
