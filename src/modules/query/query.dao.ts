import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';

@Injectable()
export class QueryDao {
  constructor(@Inject('MYSQL_POOL') private readonly db: Pool) {}

  async findAllCustomers(): Promise<unknown[]> {
    const [rows] = await this.db.execute('SELECT * FROM customers');
    return rows as unknown[];
  }
}