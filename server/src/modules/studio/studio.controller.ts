import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { StudioService } from './studio.service';

class SaveGameDto {
  spec!: unknown;
}

@Controller('studio/games')
export class StudioController {
  constructor(private readonly studioService: StudioService) {}

  @Post()
  create(@Body() body: SaveGameDto) {
    return this.studioService.create(body.spec);
  }

  @Get()
  list() {
    return this.studioService.list();
  }

  @Get(':gameId/versions')
  listVersions(@Param('gameId') gameId: string) {
    return this.studioService.listVersions(gameId);
  }

  @Post(':gameId/versions/:versionId/restore')
  restoreVersion(@Param('gameId') gameId: string, @Param('versionId') versionId: string) {
    return this.studioService.restoreVersion(gameId, versionId);
  }

  @Get(':gameId')
  get(@Param('gameId') gameId: string) {
    return this.studioService.get(gameId);
  }

  @Put(':gameId')
  saveVersion(@Param('gameId') gameId: string, @Body() body: SaveGameDto) {
    return this.studioService.saveVersion(gameId, body.spec);
  }
}
