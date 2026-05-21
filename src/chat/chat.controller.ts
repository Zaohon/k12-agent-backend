import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

interface UploadedAudioFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('voice')
  @UseInterceptors(FileInterceptor('file'))
  async transcribeVoice(
    @Req() req: any,
    @UploadedFile() file: UploadedAudioFile,
    @Body() body: { language?: string },
  ) {
    const data = await this.chatService.transcribeVoice(
      req.user.id,
      file,
      body?.language,
    );
    return { success: true, data };
  }
}
