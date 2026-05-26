const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 查询所有组织
  const orgs = await prisma.organization.findMany({ where: { status: 'ACTIVE' } });
  console.log('=== 组织列表 ===');
  orgs.forEach(o => console.log('ID:', o.id, '| 名称:', o.orgName, '| 状态:', o.status));

  // 对每个组织查分类和 agent 数量
  for (const org of orgs) {
    console.log('\n========================================');
    console.log('组织:', org.orgName, '(ID:', org.id, ')');
    console.log('========================================');
    
    const categories = await prisma.category.findMany({
      where: { orgId: org.id, status: 'ACTIVE' },
      orderBy: { weight: 'desc' },
    });
    
    if (categories.length === 0) {
      console.log('  (该组织下没有分类)');
      continue;
    }

    let totalAgents = 0;
    for (const cat of categories) {
      const agentCount = await prisma.agentCategory.count({
        where: {
          categoryId: cat.id,
          status: 'ACTIVE',
          agent: { status: 'ACTIVE' },
        },
      });
      totalAgents += agentCount;
      console.log(`  分类「${cat.name}」(ID:${cat.id}) 权重:${cat.weight} → ${agentCount} 个智能体`);
    }
    console.log(`  -------------------------`);
    console.log(`  合计: ${categories.length} 个分类, ${totalAgents} 个智能体`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
