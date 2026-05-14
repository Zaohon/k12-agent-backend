import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
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
}
