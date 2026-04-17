import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { Module } from '@nestjs/common';
import { QueryDao } from './query.dao';

@Module({
  imports: [],
  controllers: [QueryController],
  providers: [QueryService, QueryDao],
})
export class QueryModule {}
