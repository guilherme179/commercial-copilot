import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';

@Injectable()
export class QueryDao {
  constructor(@Inject('MYSQL_POOL') private readonly db: Pool) {}

  async executeQuery(sql: string): Promise<unknown[]> {
    const [rows] = await this.db.query(sql);
    return rows as unknown[];
  }
}