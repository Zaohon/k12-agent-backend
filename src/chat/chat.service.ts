import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * A conceptual Chat streaming gateway that integrates the user request -> API vendor -> DB logging & token deduction.
 * 
 * Note: To complete this stream in a real NestJS app, you typically use raw Node.js Response objects or RxJS observables returning MessageEvent payloads.
 */
@Injectable()
export class ChatGatewayService {
  constructor(private prisma: PrismaService) {}

  /**
   * Handles user streaming request.
   * Decrements user tokens per conversation length in real time.
   */
  async streamFromLLM(user: {id: number}, agentId: number, message: string) {
    // 1. Fetch Agent details & Context
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error("Agent not found.");

    // 2. Look up / Ensure current conversation exists for context
    const conv = await this.prisma.conversation.create({
      data: {
         userId: user.id,
         agentId: agent.id,
         topic: 'New conversation initiated'
      }
    });

    // 3. Log User message physically
    const userMessageCount = message.length; // Raw token mock calculation
    await this.prisma.message.create({
      data: {
        convId: conv.id,
        role: 'user',
        content: message,
        promptTokens: userMessageCount
      }
    });

    // 4. MOCK API CONNECTION (Imagine fetching OpenAI / DeepSeek SSE here)
    // The server reads the stream, pipes to client, and counts tokens outputted byte by byte.
    let generatedWords = "Based on my system prompt, here's some educational feedback. 1. Great spelling. 2. Excellent logic.";
    
    // Simulate consuming 120 tokens. 
    const consumedTokens = 120 + userMessageCount;
    
    // 5. Deduct token budget
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        consumedToken: { increment: consumedTokens }
      }
    });

    // 6. Log Assistant Result
    await this.prisma.message.create({
      data: {
        convId: conv.id,
        role: 'assistant',
        content: generatedWords,
        completionTokens: consumedTokens
      }
    });

    return generatedWords;
  }
}
