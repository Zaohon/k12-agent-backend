import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AgentService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  private async ensurePublicOrg() {
    let publicOrg = await this.prisma.organization.findUnique({
      where: { orgName: '公共网点 (默认)' },
    });
    if (!publicOrg) {
      publicOrg = await this.prisma.organization.create({
        data: { orgName: '公共网点 (默认)' },
      });
    }
    return publicOrg;
  }

  private async ensureSystemAdminBoundToPublicOrg() {
    return this.prisma.user.findFirst({
      where: {
        role: 'SUPER_ADMIN',
        deletedAt: null,
        status: 'ACTIVE',
      },
      orderBy: { id: 'asc' },
    });
  }

  private normalizeAgentConfigForCreate(data: any) {
    return {
      title: data?.title,
      description: data?.description ?? null,
      iconUrl: data?.iconUrl ?? null,
      systemPrompt: data?.systemPrompt,
      welcomeMsg: data?.welcomeMsg ?? null,
      formConfig: data?.formConfig ?? null,
      model: data?.model || 'deepseek-v4-flash',
      enableWebSearch: Boolean(data?.enableWebSearch),
      enableWebParse: Boolean(data?.enableWebParse),
      enableDeepThink: Boolean(data?.enableDeepThink),
      enableFileUpload: Boolean(data?.enableFileUpload),
      enableKnowledgeBase: Boolean(data?.enableKnowledgeBase),
      visibility: data?.visibility || 'PRIVATE',
    };
  }

  private normalizeAgentConfigForUpdate(data: any) {
    const patch: any = {};
    const keys = [
      'title',
      'description',
      'iconUrl',
      'systemPrompt',
      'welcomeMsg',
      'formConfig',
      'model',
      'visibility',
      'status',
      'enableWebSearch',
      'enableWebParse',
      'enableDeepThink',
      'enableFileUpload',
      'enableKnowledgeBase',
    ];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        patch[key] = data[key];
      }
    }
    return patch;
  }

  async onModuleInit() {
    const admin = await this.ensureSystemAdminBoundToPublicOrg();
    const count = await this.prisma.agent.count();
    if (count === 0) {
      if (!admin) {
        console.log('Skipped initial agent seed because no active SUPER_ADMIN user exists.');
        return;
      }

      const agents = [
        {
          title: '标准教案生成器',
          description: '一键生成包含三维目标与板书设计的高质量教案，适配国内教研标准。',
          systemPrompt: '你是一位资深高级教师与教研员。请根据用户提供的模板和条件，输出一份专业且详细的教案。教案内容必须结构清晰，包含：1. 教学目标（知识、能力、情感态度） 2. 教学重难点 3. 课时安排 4. 教学过程（包含导入、互动、总结等环节） 5. 板书设计。尽量使用 Markdown 排版。',
          visibility: 'PUBLIC',
          approvalStatus: 'APPROVED',
          creatorId: admin.id,
          iconUrl: 'Document',
          formConfig: JSON.stringify([
            { key: 'subject', label: '教学科目与学段', type: 'input', required: true, placeholder: '如：初二语文' },
            { key: 'topic', label: '课程主题', type: 'input', required: true, placeholder: '如：从百草园到三味书屋' },
            { key: 'focus', label: '教学侧重点', type: 'input', required: false, placeholder: '如：侧重文本细节赏析与情感共鸣' },
            { key: 'extra', label: '其他要求', type: 'textarea', required: false, placeholder: '任意你想补充的细节...' }
          ])
        },
        {
          title: '奥数逻辑大师',
          description: '引导学生通过多步推导解决复杂的竞赛级数学题。',
          systemPrompt: '你是奥林匹克数学竞赛国家级指导老师。不要直接给出最终答案，而是要一步步引导学生发掘解题思路，使用启发式的语言给出数学证明和逻辑线索。如果条件不足，需要敏锐地指出。',
          visibility: 'PUBLIC',
          approvalStatus: 'APPROVED',
          creatorId: admin.id,
          iconUrl: 'DataAnalysis',
          formConfig: JSON.stringify([
            { key: 'grade', label: '学生年级', type: 'input', required: true, placeholder: '如：小学五年级' },
            { key: 'question', label: '题目原题', type: 'textarea', required: true, placeholder: '请粘贴完整的数学题原干...' },
            { key: 'current_thoughts', label: '目前思路 (选填)', type: 'textarea', required: false, placeholder: '学生目前做到哪一步卡壳了？' }
          ])
        },
        {
          title: '班主任沟通助手',
          description: '帮助班主任生成有温度且客观的家校沟通话术。',
          systemPrompt: '你拥有十五年优秀班主任经验。请负责生成向家长反馈学生在校情况的话术。语气要委婉、专业、体现出对孩子的关爱，做到先肯定优点，再客观指出不足，最后提出家校合力的改进建议。如果遇到严重纪律问题，态度要不卑不亢、有理有据。',
          visibility: 'PUBLIC',
          approvalStatus: 'APPROVED',
          creatorId: admin.id,
          iconUrl: 'ChatDotRound',
          formConfig: JSON.stringify([
            { key: 'student_name', label: '学生姓名', type: 'input', required: true, placeholder: '如：张小明' },
            { key: 'event_desc', label: '事件或情况描述', type: 'textarea', required: true, placeholder: '发生了什么事情让你需要和家长沟通？详述过程。' },
            { key: 'target_goal', label: '沟通目的', type: 'input', required: true, placeholder: '如：希望家长配合督促周末作业' },
            { key: 'tone', label: '基调风格 (选填)', type: 'input', required: false, placeholder: '如：非常严肃 / 温和鼓励' }
          ])
        }
      ];

      for (const agent of agents) {
        await this.prisma.agent.create({ data: agent });
      }
      console.log('Seeded initial applications.');
    }

    // Hot-patch existing agents in the database if they lack formConfig
    const existingAgents = await this.prisma.agent.findMany();
    for (const a of existingAgents) {
      if (!a.formConfig) {
         if (a.title === '标准教案生成器') {
            await this.prisma.agent.update({
               where: { id: a.id },
               data: {
                  formConfig: JSON.stringify([
                    { key: 'subject', label: '教学科目与学段', type: 'input', required: true, placeholder: '如：初二语文' },
                    { key: 'topic', label: '课程主题', type: 'input', required: true, placeholder: '如：从百草园到三味书屋' },
                    { key: 'focus', label: '教学侧重点', type: 'input', required: false, placeholder: '如：侧重文本细节赏析与情感共鸣' },
                    { key: 'extra', label: '其他要求', type: 'textarea', required: false, placeholder: '任意你想补充的细节...' }
                  ])
               }
            });
         } else if (a.title === '奥数逻辑大师') {
            await this.prisma.agent.update({
               where: { id: a.id },
               data: {
                  formConfig: JSON.stringify([
                    { key: 'grade', label: '学生年级', type: 'input', required: true, placeholder: '如：小学五年级' },
                    { key: 'question', label: '题目原题', type: 'textarea', required: true, placeholder: '请粘贴完整的数学题原干...' },
                    { key: 'current_thoughts', label: '目前思路 (选填)', type: 'textarea', required: false, placeholder: '学生目前做到哪一步卡壳了？' }
                  ])
               }
            });
         } else if (a.title === '班主任沟通助手') {
            await this.prisma.agent.update({
               where: { id: a.id },
               data: {
                  formConfig: JSON.stringify([
                    { key: 'student_name', label: '学生姓名', type: 'input', required: true, placeholder: '如：张小明' },
                    { key: 'event_desc', label: '事件或情况描述', type: 'textarea', required: true, placeholder: '发生了什么事情让你需要和家长沟通？详述过程。' },
                    { key: 'target_goal', label: '沟通目的', type: 'input', required: true, placeholder: '如：希望家长配合督促周末作业' },
                    { key: 'tone', label: '基调风格 (选填)', type: 'input', required: false, placeholder: '如：非常严肃 / 温和鼓励' }
                  ])
               }
            });
         }
      }
    }
  }

  /**
   * Fetch agents based on the logged-in user's role and organization constraint.
   * This is the core logic specified in PRD for "visibility vs approvals".
   */
  async getDiscoverableAgents(user: { id: number, role: string, orgId?: number }, categoryId?: number) {
    const whereClause: any = {
      OR: [
        // Condition 1: Public applications and MUST be approved
        {
          visibility: 'PUBLIC',
          approvalStatus: 'APPROVED',
        },
        // Condition 2: Organization-visible apps inside the SAME org and MUST be approved
        {
          visibility: 'ORG_VISIBLE',
          approvalStatus: 'APPROVED',
          orgId: user.orgId,
        },
        // Condition 3: Created by the user themselves (Private or pending)
        {
          creatorId: user.id
        }
      ]
    };

    // If Super Admin, bypass some visibility checks but keep categorization
    if (user.role === 'SUPER_ADMIN') {
       delete whereClause.OR;
    }

    // Apply category filter if provided
    if (categoryId) {
       whereClause.categories = {
          some: { categoryId }
       };
    }

    return this.prisma.agent.findMany({
      where: whereClause,
      include: {
        categories: {
          include: { category: true }
        }
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getFeaturedAgents(user: { id: number, role: string, orgId?: number }) {
     return this.prisma.agent.findMany({
        where: {
           isFeatured: true,
           approvalStatus: 'APPROVED',
           OR: [
              { visibility: 'PUBLIC' },
              { visibility: 'ORG_VISIBLE', orgId: user.orgId }
           ]
        },
        take: 5,
        orderBy: { updatedAt: 'desc' }
     });
  }

  /**
   * User creates a new Agent instance.
   * Based on PRD: Default visibility is strictly enforced.
   */
  async createAgent(user: { id: number, orgId?: number, role: string }, data: any) {
    const cleanData = this.normalizeAgentConfigForCreate(data);
    const isPublic = cleanData.visibility !== 'PRIVATE';

    return this.prisma.agent.create({
      data: {
        ...cleanData,
        creatorId: user.id,
        orgId: user.orgId,
        approvalStatus: isPublic ? 'PENDING' : 'APPROVED',
      }
    });
  }

  async updateAgent(user: { id: number, role: string }, id: number, data: any) {
    const current = await this.prisma.agent.findUnique({ where: { id } });
    if (!current) {
      throw new ForbiddenException('智能体不存在');
    }
    if (current.creatorId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('无权限修改该智能体');
    }

    const cleanData = this.normalizeAgentConfigForUpdate(data);
    // Basic backend protection for status downgrade if visibility gets elevated
    if (cleanData.visibility === 'PUBLIC' || cleanData.visibility === 'ORG_VISIBLE') {
      cleanData.approvalStatus = 'PENDING';
    } else if (cleanData.visibility === 'PRIVATE') {
      cleanData.approvalStatus = 'APPROVED';
    }
    return this.prisma.agent.update({
      where: { id },
      data: cleanData
    });
  }

  async getMyAgents(userId: number) {
    return this.prisma.agent.findMany({
      where: { creatorId: userId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getAgentById(id: number) {
    return this.prisma.agent.findUnique({
      where: { id },
    });
  }

  async deleteAgent(user: { id: number, role: string }, id: number) {
    const current = await this.prisma.agent.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('智能体不存在');
    }
    if (current.creatorId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('无权限删除该智能体');
    }

    await this.prisma.agentCategory.deleteMany({ where: { agentId: id } });
    await this.prisma.conversation.updateMany({
      where: { agentId: id },
      data: { agentId: null },
    });
    await this.prisma.agent.delete({ where: { id } });
  }
}
