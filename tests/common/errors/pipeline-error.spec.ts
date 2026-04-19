import { PipelineError } from '../../../src/common/errors/pipeline-error';
import {describe, expect, it } from '@jest/globals';

describe('PipelineError', () => {
  it('should store stage and cause', () => {
    const cause = new Error('original error');
    const error = new PipelineError('sql_generation', cause);
    
    expect(error.stage).toBe('sql_generation');
    expect(error.message).toBe('original error');
  });

  it('should return cause details for Error instance', () => {
    const cause = new Error('db failed');
    const error = new PipelineError('database_execution', cause);
    const details = error.getCauseDetails();

    expect(details.type).toBe('Error');
    expect(details.message).toBe('db failed');
  });

  it('should handle non-Error cause', () => {
    const error = new PipelineError('cache_read', 'string error');
    expect(error.message).toBe('string error');
  });
});