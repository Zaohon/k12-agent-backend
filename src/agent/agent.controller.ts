import { Controller, Get, Post, Body, Req, UseGuards, Param, ParseIntPipe, Query, Delete } from '@nestjs/common';
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

  @Delete(':id')
  async deleteAgent(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.agentService.deleteAgent(req.user, id);
    return {
      success: true
    };
  }
}
