import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { LlmService } from '../llm/llm.service';

@Module({
  controllers: [GameController, ConversationController],
  providers: [GameService, ConversationService, LlmService],
})
export class GameModule {}
