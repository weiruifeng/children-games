import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPool, type ExecuteValues, type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONFIG } from '../../config/database.config';

export type SqlConnection = Pick<PoolConnection, 'execute' | 'release' | 'beginTransaction' | 'commit' | 'rollback'>;
export type SqlPool = Pick<Pool, 'execute' | 'getConnection' | 'end'>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: SqlPool = createPool(DATABASE_CONFIG);

  async query<T extends RowDataPacket[]>(sql: string, values: ExecuteValues = []): Promise<T> {
    const [rows] = await this.pool.execute<T>(sql, values);
    return rows;
  }

  async withTransaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

export type { ResultSetHeader, RowDataPacket };
