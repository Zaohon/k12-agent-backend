import { Controller, Get, Post, Body, Param, Patch, Delete, Put, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('category')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('list')
  async listCategories(@Req() req: any) {
    const list = await this.categoryService.list(req.user);
    return { success: true, data: list };
  }

  @Get(':id/agents')
  async getCategoryAgents(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const agents = await this.categoryService.getAgentsByCategory(req.user, id);
    return { success: true, data: agents };
  }

  @Post('create')
  async createCategory(@Req() req: any, @Body() body: any) {
     const c = await this.categoryService.create(req.user, body);
     return { success: true, data: c };
  }

  @Patch(':id')
  async updateCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) {
     const c = await this.categoryService.update(req.user, parseInt(id), body);
     return { success: true, data: c };
  }

  @Delete(':id')
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
     await this.categoryService.delete(req.user, parseInt(id));
     return { success: true };
  }

  @Delete(':id/agents/:agentId')
  async removeAgentFromCategory(
    @Req() req: any,
    @Param('id', ParseIntPipe) categoryId: number,
    @Param('agentId', ParseIntPipe) agentId: number,
  ) {
    await this.categoryService.removeAgentFromCategory(req.user, categoryId, agentId);
    return { success: true };
  }

  @Patch(':id/agents/:agentId')
  async updateCategoryAgent(
    @Req() req: any,
    @Param('id', ParseIntPipe) categoryId: number,
    @Param('agentId', ParseIntPipe) agentId: number,
    @Body() body: any,
  ) {
    await this.categoryService.updateCategoryAgentRelation(req.user, categoryId, agentId, body);
    return { success: true };
  }

  @Put(':id/agents')
  async setCategoryAgents(@Req() req: any, @Param('id', ParseIntPipe) categoryId: number, @Body() body: any) {
    await this.categoryService.setCategoryAgents(req.user, categoryId, body.agentIds || []);
    return { success: true };
  }
}
