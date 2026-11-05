import { Body, BadRequestException, Controller, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { validateRescueSpec } from '../../../../shared/src/index';
import { LlmService } from '../llm/llm.service';
import { RescuePlanner } from './rescue-planner';

@Controller('rescue')
class RescueController {
  constructor(private readonly llm: LlmService) {}
  @Post('modify')
  modify(@Body() body: unknown) {
    let request;
    try {
      request = z.object({ input: z.string().trim().min(1).max(500), spec: z.unknown() }).strict().parse(body);
      request.spec = validateRescueSpec(request.spec);
    } catch { throw new BadRequestException('请提供一句想法和可玩的当前游戏配置'); }
    return new RescuePlanner(this.llm).modify(request.input, validateRescueSpec(request.spec));
  }
}

@Module({ controllers: [RescueController], providers: [LlmService] })
export class RescueModule {}
