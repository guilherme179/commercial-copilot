import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface MetricEvent {
  requestId: string;
  event: string;
  durationMs?: number;
  [key: string]: unknown;
}

@Injectable()
export class MetricsService {
  write(data: MetricEvent): void {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const logFilePath = path.join(process.cwd(), 'logs', `metrics_${date}.log`);

    if (!fs.existsSync(path.dirname(logFilePath))) {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    }

    fs.appendFileSync(
      logFilePath,
      JSON.stringify({ ...data, timestamp: now.toISOString() }) + '\n',
    );
  }

  time(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
}