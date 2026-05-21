const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const INLINE_PARSE_EXTS = new Set([
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

const KNOWN_UNSUPPORTED_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'mp3',
  'wav',
  'm4a',
  'mp4',
  'mov',
  'avi',
  'zip',
  'rar',
  '7z',
]);

const apply = process.argv.includes('--apply');

function loadEnv(envPath) {
  const env = {};
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function createOssClient() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = loadEnv(envPath);
  return new OSS({
    region: env.OSS_REGION,
    bucket: env.OSS_BUCKET,
    accessKeyId: env.OSS_ACCESS_KEY_ID,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
    endpoint: env.OSS_ENDPOINT || undefined,
  });
}

function normalizeExt(file) {
  return String(file.ext || '').trim().toLowerCase();
}

function normalizeMime(file) {
  return String(file.mimeType || '').trim().toLowerCase();
}

function isInlineParsable(file) {
  const ext = normalizeExt(file);
  const mime = normalizeMime(file);
  const isInlineMimeType =
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime.endsWith('+json') ||
    mime === 'application/xml' ||
    mime === 'text/xml' ||
    mime === 'application/yaml' ||
    mime === 'application/x-yaml' ||
    mime === 'text/yaml' ||
    mime === 'text/x-yaml' ||
    mime === 'text/csv' ||
    mime === 'application/csv';

  return INLINE_PARSE_EXTS.has(ext) || isInlineMimeType;
}

function isKnownUnsupported(file) {
  const ext = normalizeExt(file);
  return KNOWN_UNSUPPORTED_EXTS.has(ext);
}

function extractTextFromFile(buffer, file) {
  if (!isInlineParsable(file)) {
    throw new Error(`Unsupported file type for inline parsing: ${normalizeExt(file) || normalizeMime(file) || file.name}`);
  }

  const text = buffer.toString('utf8').replace(/\u0000/g, '').trim();
  if (!text) {
    throw new Error('Parsed text is empty');
  }

  return text;
}

async function toBuffer(content) {
  if (Buffer.isBuffer(content)) {
    return content;
  }

  if (content && typeof content.pipe === 'function') {
    const chunks = [];
    for await (const chunk of content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return Buffer.from(String(content || ''));
}

async function classifyFile(ossClient, file) {
  try {
    await ossClient.head(file.ossKey);
  } catch (error) {
    return {
      action: 'fail',
      reason: 'OSS object missing or inaccessible',
    };
  }

  if (isInlineParsable(file)) {
    return {
      action: 'reparse',
      reason: 'inline text parser is supported',
    };
  }

  if (isKnownUnsupported(file)) {
    return {
      action: 'fail',
      reason: `unsupported legacy file type: ${normalizeExt(file)}`,
    };
  }

  return {
    action: 'review',
    reason: 'unknown file type; requires manual review',
  };
}

async function upsertJobResult(tx, fileId, status, errorMessage, startedAt, finishedAt) {
  const pendingJobs = await tx.knowledgeFileJob.findMany({
    where: {
      fileId,
      jobType: 'PARSE',
      status: {
        in: ['PENDING', 'PROCESSING'],
      },
    },
    select: {
      id: true,
    },
  });

  if (pendingJobs.length > 0) {
    await tx.knowledgeFileJob.updateMany({
      where: {
        id: {
          in: pendingJobs.map((job) => job.id),
        },
      },
      data: {
        status,
        startedAt,
        finishedAt,
        errorMessage: errorMessage || null,
      },
    });
    return;
  }

  await tx.knowledgeFileJob.create({
    data: {
      fileId,
      jobType: 'PARSE',
      status,
      startedAt,
      finishedAt,
      errorMessage: errorMessage || null,
    },
  });
}

async function markFailed(file, reason) {
  const startedAt = new Date();
  const finishedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeFile.update({
      where: {
        id: file.id,
      },
      data: {
        parseStatus: 'FAILED',
        parseError: reason.slice(0, 1000),
      },
    });

    await upsertJobResult(tx, file.id, 'FAILED', reason.slice(0, 1000), startedAt, finishedAt);
  });
}

async function markSuccess(file, parsedText) {
  const startedAt = new Date();
  const finishedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeFile.update({
      where: {
        id: file.id,
      },
      data: {
        parseStatus: 'SUCCESS',
        parsedText,
        parsedAt: finishedAt,
        parseError: null,
      },
    });

    await upsertJobResult(tx, file.id, 'SUCCESS', null, startedAt, finishedAt);
  });
}

async function main() {
  const ossClient = createOssClient();
  const files = await prisma.knowledgeFile.findMany({
    where: {
      deletedAt: null,
      parseStatus: 'PENDING',
    },
    orderBy: [
      { ownerId: 'asc' },
      { id: 'asc' },
    ],
  });

  const report = {
    apply,
    totalPending: files.length,
    reparse: [],
    fail: [],
    review: [],
  };

  for (const file of files) {
    const classification = await classifyFile(ossClient, file);
    const item = {
      id: file.id,
      ownerId: file.ownerId,
      name: file.name,
      ext: file.ext,
      mimeType: file.mimeType,
      folderId: file.folderId,
      reason: classification.reason,
    };

    if (classification.action === 'reparse') {
      report.reparse.push(item);

      if (apply) {
        try {
          const result = await ossClient.get(file.ossKey);
          const buffer = await toBuffer(result.content);
          const parsedText = extractTextFromFile(buffer, file);
          await markSuccess(file, parsedText);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown reparse error';
          await markFailed(file, reason);
          item.appliedResult = `failed during reparse: ${reason}`;
        }
      }

      continue;
    }

    if (classification.action === 'fail') {
      report.fail.push(item);

      if (apply) {
        await markFailed(file, classification.reason);
      }

      continue;
    }

    report.review.push(item);
  }

  report.summary = {
    reparseCount: report.reparse.length,
    failCount: report.fail.length,
    reviewCount: report.review.length,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute the reprocess plan.');
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
