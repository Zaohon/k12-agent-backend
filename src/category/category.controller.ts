import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('list')
  async listCategories() {
    const list = await this.categoryService.list();
    return { success: true, data: list };
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createCategory(@Req() req: any, @Body() body: any) {
     if (req.user.role !== 'SUPER_ADMIN') throw new Error('Forbidden');
     const c = await this.categoryService.create(body);
     return { success: true, data: c };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) {
     if (req.user.role !== 'SUPER_ADMIN') throw new Error('Forbidden');
     const c = await this.categoryService.update(parseInt(id), body);
     return { success: true, data: c };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
     if (req.user.role !== 'SUPER_ADMIN') throw new Error('Forbidden');
     await this.categoryService.delete(parseInt(id));
     return { success: true };
  }
}
