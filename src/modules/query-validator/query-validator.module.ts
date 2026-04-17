import { QueryValidatorService } from './query-validator.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [QueryValidatorService],
  exports: [QueryValidatorService],
})
export class QueryValidatorModule {}