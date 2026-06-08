import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { PrismaService } from '../prisma.service';

type SupportedRole = 'system' | 'developer' | 'user' | 'assistant';

export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface LlmMessage {
  role: SupportedRole;
  content: string | LlmContentPart[];
}

export interface AgentLlmConfig {
  model?: string | null;
  enableWebSearch?: boolean;
  enableWebParse?: boolean;
  enableDeepThink?: boolean;
}

export interface LlmRequestContext {
  orgId?: number | null;
}

interface LlmRuntimeConfig {
  apiBase: string;
  apiKey: string;
  model?: string | null;
  provider?: string | null;
}

interface StreamResult {
  fullResponse: string;
  fullReasoning: string;
}

interface CompletionResult {
  text: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    context?: LlmRequestContext,
  ): Promise<StreamResult> {
    const runtimeConfig = await this.resolveRuntimeConfig(context?.orgId);
    const model = this.resolveModel(agent, modelOverride, runtimeConfig);
    const useResponses = !this.hasMultimodalContent(messages) && this.shouldUseResponses(agent, model, runtimeConfig);
    const upstreamResponse = await (useResponses
      ? this.fetchResponses(messages, model, true, runtimeConfig, agent)
      : this.fetchChatCompletions(messages, model, true, runtimeConfig));

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errorText = await upstreamResponse.text().catch(() => 'LLM request failed');
      this.writeErrorChunk(res, upstreamResponse.status, errorText);
      return { fullResponse: '', fullReasoning: '' };
    }

    return useResponses
      ? this.pipeResponsesStream(upstreamResponse, res)
      : this.pipeChatCompletionsStream(upstreamResponse, res);
  }

  async completeText(
    messages: LlmMessage[],
    agent?: AgentLlmConfig | null,
    modelOverride?: string,
    context?: LlmRequestContext,
  ): Promise<CompletionResult> {
    const runtimeConfig = await this.resolveRuntimeConfig(context?.orgId);
    const model = this.resolveModel(agent, modelOverride, runtimeConfig);
    const useResponses = !this.hasMultimodalContent(messages) && this.shouldUseResponses(agent, model, runtimeConfig);
    const upstreamResponse = await (useResponses
      ? this.fetchResponses(messages, model, false, runtimeConfig, agent)
      : this.fetchChatCompletions(messages, model, false, runtimeConfig));

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => 'LLM request failed');
      throw new Error(`LLM request failed: ${upstreamResponse.status} ${errorText}`);
    }

    const data = await upstreamResponse.json();
    return {
      text: useResponses ? this.extractResponsesText(data) : this.extractChatCompletionsText(data),
    };
  }

  private shouldUseResponses(
    agent: AgentLlmConfig | null | undefined,
    model: string,
    runtimeConfig: LlmRuntimeConfig,
  ): boolean {
    if (!agent) return false;
    if (!this.isAliyunProvider(runtimeConfig)) return false;

    const hasAdvancedCapability = Boolean(
      agent.enableDeepThink || agent.enableWebSearch || agent.enableWebParse,
    );

    if (!hasAdvancedCapability) return false;
    return this.supportsResponsesCapabilities(model);
  }

  private supportsResponsesCapabilities(model: string): boolean {
    return LlmService.RESPONSE_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix));
  }

  private hasMultimodalContent(messages: LlmMessage[]): boolean {
    return messages.some((message) => Array.isArray(message.content));
  }

  private resolveModel(
    agent: AgentLlmConfig | null | undefined,
    modelOverride: string | undefined,
    runtimeConfig: LlmRuntimeConfig,
  ): string {
    return (
      modelOverride ||
      agent?.model ||
      runtimeConfig.model ||
      process.env.AI_MODEL ||
      'deepseek-v4-flash'
    );
  }

  private isAliyunProvider(runtimeConfig: LlmRuntimeConfig): boolean {
    const provider = String(runtimeConfig.provider || process.env.AI_PROVIDER || '').trim().toLowerCase();
    const apiBase = runtimeConfig.apiBase;
    return provider === 'aliyun' || apiBase.includes('dashscope.aliyuncs.com');
  }

  private async resolveRuntimeConfig(orgId?: number | null): Promise<LlmRuntimeConfig> {
    const orgConfig = orgId
      ? await this.prisma.modelConfig.findFirst({
          where: {
            orgId,
            status: 'ACTIVE',
            deletedAt: null,
          },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        })
      : null;

    if (orgId && !orgConfig) {
      throw new InternalServerErrorException('当前用户所在组织未配置模型服务');
    }

    const orgApiBase = orgConfig?.apiBaseUrl?.trim();
    const orgApiKey = orgConfig?.apiKey?.trim();
    if (orgConfig && (!orgApiBase || !orgApiKey)) {
      throw new InternalServerErrorException('当前用户所在组织的模型服务 URL 或 Key 未配置');
    }

    const apiBase = (orgApiBase || process.env.AI_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
    const apiKey = orgApiKey || process.env.AI_API_KEY || '';

    return {
      apiBase,
      apiKey,
      model: orgConfig?.defaultModel || null,
    };
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

  private async fetchChatCompletions(
    messages: LlmMessage[],
    model: string,
    stream: boolean,
    runtimeConfig: LlmRuntimeConfig,
  ) {
    this.configureTransportIfNeeded();

    return fetch(`${runtimeConfig.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
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
    runtimeConfig: LlmRuntimeConfig,
    agent?: AgentLlmConfig | null,
  ) {
    this.configureTransportIfNeeded();

    const tools = this.buildResponsesTools(agent);
    const enableThinking = Boolean(agent?.enableDeepThink || agent?.enableWebParse);

    const body: Record<string, unknown> = {
      model,
      input: messages.map((message) => ({
        role: message.role,
        content: this.stringifyMessageContent(message.content),
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

    return fetch(`${runtimeConfig.apiBase}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
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

  private stringifyMessageContent(content: LlmMessage['content']) {
    if (typeof content === 'string') {
      return content;
    }

    return content
      .map((part) => {
        if (part.type === 'text') {
          return part.text;
        }
        return `[Image] ${part.image_url.url}`;
      })
      .join('\n');
  }

  private async pipeChatCompletionsStream(
    upstreamResponse: Response,
    res: ExpressResponse,
  ): Promise<StreamResult> {
    const reader = upstreamResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let fullReasoning = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = this.consumeSseBuffer(buffer, (payload) => {
        const reasoning = payload?.choices?.[0]?.delta?.reasoning_content || payload?.reasoning_content || '';
        if (reasoning) {
          fullReasoning += reasoning;
          this.writeReasoningChunk(res, reasoning);
        }
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
        const reasoning = payload?.choices?.[0]?.delta?.reasoning_content || payload?.reasoning_content || '';
        if (reasoning) {
          fullReasoning += reasoning;
          this.writeReasoningChunk(res, reasoning);
        }
        const delta = payload?.choices?.[0]?.delta?.content || payload?.content || '';
        if (delta) {
          fullResponse += delta;
          this.writeDeltaChunk(res, delta);
        }
      });
    }

    this.writeDoneChunk(res);
    return { fullResponse, fullReasoning };
  }

  private async pipeResponsesStream(
    upstreamResponse: Response,
    res: ExpressResponse,
  ): Promise<StreamResult> {
    const reader = upstreamResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let fullReasoning = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = this.consumeSseBuffer(buffer, (payload) => {
        const reasoning = this.extractResponsesReasoningDelta(payload);
        if (reasoning) {
          fullReasoning += reasoning;
          this.writeReasoningChunk(res, reasoning);
        }
        if (payload?.type === 'response.output_text.delta' && payload?.delta) {
          fullResponse += payload.delta;
          this.writeDeltaChunk(res, payload.delta);
        }
      });
      buffer = parsed.remaining;
    }

    if (buffer.trim()) {
      this.consumeSseBuffer(buffer, (payload) => {
        const reasoning = this.extractResponsesReasoningDelta(payload);
        if (reasoning) {
          fullReasoning += reasoning;
          this.writeReasoningChunk(res, reasoning);
        }
        if (payload?.type === 'response.output_text.delta' && payload?.delta) {
          fullResponse += payload.delta;
          this.writeDeltaChunk(res, payload.delta);
        }
      });
    }

    this.writeDoneChunk(res);
    return { fullResponse, fullReasoning };
  }

  private extractResponsesReasoningDelta(payload: any): string {
    const type = String(payload?.type || '');
    if (!type.includes('reasoning')) {
      return '';
    }
    return String(payload?.delta || payload?.text || payload?.summary_text || payload?.content || '');
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

  private writeReasoningChunk(res: ExpressResponse, delta: string) {
    res.write(
      `data: ${JSON.stringify({
        type: 'reasoning_delta',
        delta,
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
