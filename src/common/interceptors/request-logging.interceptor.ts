import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private writeRequestLog(entry: Record<string, unknown>, now: Date): void {
    const date = now.toISOString().split('T')[0];
    const logFilePath = path.join(process.cwd(), 'logs', `request_log_${date}.log`);

    if (!fs.existsSync(path.dirname(logFilePath))) {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    }

    fs.appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const requestId = uuidv4();
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    request.requestId = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          const now = new Date();
          this.writeRequestLog(
            {
              requestId,
              method: request.method,
              path: request.url.split('?')[0],
              durationMs: Date.now() - start,
              status: 'success',
              statusCode: response?.statusCode,
              timestamp: now.toISOString(),
            },
            now,
          );
        },
        error: (err) => {
          const now = new Date();
          this.writeRequestLog(
            {
              requestId,
              method: request.method,
              path: request.url.split('?')[0],
              durationMs: Date.now() - start,
              status: 'error',
              statusCode:
                typeof err?.getStatus === 'function'
                  ? err.getStatus()
                  : response?.statusCode,
              errorType: err?.constructor?.name,
              timestamp: now.toISOString(),
            },
            now,
          );
        },
      }),
    );
  }
}