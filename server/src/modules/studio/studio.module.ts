import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';

@Module({
  controllers: [StudioController],
  providers: [DatabaseService, StudioService],
})
export class StudioModule {}
