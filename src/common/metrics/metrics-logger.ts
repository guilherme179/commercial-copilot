import * as path from 'path';
import * as fs from 'fs';

export function writeMetricLog(data: Record<string, unknown>): void {
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