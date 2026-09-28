import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', name: 'children-games-server', version: '0.1.0' };
  }
}
