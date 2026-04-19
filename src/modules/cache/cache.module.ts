import { EmbeddingService } from './embedding.service';
import { CacheService } from './cache.service';
import { Module } from '@nestjs/common';

@Module({
    providers: [CacheService, EmbeddingService],
    exports: [CacheService],
})
export class CachingModule {}
