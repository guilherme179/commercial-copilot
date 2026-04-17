import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolConnection } from 'mysql2/promise';

@Injectable()
export class MySqlTransactionService {
  private readonly logger = new Logger(MySqlTransactionService.name);

  constructor(@Inject('MYSQL_POOL') private readonly pool: Pool) {}

  async runInTransaction<T>(
    work: (conn: PoolConnection) => Promise<T>,
    options?: { rollbackOnResult?: (result: T) => boolean },
  ): Promise<T> {
    const conn = await this.pool.getConnection();

    try {
      await conn.beginTransaction();

      const result = await work(conn);

      const shouldRollback = options?.rollbackOnResult?.(result) ?? false;
      if (shouldRollback) {
        await conn.rollback();
        return result;
      }

      await conn.commit();

      return result;
    } catch (error) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        this.logger.error(
          'Falha ao executar ROLLBACK da transacao MySQL',
          rollbackError instanceof Error
            ? rollbackError.stack
            : String(rollbackError),
        );
      }

      throw error;
    } finally {
      conn.release();
    }
  }
}