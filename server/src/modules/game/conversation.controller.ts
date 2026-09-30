import { Body, Controller, Post } from '@nestjs/common';
import { ConversationService } from './conversation.service';

class ConverseDto {
  sessionId?: string;
  input!: string;
}

@Controller('game')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('converse')
  async converse(@Body() body: ConverseDto) {
    return this.conversationService.converse(body.sessionId, body.input);
  }
}
