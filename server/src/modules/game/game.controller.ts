import { Body, Controller, Post } from '@nestjs/common';
import { GameService } from './game.service';

class GenerateDto {
  idea!: string;
}

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('generate')
  async generate(@Body() body: GenerateDto) {
    const spec = await this.gameService.generate(body.idea);
    return { spec };
  }
}
