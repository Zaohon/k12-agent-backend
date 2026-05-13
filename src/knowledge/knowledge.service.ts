import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OssService } from '../oss/oss.service';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ossService: OssService,
  ) {}

  async listSystemAgentLogos() {
    const objects = await this.ossService.list('system/agent-logo/', 200);
    return objects
      .filter((item) => !item.key.endsWith('/'))
      .map((item) => ({
        key: item.key,
        name: item.key.split('/').pop() || item.key,
        url: item.url,
        size: item.size,
        lastModified: item.lastModified,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  async listFolders(user: any, query: { parentId?: number; keyword?: string }) {
    if (query.parentId) {
      await this.assertFolderOwner(user.id, query.parentId);
    }

    const folders = await this.prisma.knowledgeFolder.findMany({
      where: {
        ownerId: user.id,
        parentId: query.parentId ?? null,
        deletedAt: null,
        ...(query.keyword
          ? {
              name: {
                contains: query.keyword.trim(),
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: {
          select: {
            children: {
              where: { deletedAt: null },
            },
            files: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return folders.map((folder) => ({
      ...folder,
      folderCount: folder._count.children,
      fileCount: folder._count.files,
    }));
  }

  async getFolder(user: any, id: number) {
    const folder = await this.prisma.knowledgeFolder.findFirst({
      where: {
        id,
        ownerId: user.id,
        deletedAt: null,
      },
      include: {
        parent: true,
        _count: {
          select: {
            children: {
              where: { deletedAt: null },
            },
            files: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }

    return {
      ...folder,
      folderCount: folder._count.children,
      fileCount: folder._count.files,
    };
  }

  async createFolder(user: any, body: { name: string; parentId?: number | null }) {
    const name = this.normalizeFolderName(body?.name);
    const parentId = body?.parentId ?? null;

    if (parentId) {
      await this.assertFolderOwner(user.id, parentId);
    }

    return this.prisma.knowledgeFolder.create({
      data: {
        name,
        parentId,
        ownerId: user.id,
        orgId: user.orgId ?? null,
      },
    });
  }

  async updateFolder(user: any, id: number, body: { name: string }) {
    await this.assertFolderOwner(user.id, id);

    return this.prisma.knowledgeFolder.update({
      where: { id },
      data: {
        name: this.normalizeFolderName(body?.name),
      },
    });
  }

  async deleteFolder(user: any, id: number) {
    await this.assertFolderOwner(user.id, id);

    const [childrenCount, fileCount] = await Promise.all([
      this.prisma.knowledgeFolder.count({
        where: {
          parentId: id,
          ownerId: user.id,
          deletedAt: null,
        },
      }),
      this.prisma.knowledgeFile.count({
        where: {
          folderId: id,
          ownerId: user.id,
          deletedAt: null,
        },
      }),
    ]);

    if (childrenCount > 0 || fileCount > 0) {
      throw new BadRequestException('文件夹下仍有子文件夹或文件，暂不支持直接删除');
    }

    await this.prisma.knowledgeFolder.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });
  }

  async listFiles(user: any, query: { folderId?: number; keyword?: string }) {
    if (typeof query.folderId === 'number') {
      await this.assertFolderOwner(user.id, query.folderId);
    }

    return this.prisma.knowledgeFile.findMany({
      where: {
        ownerId: user.id,
        folderId: typeof query.folderId === 'number' ? query.folderId : null,
        deletedAt: null,
        ...(query.keyword
          ? {
              name: {
                contains: query.keyword.trim(),
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listRecentFiles(user: any, limit = 10) {
    return this.prisma.knowledgeFile.findMany({
      where: {
        ownerId: user.id,
        deletedAt: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  async getFile(user: any, id: number) {
    const file = await this.prisma.knowledgeFile.findFirst({
      where: {
        id,
        ownerId: user.id,
        deletedAt: null,
      },
      include: {
        folder: true,
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    return file;
  }

  async createUploadPolicy(
    user: any,
    body: { fileName: string; contentType?: string; folderId?: number | null },
  ) {
    const fileName = this.normalizeFileName(body?.fileName);
    const folderId = body?.folderId ?? null;

    if (folderId) {
      await this.assertFolderOwner(user.id, folderId);
    }

    const objectKey = this.buildObjectKey(user.id, fileName);
    return this.ossService.getSignedUploadUrl(objectKey, body?.contentType, 600);
  }

  async createFileRecord(
    user: any,
    body: {
      folderId?: number | null;
      name: string;
      mimeType?: string;
      size?: number;
      ossKey: string;
      url?: string;
    },
  ) {
    const name = this.normalizeFileName(body?.name);
    const folderId = body?.folderId ?? null;

    if (folderId) {
      await this.assertFolderOwner(user.id, folderId);
    }

    const ossKey = String(body?.ossKey || '').trim();
    if (!ossKey) {
      throw new BadRequestException('ossKey 不能为空');
    }

    try {
      await this.ossService.head(ossKey);
    } catch (error) {
      throw new BadRequestException('OSS 文件不存在或尚未上传完成');
    }

    const ext = this.extractExt(name);
    const size = this.normalizeFileSize(body?.size);

    const file = await this.prisma.knowledgeFile.create({
      data: {
        folderId,
        ownerId: user.id,
        orgId: user.orgId ?? null,
        name,
        ext,
        mimeType: body?.mimeType?.trim() || null,
        size,
        ossKey,
        url: body?.url?.trim() || this.ossService.getPublicUrl(ossKey),
        status: 'UPLOADED',
        parseStatus: 'PENDING',
      },
    });

    await this.prisma.knowledgeFileJob.create({
      data: {
        fileId: file.id,
        jobType: 'PARSE',
        status: 'PENDING',
      },
    });

    return file;
  }

  async deleteFile(user: any, id: number) {
    const file = await this.prisma.knowledgeFile.findFirst({
      where: {
        id,
        ownerId: user.id,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    await this.prisma.knowledgeFile.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    try {
      await this.ossService.delete(file.ossKey);
    } catch (error) {}
  }

  async getStorageStats(user: any) {
    const [folderCount, fileCount, aggregate] = await Promise.all([
      this.prisma.knowledgeFolder.count({
        where: {
          ownerId: user.id,
          deletedAt: null,
        },
      }),
      this.prisma.knowledgeFile.count({
        where: {
          ownerId: user.id,
          deletedAt: null,
        },
      }),
      this.prisma.knowledgeFile.aggregate({
        where: {
          ownerId: user.id,
          deletedAt: null,
        },
        _sum: {
          size: true,
        },
      }),
    ]);

    const usedBytes = aggregate._sum.size ?? 0;
    const totalBytes = 1024 * 1024 * 1024;

    return {
      folderCount,
      fileCount,
      usedBytes,
      totalBytes,
      usageRate: totalBytes > 0 ? Number((usedBytes / totalBytes).toFixed(4)) : 0,
    };
  }

  private async assertFolderOwner(userId: number, folderId: number) {
    const folder = await this.prisma.knowledgeFolder.findFirst({
      where: {
        id: folderId,
        ownerId: userId,
        deletedAt: null,
      },
    });

    if (!folder) {
      throw new ForbiddenException('文件夹不存在或无权访问');
    }

    return folder;
  }

  private normalizeFolderName(raw: unknown) {
    const name = String(raw || '').trim();
    if (!name) {
      throw new BadRequestException('文件夹名称不能为空');
    }
    if (name.length > 120) {
      throw new BadRequestException('文件夹名称长度不能超过 120');
    }
    return name;
  }

  private normalizeFileName(raw: unknown) {
    const name = String(raw || '').trim();
    if (!name) {
      throw new BadRequestException('文件名不能为空');
    }
    if (name.length > 255) {
      throw new BadRequestException('文件名长度不能超过 255');
    }
    return name;
  }

  private normalizeFileSize(raw: unknown) {
    const size = Number(raw ?? 0);
    if (!Number.isFinite(size) || size < 0) {
      throw new BadRequestException('文件大小不合法');
    }
    return Math.floor(size);
  }

  private extractExt(name: string) {
    const ext = extname(name).replace(/^\./, '').trim().toLowerCase();
    return ext || null;
  }

  private buildObjectKey(userId: number, fileName: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safeName = fileName.replace(/[^\w.\-()\u4e00-\u9fa5]+/g, '_');
    return `knowledge/${userId}/${year}/${month}/${randomUUID()}-${safeName}`;
  }
}
