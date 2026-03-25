import { Controller, Get, Post, Body, Req, UseGuards, Param, ParseIntPipe } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('approval')
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  constructor(private readonly appService: ApprovalService) {}

  @Get('pending')
  async listPending(@Req() req: any) {
    const list = await this.appService.listPending(req.user);
    return { success: true, data: list };
  }

  @Post('review/:id')
  async review(
    @Req() req: any, 
    @Param('id', ParseIntPipe) id: number, 
    @Body() body: { status: 'APPROVED' | 'REJECTED', categoryId?: number, isFeatured?: boolean }
  ) {
    const { status, categoryId, isFeatured } = body;
    const result = await this.appService.review(req.user, id, status, { categoryId, isFeatured });
    return { success: true, data: result };
  }
}
