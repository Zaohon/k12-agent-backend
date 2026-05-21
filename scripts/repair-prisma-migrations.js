const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const KNOWLEDGE_SCHEMA_SQL = 'prisma/manual/20260521_repair_schema_for_knowledge_pipeline.sql';
const FAILED_MIGRATION = '20260429_add_agent_capabilities';
const KNOWLEDGE_MIGRATION = '20260521_add_knowledge_file_parsed_text';

const apply = process.argv.includes('--apply');

function runCommand(command, args) {
  const executable = process.platform === 'win32' ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

async function hasAgentCapabilityColumns() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME IN (
        'model',
        'enable_web_search',
        'enable_web_parse',
        'enable_deep_think',
        'enable_file_upload',
        'enable_knowledge_base'
      )
  `);

  return Number(rows[0].count) === 6;
}

async function hasKnowledgeParseColumns() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lq_knowledge_file'
      AND COLUMN_NAME IN ('parsed_text', 'parsed_at', 'parse_error')
  `);

  return Number(rows[0].count) === 3;
}

async function getMigrationRow(name) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE migration_name = ?
      LIMIT 1
    `,
    name,
  );

  return rows[0] || null;
}

async function main() {
  const failedMigrationRow = await getMigrationRow(FAILED_MIGRATION);
  const knowledgeMigrationRow = await getMigrationRow(KNOWLEDGE_MIGRATION);
  let agentColumnsReady = await hasAgentCapabilityColumns();
  let knowledgeColumnsReady = await hasKnowledgeParseColumns();

  const plan = [];

  plan.push(`schema sql: ${KNOWLEDGE_SCHEMA_SQL}`);
  if (failedMigrationRow && !failedMigrationRow.finished_at && !failedMigrationRow.rolled_back_at && agentColumnsReady) {
    plan.push(`mark ${FAILED_MIGRATION} as applied`);
  }
  if (!knowledgeMigrationRow && knowledgeColumnsReady) {
    plan.push(`mark ${KNOWLEDGE_MIGRATION} as applied`);
  }

  console.log(JSON.stringify({
    apply,
    agentColumnsReady,
    knowledgeColumnsReady,
    failedMigrationRow,
    knowledgeMigrationRow,
    plan,
  }, null, 2));

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute the repair.');
    return;
  }

  runCommand('npx', ['prisma', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', KNOWLEDGE_SCHEMA_SQL]);
  agentColumnsReady = await hasAgentCapabilityColumns();
  knowledgeColumnsReady = await hasKnowledgeParseColumns();

  if (failedMigrationRow && !failedMigrationRow.finished_at && !failedMigrationRow.rolled_back_at && agentColumnsReady) {
    runCommand('npx', ['prisma', 'migrate', 'resolve', '--applied', FAILED_MIGRATION]);
  }

  if (!knowledgeMigrationRow && knowledgeColumnsReady) {
    runCommand('npx', ['prisma', 'migrate', 'resolve', '--applied', KNOWLEDGE_MIGRATION]);
  }

  console.log('\nPrisma migration repair completed.');
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
