import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('folders')
  async listFolders(@Req() req: any, @Query('parentId') parentId?: string, @Query('keyword') keyword?: string) {
    const data = await this.knowledgeService.listFolders(req.user, {
      parentId: parentId ? parseInt(parentId, 10) : undefined,
      keyword,
    });
    return { success: true, data };
  }

  @Get('folders/:id')
  async getFolder(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.getFolder(req.user, id);
    return { success: true, data };
  }

  @Post('folders')
  async createFolder(@Req() req: any, @Body() body: { name: string; parentId?: number | null }) {
    const data = await this.knowledgeService.createFolder(req.user, body);
    return { success: true, data };
  }

  @Patch('folders/:id')
  async updateFolder(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { name: string }) {
    const data = await this.knowledgeService.updateFolder(req.user, id, body);
    return { success: true, data };
  }

  @Delete('folders/:id')
  async deleteFolder(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.knowledgeService.deleteFolder(req.user, id);
    return { success: true };
  }

  @Get('files')
  async listFiles(@Req() req: any, @Query('folderId') folderId?: string, @Query('keyword') keyword?: string) {
    const data = await this.knowledgeService.listFiles(req.user, {
      folderId: folderId ? parseInt(folderId, 10) : undefined,
      keyword,
    });
    return { success: true, data };
  }

  @Get('files/recent')
  async listRecentFiles(@Req() req: any, @Query('limit') limit?: string) {
    const data = await this.knowledgeService.listRecentFiles(req.user, limit ? parseInt(limit, 10) : undefined);
    return { success: true, data };
  }

  @Get('files/:id')
  async getFile(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.getFile(req.user, id);
    return { success: true, data };
  }

  @Post('files/upload-policy')
  async createUploadPolicy(
    @Req() req: any,
    @Body() body: { fileName: string; contentType?: string; folderId?: number | null },
  ) {
    const data = await this.knowledgeService.createUploadPolicy(req.user, body);
    return { success: true, data };
  }

  @Post('files')
  async createFileRecord(
    @Req() req: any,
    @Body()
    body: {
      folderId?: number | null;
      name: string;
      mimeType?: string;
      size?: number;
      ossKey: string;
      url?: string;
    },
  ) {
    const data = await this.knowledgeService.createFileRecord(req.user, body);
    return { success: true, data };
  }

  @Delete('files/:id')
  async deleteFile(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.knowledgeService.deleteFile(req.user, id);
    return { success: true };
  }

  @Get('storage/stats')
  async getStorageStats(@Req() req: any) {
    const data = await this.knowledgeService.getStorageStats(req.user);
    return { success: true, data };
  }
}
