import { Prisma } from '@prisma/client';

export const DEFAULT_ROOT_KNOWLEDGE_FOLDERS = ['生成库', '教案', '课件', '题库', '工作事务'] as const;

type FolderWriter = Pick<Prisma.TransactionClient, 'knowledgeFolder'>;

export async function ensureDefaultKnowledgeFolders(
  db: FolderWriter,
  input: { ownerId: number; orgId?: number | null },
) {
  const existing = await db.knowledgeFolder.findMany({
    where: {
      ownerId: input.ownerId,
      parentId: null,
      deletedAt: null,
      name: {
        in: [...DEFAULT_ROOT_KNOWLEDGE_FOLDERS],
      },
    },
    select: {
      name: true,
    },
  });

  const existingNames = new Set(existing.map((item) => item.name));
  const missingNames = DEFAULT_ROOT_KNOWLEDGE_FOLDERS.filter((name) => !existingNames.has(name));

  if (missingNames.length === 0) {
    return { createdCount: 0 };
  }

  await db.knowledgeFolder.createMany({
    data: missingNames.map((name) => ({
      name,
      parentId: null,
      ownerId: input.ownerId,
      orgId: input.orgId ?? null,
    })),
  });

  return { createdCount: missingNames.length };
}
