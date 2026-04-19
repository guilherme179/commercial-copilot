// src/modules/cache/cache.service.ts
import {Injectable } from '@nestjs/common';

const EMBEDDING_DIMENSIONS = 768;
@Injectable()
export class EmbeddingService {
    private readonly baseUrl = process.env.LLM_BASE_URL;
    private readonly model = process.env.EMBEDDING_MODEL;

    async embed(text: string): Promise<number[]> {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                input: text.toLowerCase().trim(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Embedding failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data[0].embedding; // array de 768 números
    }
}