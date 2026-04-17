import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { captureError } from '../monitoring/sentry.config';

/**
 * Global interceptor that captures unexpected errors and forwards them to Sentry.
 * Works alongside the error interceptor — Sentry receives the raw error before
 * it is transformed for the end user.
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        // Only capture unexpected server errors — skip HTTP exceptions
        if (!(error instanceof HttpException)) {
          captureError(error, {
            tags: { source: 'sentry-interceptor' },
          });
        }

        return throwError(() => error);
      }),
    );
  }
}
