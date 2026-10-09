import { Body, Controller, Post, Res } from '@nestjs/common';
import { ConversationService, type ConversationStreamEvent } from './conversation.service';

type SseResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
};

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

  @Post('converse/stream')
  async converseStream(@Body() body: ConverseDto, @Res() response: SseResponse) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    try {
      for await (const event of this.conversationService.converseStream(body.sessionId, body.input)) {
        this.writeEvent(response, event);
      }
    } catch {
      this.writeEvent(response, { type: 'error', message: '魔法师走神了，再试一次吧' });
    } finally {
      response.end();
    }
  }

  private writeEvent(response: SseResponse, event: ConversationStreamEvent | { type: 'error'; message: string }) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}
