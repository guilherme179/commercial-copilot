// query-validator.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class QueryValidatorService {
    private readonly FORBIDDEN = [
        'DROP', 'DELETE', 'UPDATE', 'INSERT',
        'TRUNCATE', 'ALTER', 'CREATE', 'REPLACE'
    ];

    validate(sql: string): void {
        const normalized = sql
            .replace(/--.*$/gm, '')    // remove comentários de linha
            .replace(/\/\*[\s\S]*?\*\//g, '') // remove comentários de bloco
            .trim()
            .toUpperCase();

        if (!normalized.startsWith('SELECT')) {
            throw new BadRequestException('Only SELECT queries are allowed');
        }

        for (const word of this.FORBIDDEN) {
            if (normalized.includes(word)) {
                throw new BadRequestException(`Forbidden operation detected: ${word}`);
            }
        }

        if (!normalized.includes('LIMIT')) {
            throw new BadRequestException('LIMIT clause is required');
        }
    }
}