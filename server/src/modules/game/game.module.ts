import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { LlmService } from '../llm/llm.service';

@Module({
  controllers: [GameController],
  providers: [GameService, LlmService],
})
export class GameModule {}
