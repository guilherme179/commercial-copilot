import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';

@Injectable()
export class InterpreterDao {
    constructor(@Inject('MYSQL_POOL') private readonly db: Pool) {}

    async getSchema(tables: string[]): Promise<string> {
        const ddls: string[] = [];

        for (const table of tables) {
            const [rows] = await this.db.query(`SHOW CREATE TABLE ${table}`);
            const row = (rows as any[])[0];
            const ddl = row['Create Table'];
            ddls.push(ddl);
        }

        return ddls.join('\n\n');
    }
}