import { Controller, Get, Post, Delete, Param, Req, UseGuards, ParseIntPipe, Body, Res } from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@Controller('session')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('list')
  async list(@Req() req: any) {
    const data = await this.sessionService.listSessions(req.user.id);
    return { success: true, data };
  }

  @Post('create')
  async create(@Req() req: any, @Body() body: { agentId?: number }) {
    const data = await this.sessionService.createSession(req.user.id, body?.agentId);
    return { success: true, data };
  }

  @Get('history/:id')
  async history(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const data = await this.sessionService.getHistory(req.user.id, id);
    return { success: true, data };
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.sessionService.deleteSession(req.user.id, id);
    return { success: true };
  }

  @Post('update-topic/:id')
  async updateTopic(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { topic: string }) {
    await this.sessionService.updateTopic(req.user.id, id, body.topic);
    return { success: true };
  }

  @Post('chat/:id')
  async chat(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { prompt: string },
    @Res() res: Response
  ) {
    await this.sessionService.streamSessionChat(req.user.id, id, body?.prompt, res);
  }
}
