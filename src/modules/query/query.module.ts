import { QueryValidatorModule } from '../query-validator/query-validator.module';
import { InterpreterModule } from '../interpreter/interpreter.module';
import { ComposerModule } from '../composer/composer.module';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { Module } from '@nestjs/common';
import { QueryDao } from './query.dao';

@Module({
  imports: [InterpreterModule, QueryValidatorModule, ComposerModule],
  controllers: [QueryController],
  providers: [QueryService, QueryDao],
})
export class QueryModule {}
