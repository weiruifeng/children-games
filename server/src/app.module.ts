import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GameModule } from './modules/game/game.module';

@Module({
  imports: [GameModule],
  controllers: [HealthController],
})
export class AppModule {}
