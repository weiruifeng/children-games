import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { GamePlanner } from './game-planner';

@Injectable()
export class GameService {
  private readonly planner: GamePlanner;
  private readonly logger = new Logger(GameService.name);

  constructor(llm: LlmService) {
    this.planner = new GamePlanner(llm, this.logger);
  }

  generate(idea: string) {
    return this.planner.generate(idea);
  }
}
