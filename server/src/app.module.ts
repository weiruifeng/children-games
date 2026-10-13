import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GameModule } from './modules/game/game.module';
import { StudioModule } from './modules/studio/studio.module';

@Module({
  imports: [GameModule, StudioModule],
  controllers: [HealthController],
})
export class AppModule {}
