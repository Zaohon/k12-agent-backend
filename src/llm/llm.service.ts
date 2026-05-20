import { Injectable, Logger } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';

type SupportedRole = 'system' | 'developer' | 'user' | 'assistant';

export interface LlmMessage {
  role: SupportedRole;
  content: string;
}

export interface AgentLlmConfig {
  model?: string | null;
  enableWebSearch?: boolean;
  enableWebParse?: boolean;
  enableDeepThink?: boolean;
}

interface StreamResult {
  fullResponse: string;
}

interface CompletionResult {
  text: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  private static readonly RESPONSE_MODEL_PREFIXES = [
    'qwen3-max',
    'qwen3.6-plus',
    'qwen3.5-plus',
    'qwen3.6-flash',
    'qwen3.5-flash',
  ];

  async streamToSse(
    messages: LlmMessage[],
    res: ExpressResponse,
    agent?: AgentLlmConfig | null,
    modelOverride?: string,
  ): Promise<StreamResult> {
    const model = this.resolveModel(agent, modelOverride);
    const useResponses = this.shouldUseResponses(agent, model);
    const upstreamResponse = await (useResponses
      ? this.fetchResponses(messages, model, true, agent)
      : this.fetchChatCompletions(messages, model, true));

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errorText = await upstreamResponse.text().catch(() => 'LLM request failed');
      this.writeErrorChunk(res, upstreamResponse.status, errorText);
      return { fullResponse: '' };
    }

    return useResponses
      ? this.pipeResponsesStream(upstreamResponse, res)
      : this.pipeChatCompletionsStream(upstreamResponse, res);
  }

  async completeText(
    messages: LlmMessage[],
    agent?: AgentLlmConfig | null,
    modelOverride?: string,
  ): Promise<CompletionResult> {
    const model = this.resolveModel(agent, modelOverride);
    const useResponses = this.shouldUseResponses(agent, model);
    const upstreamResponse = await (useResponses
      ? this.fetchResponses(messages, model, false, agent)
      : this.fetchChatCompletions(messages, model, false));

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => 'LLM request failed');
      throw new Error(`LLM request failed: ${upstreamResponse.status} ${errorText}`);
    }

    const data = await upstreamResponse.json();
    return {
      text: useResponses ? this.extractResponsesText(data) : this.extractChatCompletionsText(data),
    };
  }

  private shouldUseResponses(agent: AgentLlmConfig | null | undefined, model: string): boolean {
    if (!agent) return false;
    if (!this.isAliyunProvider()) return false;

    const hasAdvancedCapability = Boolean(
      agent.enableDeepThink || agent.enableWebSearch || agent.enableWebParse,
    );

    if (!hasAdvancedCapability) return false;
    return this.supportsResponsesCapabilities(model);
  }

  private supportsResponsesCapabilities(model: string): boolean {
    return LlmService.RESPONSE_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix));
  }

  private resolveModel(agent?: AgentLlmConfig | null, modelOverride?: string): string {
    return (
      modelOverride ||
      agent?.model ||
      process.env.AI_MODEL ||
      'deepseek-v4-flash'
    );
  }

  private isAliyunProvider(): boolean {
    const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
    const apiBase = this.getApiBase();
    return provider === 'aliyun' || apiBase.includes('dashscope.aliyuncs.com');
  }

  private getApiBase() {
    return (process.env.AI_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
  }

  private configureTransportIfNeeded() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
      return;
    }

    const { Agent, setGlobalDispatcher } = require('undici');
    const insecureAgent = new Agent({
      connect: { rejectUnauthorized: false },
    });
    setGlobalDispatcher(insecureAgent);
  }

  private async fetchChatCompletions(messages: LlmMessage[], model: string, stream: boolean) {
    this.configureTransportIfNeeded();

    return fetch(`${this.getApiBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
    });
  }

  private async fetchResponses(
    messages: LlmMessage[],
    model: string,
    stream: boolean,
    agent?: AgentLlmConfig | null,
  ) {
    this.configureTransportIfNeeded();

    const tools = this.buildResponsesTools(agent);
    const enableThinking = Boolean(agent?.enableDeepThink || agent?.enableWebParse);

    const body: Record<string, unknown> = {
      model,
      input: messages.map((message) => ({
        role: message.role,
        content: String(message.content || ''),
      })),
      stream,
      store: false,
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

    if (enableThinking) {
      body.enable_thinking = true;
    }

    return fetch(`${this.getApiBase()}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  private buildResponsesTools(agent?: AgentLlmConfig | null) {
    const toolTypes = new Set<string>();

    if (agent?.enableWebSearch || agent?.enableWebParse) {
      toolTypes.add('web_search');
    }

    if (agent?.enableWebParse) {
      toolTypes.add('web_extractor');
    }

    return Array.from(toolTypes).map((type) => ({ type }));
  }

  private async pipeChatCompletionsStream(
    upstreamResponse: Response,
    res: ExpressResponse,
  ): Promise<StreamResult> {
    const reader = upstreamResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = this.consumeSseBuffer(buffer, (payload) => {
        const delta = payload?.choices?.[0]?.delta?.content || payload?.content || '';
        if (delta) {
          fullResponse += delta;
          this.writeDeltaChunk(res, delta);
        }
      });
      buffer = parsed.remaining;
    }

    if (buffer.trim()) {
      this.consumeSseBuffer(buffer, (payload) => {
        const delta = payload?.choices?.[0]?.delta?.content || payload?.content || '';
        if (delta) {
          fullResponse += delta;
          this.writeDeltaChunk(res, delta);
        }
      });
    }

    this.writeDoneChunk(res);
    return { fullResponse };
  }

  private async pipeResponsesStream(
    upstreamResponse: Response,
    res: ExpressResponse,
  ): Promise<StreamResult> {
    const reader = upstreamResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = this.consumeSseBuffer(buffer, (payload) => {
        if (payload?.type === 'response.output_text.delta' && payload?.delta) {
          fullResponse += payload.delta;
          this.writeDeltaChunk(res, payload.delta);
        }
      });
      buffer = parsed.remaining;
    }

    if (buffer.trim()) {
      this.consumeSseBuffer(buffer, (payload) => {
        if (payload?.type === 'response.output_text.delta' && payload?.delta) {
          fullResponse += payload.delta;
          this.writeDeltaChunk(res, payload.delta);
        }
      });
    }

    this.writeDoneChunk(res);
    return { fullResponse };
  }

  private consumeSseBuffer(buffer: string, onPayload: (payload: any) => void) {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const remaining = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) {
        continue;
      }

      const payloadStr = line.slice(5).trim();
      if (!payloadStr || payloadStr === '[DONE]') {
        continue;
      }

      try {
        onPayload(JSON.parse(payloadStr));
      } catch (error) {
        this.logger.warn(`Failed to parse SSE payload: ${payloadStr}`);
      }
    }

    return { remaining };
  }

  private extractChatCompletionsText(data: any): string {
    return String(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '').trim();
  }

  private extractResponsesText(data: any): string {
    const outputItems = Array.isArray(data?.output) ? data.output : [];
    const texts: string[] = [];

    for (const item of outputItems) {
      if (item?.type !== 'message' || item?.role !== 'assistant') {
        continue;
      }

      const contentParts = Array.isArray(item.content) ? item.content : [];
      for (const part of contentParts) {
        if (part?.type === 'output_text' && part?.text) {
          texts.push(String(part.text));
        }
      }
    }

    return texts.join('').trim();
  }

  private writeDeltaChunk(res: ExpressResponse, delta: string) {
    res.write(
      `data: ${JSON.stringify({
        choices: [{ delta: { content: delta } }],
      })}\n\n`,
    );
  }

  private writeDoneChunk(res: ExpressResponse) {
    res.write('data: [DONE]\n\n');
  }

  private writeErrorChunk(res: ExpressResponse, status: number, message: string) {
    res.write(
      `data: ${JSON.stringify({
        error: {
          code: 'upstream_error',
          message: `LLM upstream error (${status}): ${message}`,
        },
      })}\n\n`,
    );
    this.writeDoneChunk(res);
  }
}
