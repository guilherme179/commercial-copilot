import { Controller, Get } from '@nestjs/common';
import { QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get()
  async getCustomers(): Promise<unknown[]> {
    return this.queryService.getCustomers();
  }
}
