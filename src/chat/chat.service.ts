import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { OssService } from '../oss/oss.service';

interface UploadedAudioFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type DashScopeTaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'UNKNOWN';

interface DashScopeSubmitResponse {
  output?: {
    task_id?: string;
    taskId?: string;
  };
  message?: string;
}

interface DashScopeTaskResponse {
  output?: {
    task_status?: DashScopeTaskStatus;
    taskStatus?: DashScopeTaskStatus;
    message?: string;
    result?: {
      transcription_url?: string;
      transcriptionUrl?: string;
    };
  };
  message?: string;
}

@Injectable()
export class ChatService {
  private readonly dashscopeBaseUrl: string;

  constructor(private readonly ossService: OssService) {
    this.dashscopeBaseUrl = (
      process.env.DASHSCOPE_BASE_URL?.trim() ||
      'https://dashscope.aliyuncs.com/api/v1'
    ).replace(/\/$/, '');
  }

  async transcribeVoice(
    userId: number,
    file: UploadedAudioFile,
    language?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请上传音频文件');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('音频文件内容为空');
    }

    const ossKey = this.buildVoiceOssKey(userId, file.originalname);
    const uploadResult = await this.ossService.put({
      key: ossKey,
      content: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        uploader: String(userId),
        source: 'chat-voice',
        originalName: file.originalname || 'voice',
      },
    });

    const signedFileUrl = await this.ossService.getSignedUrl(ossKey, 3600);
    const taskId = await this.submitTranscriptionTask(
      signedFileUrl,
      language,
    );
    const transcriptionUrl = await this.waitForTranscriptionResult(taskId);
    const resultJson = await this.fetchJson<any>(transcriptionUrl, false);
    const text = this.extractTranscriptText(resultJson);

    return {
      text,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ossKey,
      fileUrl: uploadResult.url,
      taskId,
    };
  }

  private buildVoiceOssKey(userId: number, originalName?: string) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const extension = extname(originalName || '').toLowerCase() || '.webm';
    return `chat-voice/${userId}/${yyyy}/${mm}/${dd}/${randomUUID()}${extension}`;
  }

  private async submitTranscriptionTask(fileUrl: string, language?: string) {
    const response = await this.fetchJson<DashScopeSubmitResponse>(
      `${this.dashscopeBaseUrl}/services/audio/asr/transcription`,
      true,
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'qwen3-asr-flash-filetrans',
          input: {
            file_url: fileUrl,
          },
          parameters: {
            channel_id: [0],
            enable_itn: true,
            enable_words: false,
            ...(language ? { language } : {}),
          },
        }),
      },
    );

    const taskId = response.output?.task_id || response.output?.taskId;
    if (!taskId) {
      throw new InternalServerErrorException(
        response.message || '语音转写任务提交失败',
      );
    }

    return taskId;
  }

  private async waitForTranscriptionResult(taskId: string) {
    const deadline = Date.now() + 120000;

    while (Date.now() < deadline) {
      const response = await this.fetchJson<DashScopeTaskResponse>(
        `${this.dashscopeBaseUrl}/tasks/${taskId}`,
        true,
        {
          method: 'GET',
        },
      );

      const status =
        response.output?.task_status || response.output?.taskStatus || 'UNKNOWN';

      if (status === 'SUCCEEDED') {
        const transcriptionUrl =
          response.output?.result?.transcription_url ||
          response.output?.result?.transcriptionUrl;
        if (!transcriptionUrl) {
          throw new InternalServerErrorException(
            '转写任务已完成，但未返回 transcription_url',
          );
        }
        return transcriptionUrl;
      }

      if (status === 'FAILED' || status === 'UNKNOWN') {
        throw new InternalServerErrorException(
          response.output?.message || response.message || '语音转写失败',
        );
      }

      await this.sleep(2000);
    }

    throw new InternalServerErrorException('语音转写超时，请稍后重试');
  }

  private extractTranscriptText(resultJson: any) {
    const transcripts = Array.isArray(resultJson?.transcripts)
      ? resultJson.transcripts
      : [];

    const chunks = transcripts
      .map((item: any) => {
        if (typeof item?.text === 'string' && item.text.trim()) {
          return item.text.trim();
        }

        const sentenceTexts = Array.isArray(item?.sentences)
          ? item.sentences
              .map((sentence: any) =>
                typeof sentence?.text === 'string' ? sentence.text.trim() : '',
              )
              .filter(Boolean)
          : [];

        return sentenceTexts.join('');
      })
      .filter(Boolean);

    const text = chunks.join('\n').trim();
    if (!text) {
      throw new InternalServerErrorException('语音转写成功，但未提取到文本');
    }

    return text;
  }

  private async fetchJson<T>(
    url: string,
    withDashscopeHeaders: boolean,
    init?: RequestInit,
  ): Promise<T> {
    const dashscopeApiKey = process.env.AI_API_KEY?.trim();
    if (withDashscopeHeaders && !dashscopeApiKey) {
      throw new InternalServerErrorException('AI_API_KEY 未配置');
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        ...(withDashscopeHeaders
          ? {
              Authorization: `Bearer ${dashscopeApiKey}`,
              'X-DashScope-Async': 'enable',
            }
          : {}),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(
        `请求语音识别服务失败: ${response.status} ${errorText}`,
      );
    }

    return (await response.json()) as T;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
