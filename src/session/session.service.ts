import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async listSessions(userId: number) {
    return this.prisma.conversation.findMany({
      where: { userId, isDeleted: false, agentId: null },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async createSession(userId: number) {
    return this.prisma.conversation.create({
      data: {
        userId,
        topic: '新对话',
        agentId: null
      }
    });
  }

  async getHistory(userId: number, sessionId: number) {
    const session = await this.prisma.conversation.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('会话不存在或无权访问');
    }
    return session.messages;
  }

  async deleteSession(userId: number, sessionId: number) {
    return this.prisma.conversation.update({
      where: { id: sessionId },
      data: { isDeleted: true }
    });
  }

  async updateTopic(sessionId: number, topic: string) {
    return this.prisma.conversation.update({
      where: { id: sessionId },
      data: { topic }
    });
  }
}
