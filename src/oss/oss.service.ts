import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OSS from 'ali-oss';

export interface OssUploadInput {
  key: string;
  content: Buffer | NodeJS.ReadableStream | string;
  contentType?: string;
  metadata?: Record<string, string | number>;
}

export interface OssUploadResult {
  bucket: string;
  key: string;
  url: string;
  etag?: string;
  size?: number;
}

export interface OssSignedUploadResult {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class OssService {
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicDomain: string;
  private readonly client: OSS;

  constructor() {
    const region = process.env.OSS_REGION?.trim();
    const bucket = process.env.OSS_BUCKET?.trim();
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();
    const endpoint = process.env.OSS_ENDPOINT?.trim();
    const publicDomain = process.env.OSS_PUBLIC_DOMAIN?.trim();

    if (!region || !bucket || !accessKeyId || !accessKeySecret) {
      throw new InternalServerErrorException('OSS 配置缺失，请检查环境变量');
    }

    this.bucket = bucket;
    this.region = region;
    this.publicDomain = (publicDomain || '').replace(/\/$/, '');
    this.client = new OSS({
      region,
      bucket,
      accessKeyId,
      accessKeySecret,
      endpoint: endpoint || undefined,
    });
  }

  async put(input: OssUploadInput): Promise<OssUploadResult> {
    const result = await this.client.put(input.key, input.content, {
      headers: input.contentType
        ? {
            'Content-Type': input.contentType,
          }
        : undefined,
      meta: input.metadata as any,
    });

    return {
      bucket: this.bucket,
      key: input.key,
      url: this.getPublicUrl(input.key),
      etag: (result.res?.headers as any)?.etag,
    };
  }

  async delete(key: string) {
    await this.client.delete(key);
    return { success: true, key };
  }

  async head(key: string) {
    return this.client.head(key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 300) {
    return this.client.signatureUrl(key, {
      expires: expiresInSeconds,
    });
  }

  async getSignedUploadUrl(key: string, contentType?: string, expiresInSeconds = 300): Promise<OssSignedUploadResult> {
    const uploadUrl = this.client.signatureUrl(key, {
      method: 'PUT',
      expires: expiresInSeconds,
    });

    return {
      key,
      uploadUrl,
      publicUrl: this.getPublicUrl(key),
      expiresInSeconds,
    };
  }

  getPublicUrl(key: string) {
    const normalizedKey = String(key || '').replace(/^\/+/, '');
    if (!normalizedKey) {
      throw new InternalServerErrorException('OSS 对象 key 不能为空');
    }

    if (this.publicDomain) {
      return `${this.publicDomain}/${normalizedKey}`;
    }

    return `https://${this.bucket}.${this.region}.aliyuncs.com/${normalizedKey}`;
  }
}
