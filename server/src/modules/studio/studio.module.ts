import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StudioController],
  providers: [StudioService],
})
export class StudioModule {}
