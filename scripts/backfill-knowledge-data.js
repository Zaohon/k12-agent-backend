const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const AUTO_UPLOAD_FOLDER_NAME = '\u81ea\u52a8\u4e0a\u4f20';
const DEFAULT_ROOT_FOLDERS = [
  '\u751f\u6210\u5e93',
  '\u6559\u6848',
  '\u8bfe\u4ef6',
  '\u9898\u5e93',
  '\u5de5\u4f5c\u4e8b\u52a1',
  AUTO_UPLOAD_FOLDER_NAME,
];

const apply = process.argv.includes('--apply');

async function ensureDefaultFoldersForUser(tx, user) {
  const existing = await tx.knowledgeFolder.findMany({
    where: {
      ownerId: user.id,
      parentId: null,
      deletedAt: null,
      name: {
        in: DEFAULT_ROOT_FOLDERS,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const existingMap = new Map(existing.map((folder) => [folder.name, folder]));
  const missingNames = DEFAULT_ROOT_FOLDERS.filter((name) => !existingMap.has(name));

  if (missingNames.length > 0 && apply) {
    for (const name of missingNames) {
      const created = await tx.knowledgeFolder.create({
        data: {
          name,
          parentId: null,
          ownerId: user.id,
          orgId: user.orgId ?? null,
        },
        select: {
          id: true,
          name: true,
        },
      });
      existingMap.set(created.name, created);
    }
  }

  return {
    ownerId: user.id,
    missingNames,
    autoUploadFolderId: existingMap.get(AUTO_UPLOAD_FOLDER_NAME)?.id || null,
  };
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      orgId: true,
      username: true,
      phone: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  const report = {
    apply,
    usersChecked: users.length,
    usersMissingFolders: [],
    filesMovedToAutoUpload: [],
    attachmentMetadataSynced: [],
  };

  for (const user of users) {
    const userResult = await prisma.$transaction(async (tx) => {
      const folders = await ensureDefaultFoldersForUser(tx, user);
      const autoUploadFolderId =
        folders.autoUploadFolderId ||
        (await tx.knowledgeFolder.findFirst({
          where: {
            ownerId: user.id,
            parentId: null,
            deletedAt: null,
            name: AUTO_UPLOAD_FOLDER_NAME,
          },
          select: {
            id: true,
          },
        }))?.id ||
        null;

      let movedFileCount = 0;
      if (autoUploadFolderId) {
        const rootFiles = await tx.knowledgeFile.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            folderId: null,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (rootFiles.length > 0 && apply) {
          await tx.knowledgeFile.updateMany({
            where: {
              id: {
                in: rootFiles.map((file) => file.id),
              },
            },
            data: {
              folderId: autoUploadFolderId,
            },
          });
        }

        movedFileCount = rootFiles.length;

        if (rootFiles.length > 0) {
          report.filesMovedToAutoUpload.push({
            ownerId: user.id,
            autoUploadFolderId,
            count: rootFiles.length,
            sample: rootFiles.slice(0, 5),
          });
        }
      }
      return {
        missingNames: folders.missingNames,
        movedFileCount,
      };
    });

    if (userResult.missingNames.length > 0) {
      report.usersMissingFolders.push({
        ownerId: user.id,
        username: user.username,
        phone: user.phone,
        missingNames: userResult.missingNames,
      });
    }
  }

  const attachmentRows = await prisma.messageAttachment.findMany({
    where: {
      knowledgeFileId: {
        not: null,
      },
    },
    include: {
      knowledgeFile: true,
    },
  });

  const attachmentsToSync = attachmentRows.filter((attachment) => {
    const file = attachment.knowledgeFile;
    if (!file) {
      return false;
    }

    return (
      attachment.fileName !== file.name ||
      attachment.mimeType !== file.mimeType ||
      attachment.size !== file.size ||
      attachment.ossKey !== file.ossKey ||
      attachment.url !== file.url
    );
  });

  if (attachmentsToSync.length > 0 && apply) {
    for (const attachment of attachmentsToSync) {
      const file = attachment.knowledgeFile;
      await prisma.messageAttachment.update({
        where: {
          id: attachment.id,
        },
        data: {
          fileName: file.name,
          mimeType: file.mimeType,
          size: file.size,
          ossKey: file.ossKey,
          url: file.url,
        },
      });
    }
  }

  report.attachmentMetadataSynced = attachmentsToSync.map((attachment) => ({
    attachmentId: attachment.id,
    knowledgeFileId: attachment.knowledgeFileId,
    messageId: attachment.messageId,
  }));

  report.summary = {
    usersNeedingFolderBackfill: report.usersMissingFolders.length,
    usersWithRootFilesMoved: report.filesMovedToAutoUpload.length,
    attachmentsNeedingSync: report.attachmentMetadataSynced.length,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute the backfill.');
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
