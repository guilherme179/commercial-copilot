import { Injectable } from '@nestjs/common';
import { QueryDao } from './query.dao';

@Injectable()
export class QueryService {
  constructor(
    private readonly dao: QueryDao
  ) {}

  async getCustomers(): Promise<unknown[]> {
    return this.dao.findAllCustomers();
  }
}
