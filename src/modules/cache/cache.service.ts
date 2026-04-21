// src/modules/cache/cache.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { createClient } from 'redis';

const SIMILARITY_THRESHOLD = 0.95;
const TTL_SECONDS = 14400;

@Injectable()
export class CacheService implements OnModuleInit {
    private client!: ReturnType<typeof createClient>;
    private available = false;
    private readonly logger = new Logger(CacheService.name);
    
    constructor(
        private readonly embeddingService: EmbeddingService,
    ) {}

    async onModuleInit() {
        this.client = createClient({
            url: process.env.REDIS_URL,
            socket: {
                reconnectStrategy: (retries) => {
                    const delay = Math.min(retries * 1000, 30000);
                    return delay;
                },
            },
        });

        this.client.on('error', (err) => {
            if (this.available) {
                this.logger.warn(`Redis error — cache disabled: ${err.message}`);
                this.available = false;
            }
        });

        this.client.on('ready', () => {
            this.logger.log('Redis connected — cache enabled');
            this.available = true;
        });

        // não await — deixa conectar em background
        this.client.connect().catch(() => {
            this.logger.warn('Redis unavailable on startup — cache disabled, system running without cache');
        });
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit().catch(() => {});
        }
    }

    async get(question: string, employeeId: string): Promise<string | null> {
        if (!this.available) return null;
        const vector = await this.embeddingService.embed(question);
        const buffer = this.toBuffer(vector);

        const results = await this.client.sendCommand([
            'FT.SEARCH', 'sql_cache',
            `@employeeId:{${employeeId}}=>[KNN 1 @vector $vec AS score]`,
            'PARAMS', '2', 'vec', buffer,
            'RETURN', '3', 'sql', 'score', 'employeeId',
            'SORTBY', 'score',
            'DIALECT', '2',
        ]) as any[];

        if (!results || results[0] === 0) return null;

        // pega o array de campos do primeiro resultado
        const fields = results[2] as string[];

        // converte array ['key', 'value', 'key', 'value'] em objeto
        const fieldsMap: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
            fieldsMap[fields[i]] = fields[i + 1];
        }

        const score = parseFloat(fieldsMap['score'] ?? '1');
        const similarity = 1 - score;

        if (similarity < SIMILARITY_THRESHOLD) return null;

        return fieldsMap['sql'] ?? null;
    }

    async set(question: string, employeeId: string, sql: string): Promise<void> {
        if (!this.available) return;
        const vector = await this.embeddingService.embed(question);
        const buffer = this.toBuffer(vector);
        const key = `cache:${Date.now()}`;

        await this.client.hSet(key, {
            vector: buffer,
            sql,
            employeeId,
        });

        await this.client.expire(key, TTL_SECONDS);
    }

    private toBuffer(vector: number[]): Buffer {
        const float32 = new Float32Array(vector);
        return Buffer.from(float32.buffer);
    }
}