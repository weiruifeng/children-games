import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GameModule } from './modules/game/game.module';
import { StudioModule } from './modules/studio/studio.module';
import { RescueModule } from './modules/rescue/rescue.module';

@Module({
  imports: [GameModule, StudioModule, RescueModule],
  controllers: [HealthController],
})
export class AppModule {}
