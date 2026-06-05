import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OssService } from '../oss/oss.service';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AUTO_UPLOAD_FOLDER_NAME } from './knowledge-defaults';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export interface ChatAttachmentInput {
  fileId?: number;
  knowledgeFileId?: number;
}

@Injectable()
export class KnowledgeService {
  private static readonly INLINE_PARSE_EXTS = new Set([
    'txt',
    'md',
    'markdown',
    'csv',
    'tsv',
    'json',
    'js',
    'ts',
    'html',
    'htm',
    'xml',
    'yml',
    'yaml',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ossService: OssService,
  ) {}

  async listSystemAgentLogos() {
    const objects = await this.ossService.list('system/agent-logo/', 200);
    return objects
      .filter((item) => !item.key.endsWith('/'))
      .map((item) => item.key.split('/').pop() || item.key)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }

  async listEntries(user: any, query: { parentId?: number; keyword?: string }) {
    const [folders, files] = await Promise.all([
      this.listFolders(user, query),
      this.listFiles(user, {
        folderId: query.parentId,
        keyword: query.keyword,
      }),
    ]);

    return {
      parentId: query.parentId ?? null,
      folders,
      files,
    };
  }

  async listFolders(user: any, query: { parentId?: number; keyword?: string }) {
    if (typeof query.parentId === 'number') {
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
      throw new NotFoundException('Folder not found');
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
    this.assertCanUseFolderName(name);

    if (parentId) {
      await this.assertFolderOwner(user.id, parentId);
    }

    return this.prisma.knowledgeFolder.create({
      data: {
        name,
        parentId,
        ownerId: user.id,
      },
    });
  }

  async updateFolder(user: any, id: number, body: { name?: string; parentId?: number | null }) {
    const folder = await this.assertFolderOwner(user.id, id);
    const data: Record<string, unknown> = {};
    const hasParentUpdate = Object.prototype.hasOwnProperty.call(body || {}, 'parentId');

    if (typeof body?.name !== 'undefined' || hasParentUpdate) {
      this.assertAutoUploadFolderIsImmutable(folder.name);
    }

    if (typeof body?.name !== 'undefined') {
      const nextName = this.normalizeFolderName(body?.name);
      this.assertCanUseFolderName(nextName);
      data.name = nextName;
    }

    if (hasParentUpdate) {
      const parentId = body?.parentId ?? null;
      await this.assertFolderMoveTarget(user.id, folder.id, parentId);
      data.parentId = parentId;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No folder fields to update');
    }

    return this.prisma.knowledgeFolder.update({
      where: { id },
      data,
    });
  }

  async deleteFolder(user: any, id: number) {
    const folder = await this.assertFolderOwner(user.id, id);
    this.assertAutoUploadFolderIsImmutable(folder.name);

    const folderIds = await this.collectDescendantFolderIds(user.id, id);
    const fileIds = (
      await this.prisma.knowledgeFile.findMany({
        where: {
          ownerId: user.id,
          folderId: { in: folderIds },
        },
        select: { id: true },
      })
    ).map((file) => file.id);

    await this.prisma.$transaction([
      this.prisma.messageAttachment.updateMany({
        where: { knowledgeFileId: { in: fileIds } },
        data: { knowledgeFileId: null },
      }),
      this.prisma.knowledgeFileJob.deleteMany({
        where: { fileId: { in: fileIds } },
      }),
      this.prisma.knowledgeFile.deleteMany({
        where: {
          ownerId: user.id,
          id: { in: fileIds },
        },
      }),
      this.prisma.knowledgeFolder.deleteMany({
        where: {
          ownerId: user.id,
          id: { in: folderIds },
        },
      }),
    ]);
  }

  private async collectDescendantFolderIds(userId: number, rootFolderId: number) {
    const folderIds = [rootFolderId];
    const queue = [rootFolderId];

    while (queue.length > 0) {
      const currentBatch = queue.splice(0, queue.length);
      const children = await this.prisma.knowledgeFolder.findMany({
        where: {
          ownerId: userId,
          parentId: { in: currentBatch },
          deletedAt: null,
        },
        select: { id: true },
      });

      for (const child of children) {
        folderIds.push(child.id);
        queue.push(child.id);
      }
    }

    return folderIds;
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
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async updateFile(user: any, id: number, body: { name?: string; folderId?: number | null }) {
    await this.assertFileOwner(user.id, id);

    const data: Record<string, unknown> = {};

    if (typeof body?.name !== 'undefined') {
      data.name = this.normalizeFileName(body?.name);
      data.ext = this.extractExt(String(data.name));
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'folderId')) {
      const folderId = body?.folderId ?? null;
      if (folderId) {
        await this.assertFolderOwner(user.id, folderId);
      }
      data.folderId = folderId;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No file fields to update');
    }

    return this.prisma.knowledgeFile.update({
      where: { id },
      data,
    });
  }

  async createUploadPolicy(
    user: any,
    body: { fileName: string; contentType?: string; folderId?: number | null },
  ) {
    const fileName = this.normalizeFileName(body?.fileName);
    const hasFolderId = Object.prototype.hasOwnProperty.call(body || {}, 'folderId');
    await this.resolveIncomingFolderId(user, body?.folderId, {
      useAutoUploadWhenMissing: !hasFolderId,
    });

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
    const hasFolderId = Object.prototype.hasOwnProperty.call(body || {}, 'folderId');
    const folderId = await this.resolveIncomingFolderId(user, body?.folderId, {
      useAutoUploadWhenMissing: !hasFolderId,
    });

    const ossKey = String(body?.ossKey || '').trim();
    if (!ossKey) {
      throw new BadRequestException('ossKey is required');
    }

    try {
      await this.ossService.head(ossKey);
    } catch (error) {
      throw new BadRequestException('OSS file does not exist or upload is incomplete');
    }

    const ext = this.extractExt(name);
    const size = this.normalizeFileSize(body?.size);

    const file = await this.prisma.knowledgeFile.create({
      data: {
        folderId,
        ownerId: user.id,
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

    void this.parseKnowledgeFile(file.id, { expectedOwnerId: user.id }).catch(() => undefined);

    return file;
  }

  async resolveAttachmentsForChat(user: any, attachments: ChatAttachmentInput[] = []) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return [];
    }

    const fileIds = attachments.map((attachment, index) => {
      const raw = attachment?.fileId ?? attachment?.knowledgeFileId;
      const fileId = Number(raw);
      if (!Number.isInteger(fileId) || fileId <= 0) {
        throw new BadRequestException(`attachments[${index}].fileId is required`);
      }
      return fileId;
    });

    const files = await this.assertFilesOwner(user.id, fileIds);
    const fileMap = new Map(files.map((file) => [file.id, file]));
    const resolvedFiles: typeof files = [];

    for (const fileId of fileIds) {
      let file = fileMap.get(fileId)!;
      if (file.parseStatus !== 'SUCCESS' || !file.parsedText?.trim()) {
        file = await this.parseKnowledgeFile(file.id, { expectedOwnerId: user.id });
      }
      resolvedFiles.push(file);
    }

    return resolvedFiles;
  }

  async parseKnowledgeFile(fileId: number, options?: { expectedOwnerId?: number; force?: boolean }) {
    const file = await this.prisma.knowledgeFile.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
        ...(options?.expectedOwnerId
          ? {
              ownerId: options.expectedOwnerId,
            }
          : {}),
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!options?.force && file.parseStatus === 'SUCCESS' && file.parsedText?.trim()) {
      return file;
    }

    const startedAt = new Date();
    await this.prisma.knowledgeFile.update({
      where: { id: file.id },
      data: {
        parseStatus: 'PROCESSING',
        parseError: null,
      },
    });

    await this.prisma.knowledgeFileJob.updateMany({
      where: {
        fileId: file.id,
        jobType: 'PARSE',
        status: 'PENDING',
      },
      data: {
        status: 'PROCESSING',
        startedAt,
        errorMessage: null,
      },
    });

    try {
      const buffer = await this.ossService.getBuffer(file.ossKey);
      const parsedText = await this.extractTextFromFile(buffer, file.name, file.ext, file.mimeType);

      if (!parsedText.trim()) {
        throw new Error('Parsed text is empty');
      }

      const finishedAt = new Date();
      const updatedFile = await this.prisma.knowledgeFile.update({
        where: { id: file.id },
        data: {
          parseStatus: 'SUCCESS',
          parsedText,
          parsedAt: finishedAt,
          parseError: null,
        },
      });

      await this.prisma.knowledgeFileJob.updateMany({
        where: {
          fileId: file.id,
          jobType: 'PARSE',
          status: 'PROCESSING',
        },
        data: {
          status: 'SUCCESS',
          finishedAt,
          errorMessage: null,
        },
      });

      return updatedFile;
    } catch (error) {
      const finishedAt = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';

      await this.prisma.knowledgeFile.update({
        where: { id: file.id },
        data: {
          parseStatus: 'FAILED',
          parseError: errorMessage.slice(0, 1000),
        },
      });

      await this.prisma.knowledgeFileJob.updateMany({
        where: {
          fileId: file.id,
          jobType: 'PARSE',
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
        },
        data: {
          status: 'FAILED',
          finishedAt,
          errorMessage: errorMessage.slice(0, 1000),
        },
      });

      throw new BadRequestException(`File parse failed: ${errorMessage}`);
    }
  }

  async deleteFile(user: any, id: number) {
    const file = await this.assertFileOwner(user.id, id);
    await this.softDeleteFiles([file]);

    try {
      await this.ossService.delete(file.ossKey);
    } catch (error) {}
  }

  async batchMoveFiles(user: any, body: { fileIds: number[]; targetFolderId?: number | null }) {
    const fileIds = this.normalizeIdList(body?.fileIds, 'fileIds');
    const targetFolderId = body?.targetFolderId ?? null;

    if (targetFolderId) {
      await this.assertFolderOwner(user.id, targetFolderId);
    }

    const files = await this.assertFilesOwner(user.id, fileIds);

    await this.prisma.knowledgeFile.updateMany({
      where: {
        id: {
          in: files.map((item) => item.id),
        },
      },
      data: {
        folderId: targetFolderId,
      },
    });

    return {
      movedCount: files.length,
      targetFolderId,
    };
  }

  async batchDeleteFiles(user: any, body: { fileIds: number[] }) {
    const fileIds = this.normalizeIdList(body?.fileIds, 'fileIds');
    const files = await this.assertFilesOwner(user.id, fileIds);

    await this.softDeleteFiles(files);
    await Promise.allSettled(files.map((file) => this.ossService.delete(file.ossKey)));

    return {
      deletedCount: files.length,
    };
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
      throw new ForbiddenException('Folder not found or access denied');
    }

    return folder;
  }

  private async resolveIncomingFolderId(
    user: any,
    folderIdInput: number | null | undefined,
    options?: { useAutoUploadWhenMissing?: boolean },
  ) {
    const hasFolderId =
      typeof folderIdInput !== 'undefined' && folderIdInput !== null && String(folderIdInput).trim() !== '';

    if (hasFolderId) {
      const folderId = Number(folderIdInput);
      if (!Number.isInteger(folderId) || folderId <= 0) {
        throw new BadRequestException('folderId is invalid');
      }

      await this.assertFolderOwner(user.id, folderId);
      return folderId;
    }

    if (options?.useAutoUploadWhenMissing) {
      return this.ensureAutoUploadFolderId(user);
    }

    return null;
  }

  private async ensureAutoUploadFolderId(user: any) {
    const existing = await this.prisma.knowledgeFolder.findFirst({
      where: {
        ownerId: user.id,
        parentId: null,
        name: AUTO_UPLOAD_FOLDER_NAME,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.knowledgeFolder.create({
      data: {
        name: AUTO_UPLOAD_FOLDER_NAME,
        parentId: null,
        ownerId: user.id,
      },
      select: {
        id: true,
      },
    });

    return created.id;
  }

  private async assertFolderMoveTarget(userId: number, folderId: number, parentId: number | null) {
    if (parentId === null) {
      return null;
    }

    if (parentId === folderId) {
      throw new BadRequestException('Folder cannot be moved into itself');
    }

    let current = await this.assertFolderOwner(userId, parentId);
    while (current) {
      if (current.id === folderId) {
        throw new BadRequestException('Folder cannot be moved into its descendant');
      }

      if (!current.parentId) {
        break;
      }

      current = await this.assertFolderOwner(userId, current.parentId);
    }

    return parentId;
  }

  private async assertFileOwner(userId: number, fileId: number) {
    const file = await this.prisma.knowledgeFile.findFirst({
      where: {
        id: fileId,
        ownerId: userId,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  private async assertFilesOwner(userId: number, fileIds: number[]) {
    const files = await this.prisma.knowledgeFile.findMany({
      where: {
        id: {
          in: fileIds,
        },
        ownerId: userId,
        deletedAt: null,
      },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException('Some files do not exist or are not accessible');
    }

    const fileMap = new Map(files.map((file) => [file.id, file]));
    return fileIds.map((id) => fileMap.get(id)!);
  }

  private async softDeleteFiles(files: Array<{ id: number }>) {
    const deletedAt = new Date();
    await this.prisma.knowledgeFile.updateMany({
      where: {
        id: {
          in: files.map((item) => item.id),
        },
      },
      data: {
        status: 'DELETED',
        deletedAt,
      },
    });
  }

  private normalizeFolderName(raw: unknown) {
    const name = String(raw || '').trim();
    if (!name) {
      throw new BadRequestException('Folder name is required');
    }
    if (name.length > 120) {
      throw new BadRequestException('Folder name must be at most 120 characters');
    }
    return name;
  }

  private assertCanUseFolderName(name: string) {
    if (name === AUTO_UPLOAD_FOLDER_NAME) {
      throw new BadRequestException(`Folder name "${AUTO_UPLOAD_FOLDER_NAME}" is reserved`);
    }
  }

  private assertAutoUploadFolderIsImmutable(name: string) {
    if (name === AUTO_UPLOAD_FOLDER_NAME) {
      throw new BadRequestException(`Folder "${AUTO_UPLOAD_FOLDER_NAME}" cannot be renamed or deleted`);
    }
  }

  private normalizeFileName(raw: unknown) {
    const name = String(raw || '').trim();
    if (!name) {
      throw new BadRequestException('File name is required');
    }
    if (name.length > 255) {
      throw new BadRequestException('File name must be at most 255 characters');
    }
    return name;
  }

  private normalizeFileSize(raw: unknown) {
    const size = Number(raw ?? 0);
    if (!Number.isFinite(size) || size < 0) {
      throw new BadRequestException('Invalid file size');
    }
    return Math.floor(size);
  }

  private normalizeIdList(raw: unknown, fieldName: string) {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequestException(`${fieldName} must be a non-empty array`);
    }

    const ids = Array.from(
      new Set(raw.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)),
    );

    if (ids.length === 0) {
      throw new BadRequestException(`${fieldName} must contain valid positive integers`);
    }

    return ids;
  }

  private extractExt(name: string) {
    const ext = extname(name).replace(/^\./, '').trim().toLowerCase();
    return ext || null;
  }

  private async extractTextFromFile(
    buffer: Buffer,
    fileName: string,
    ext?: string | null,
    mimeType?: string | null,
  ) {
    const normalizedExt = String(ext || this.extractExt(fileName) || '').toLowerCase();
    const normalizedMime = String(mimeType || '').toLowerCase();
    const isPdf = normalizedExt === 'pdf' || normalizedMime === 'application/pdf';
    const isDocx =
      normalizedExt === 'docx' ||
      normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isInlineMimeType =
      normalizedMime.startsWith('text/') ||
      normalizedMime === 'application/json' ||
      normalizedMime.endsWith('+json') ||
      normalizedMime === 'application/xml' ||
      normalizedMime === 'text/xml' ||
      normalizedMime === 'application/yaml' ||
      normalizedMime === 'application/x-yaml' ||
      normalizedMime === 'text/yaml' ||
      normalizedMime === 'text/x-yaml' ||
      normalizedMime === 'text/csv' ||
      normalizedMime === 'application/csv';

    if (KnowledgeService.INLINE_PARSE_EXTS.has(normalizedExt) || isInlineMimeType) {
      return buffer.toString('utf8').replace(/\u0000/g, '').trim();
    }

    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return String(result.text || '').replace(/\u0000/g, '').trim();
      } finally {
        await parser.destroy();
      }
    }

    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      return String(result.value || '').replace(/\u0000/g, '').trim();
    }

    throw new Error(`Unsupported file type for inline parsing: ${normalizedExt || normalizedMime || fileName}`);
  }

  private buildObjectKey(userId: number, fileName: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safeName = fileName.replace(/[^\w.\-()\u4e00-\u9fa5]+/g, '_');
    return `knowledge/${userId}/${year}/${month}/${randomUUID()}-${safeName}`;
  }
}
