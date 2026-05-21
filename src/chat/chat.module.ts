import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { OssModule } from '../oss/oss.module';

@Module({
  imports: [OssModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
