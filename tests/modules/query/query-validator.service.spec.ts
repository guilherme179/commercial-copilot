import { QueryValidatorService } from '../../../src/modules/query-validator/query-validator.service';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

describe('QueryValidatorService', () => {
  let service: QueryValidatorService;

  beforeEach(() => {
    service = new QueryValidatorService();
  });

  it('should allow valid SELECT query', () => {
    expect(() => service.validate('SELECT * FROM orders LIMIT 100')).not.toThrow();
  });

  it('should block DROP', () => {
    expect(() => service.validate('DROP TABLE orders')).toThrow(BadRequestException);
  });

  it('should block DELETE', () => {
    expect(() => service.validate('DELETE FROM orders LIMIT 100')).toThrow(BadRequestException);
  });

  it('should require LIMIT', () => {
    expect(() => service.validate('SELECT * FROM orders')).toThrow(BadRequestException);
  });

  it('should strip comments before validating', () => {
    expect(() => service.validate('-- comment\nSELECT * FROM orders LIMIT 100')).not.toThrow();
  });
});