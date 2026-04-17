import { InterpreterService } from './interpreter.service';
import { InterpreterDao } from './interpreter.dao';
import { Module } from '@nestjs/common';

@Module({
    providers: [InterpreterService, InterpreterDao],
    exports: [InterpreterService],
})
export class InterpreterModule {}
