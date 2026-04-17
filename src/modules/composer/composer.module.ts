import { ComposerService } from './composer.service';
import { Module } from '@nestjs/common';

@Module({
    providers: [ComposerService],
    exports: [ComposerService],
})
export class ComposerModule {}
