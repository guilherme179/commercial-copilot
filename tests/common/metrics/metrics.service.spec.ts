import { MetricsService } from '../../../src/common/metrics/metrics.service';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

import * as fs from 'fs';

describe('MetricsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a timer that returns elapsed ms', async () => {
        const service = new MetricsService();
        const timer = service.time();

        await new Promise(r => setTimeout(r, 50));

        expect(timer()).toBeGreaterThanOrEqual(50);
    });

    it('should write metric to log file', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);

        const service = new MetricsService();
        expect(() => service.write({ requestId: 'abc', event: 'test' })).not.toThrow();

        expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should create logs directory if it does not exist', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const service = new MetricsService();
        service.write({ requestId: 'abc', event: 'test' });

        expect(fs.mkdirSync).toHaveBeenCalled();
        expect(fs.appendFileSync).toHaveBeenCalled();
    });
});