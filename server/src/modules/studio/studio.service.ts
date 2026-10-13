import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { validateGameSpec, type CollectSpec } from '@children-games/shared';
import { DatabaseService, type RowDataPacket, type SqlConnection } from './database.service';

export type SavedGame = {
  gameId: string;
  title: string;
  currentVersionId: string;
  versionNumber: number;
  spec: CollectSpec;
  createdAt: string;
  updatedAt: string;
};

export type GameVersionSummary = { versionId: string; versionNumber: number; origin: string; createdAt: string };

type GameRow = RowDataPacket & {
  game_id: string;
  game_title: string;
  current_version_id: string;
  version_number: number;
  game_spec: unknown;
  created_at: Date;
  updated_at: Date;
};

type VersionRow = RowDataPacket & { latest_version: number };

@Injectable()
export class StudioService {
  constructor(private readonly database: DatabaseService) {}

  async create(specInput: unknown): Promise<SavedGame> {
    const spec = this.toCollectSpec(specInput);
    const gameId = randomUUID();
    const versionId = randomUUID();
    await this.database.withTransaction(async (connection) => {
      await connection.execute(
        'INSERT INTO game_record (game_id, game_title, current_version_id) VALUES (?, ?, ?)',
        [gameId, spec.title, versionId],
      );
      await connection.execute(
        'INSERT INTO game_version (version_id, game_id, version_number, game_spec, version_origin) VALUES (?, ?, ?, ?, ?)',
        [versionId, gameId, 1, JSON.stringify(spec), 'create'],
      );
    });
    return this.get(gameId);
  }

  async saveVersion(gameId: string, specInput: unknown): Promise<SavedGame> {
    const spec = this.toCollectSpec(specInput);
    const versionId = randomUUID();
    await this.database.withTransaction(async (connection) => {
      const [records] = await connection.execute<RowDataPacket[]>(
        'SELECT game_id FROM game_record WHERE game_id = ? FOR UPDATE', [gameId],
      );
      if (records.length === 0) throw new NotFoundException('找不到这个游戏作品');
      const [versions] = await connection.execute<VersionRow[]>(
        'SELECT COALESCE(MAX(version_number), 0) AS latest_version FROM game_version WHERE game_id = ?', [gameId],
      );
      const versionNumber = Number(versions[0].latest_version) + 1;
      await this.insertVersion(connection, versionId, gameId, versionNumber, spec, 'save');
      await connection.execute(
        'UPDATE game_record SET game_title = ?, current_version_id = ? WHERE game_id = ?',
        [spec.title, versionId, gameId],
      );
    });
    return this.get(gameId);
  }

  async list(): Promise<SavedGame[]> {
    const rows = await this.database.query<GameRow[]>(this.selectCurrentGamesSql());
    return rows.map((row) => this.toSavedGame(row));
  }

  async get(gameId: string): Promise<SavedGame> {
    const rows = await this.database.query<GameRow[]>(`${this.selectCurrentGamesSql()} WHERE game_record.game_id = ?`, [gameId]);
    if (rows.length === 0) throw new NotFoundException('找不到这个游戏作品');
    return this.toSavedGame(rows[0]);
  }

  async listVersions(gameId: string): Promise<GameVersionSummary[]> {
    const rows = await this.database.query<(RowDataPacket & { version_id: string; version_number: number; version_origin: string; created_at: Date })[]>(
      'SELECT version_id, version_number, version_origin, created_at FROM game_version WHERE game_id = ? ORDER BY version_number DESC', [gameId],
    );
    if (rows.length === 0) throw new NotFoundException('找不到这个游戏作品');
    return rows.map((row) => ({ versionId: row.version_id, versionNumber: row.version_number, origin: row.version_origin, createdAt: row.created_at.toISOString() }));
  }

  async restoreVersion(gameId: string, versionId: string): Promise<SavedGame> {
    await this.database.withTransaction(async (connection) => {
      const [records] = await connection.execute<RowDataPacket[]>('SELECT game_id FROM game_record WHERE game_id = ? FOR UPDATE', [gameId]);
      if (records.length === 0) throw new NotFoundException('找不到这个游戏作品');
      const [versions] = await connection.execute<GameRow[]>(
        `SELECT game_record.game_id, game_record.game_title, game_version.version_id AS current_version_id,
          game_version.version_number, game_version.game_spec, game_record.created_at, game_record.updated_at
          FROM game_record INNER JOIN game_version ON game_version.game_id = game_record.game_id
          WHERE game_record.game_id = ? AND game_version.version_id = ?`, [gameId, versionId],
      );
      if (versions.length === 0) throw new NotFoundException('找不到这个历史版本');
      const spec = this.toCollectSpec(typeof versions[0].game_spec === 'string' ? JSON.parse(versions[0].game_spec) : versions[0].game_spec);
      await connection.execute('UPDATE game_record SET game_title = ?, current_version_id = ? WHERE game_id = ?', [spec.title, versionId, gameId]);
    });
    return this.get(gameId);
  }

  private async insertVersion(
    connection: SqlConnection,
    versionId: string,
    gameId: string,
    versionNumber: number,
    spec: CollectSpec,
    origin: string,
  ) {
    await connection.execute(
      'INSERT INTO game_version (version_id, game_id, version_number, game_spec, version_origin) VALUES (?, ?, ?, ?, ?)',
      [versionId, gameId, versionNumber, JSON.stringify(spec), origin],
    );
  }

  private selectCurrentGamesSql() {
    return `SELECT game_record.game_id, game_record.game_title, game_record.current_version_id,
      game_version.version_number, game_version.game_spec, game_record.created_at, game_record.updated_at
      FROM game_record INNER JOIN game_version ON game_version.version_id = game_record.current_version_id
      ORDER BY game_record.updated_at DESC`;
  }

  private toCollectSpec(input: unknown): CollectSpec {
    const spec = validateGameSpec(input);
    if (spec.gameType !== 'collect') throw new Error('当前只支持保存 collect 类型游戏');
    return spec;
  }

  private toSavedGame(row: GameRow): SavedGame {
    const rawSpec = typeof row.game_spec === 'string' ? JSON.parse(row.game_spec) : row.game_spec;
    return {
      gameId: row.game_id,
      title: row.game_title,
      currentVersionId: row.current_version_id,
      versionNumber: row.version_number,
      spec: this.toCollectSpec(rawSpec),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
