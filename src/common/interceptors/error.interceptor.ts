import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineError } from '../errors/pipeline-error';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  // Lista de campos sensíveis que não devem aparecer nos logs
  private readonly sensitiveFields = [
    'senha', 'password', 'token', 'secret',
    'authorization', 'question', 'sql', 'results' // ← adiciona esses
    ];

  // Função para sanitizar dados sensíveis
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sanitized = { ...data };
    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      
      // Se o campo é sensível, mascara o valor
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '***REDACTED***';
      } 
      // Se o valor é um objeto, sanitiza recursivamente
      else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }
    
    return sanitized;
  }

  private shouldSkipLogging(error: any, request: any): boolean {
    if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
      return true;
    }

    if (request.url === '/auth/login' && error instanceof BadRequestException) {
      return true;
    }

    return false;
  }

  private buildErrorDetails(error: any, request: any, errorId: string, now: Date) {
    const isPipelineError = error instanceof PipelineError;
    const causeDetails = isPipelineError ? error.getCauseDetails() : null;

    return {
      errorId,
      errorType: error.constructor.name,
      ...(isPipelineError
        ? {
            stage: error.stage,
            causeDetails,  // tudo que precisa saber está aqui
          }
        : {
            message: error.message,
            stack: error.stack,
          }
      ),
      timestamp: now.toISOString(),
      httpStatus: error instanceof HttpException ? error.getStatus() : 500,
      originalError: error instanceof HttpException ? error.getResponse() : null,
      context: {
        method: request.method,
        url: request.url,
        body: this.sanitizeData(request.body),
        ip: request.ip,
        cookies: this.sanitizeData(request.cookies),
      },
    };
  }

  private writeErrorLog(now: Date, errorDetails: Record<string, unknown>) {
    const date = now.toISOString().split('T')[0];
    const logFilePath = path.join(process.cwd(), 'logs', `error_log_${date}.log`);

    if (!fs.existsSync(path.dirname(logFilePath))) {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    }

    fs.appendFileSync(logFilePath, JSON.stringify(errorDetails, null, 2) + ',\n');
  }

  private mapValidationError(error: any, errorId: string): HttpException | null {
    if (
      !(error instanceof BadRequestException) ||
      !error.getResponse ||
      typeof error.getResponse !== 'function'
    ) {
      return null;
    }

    const res: any = error.getResponse();
    if (!res?.issues) {
      return null;
    }

    return new HttpException(
      {
        success: false,
        message: 'Falha na validação dos dados.',
        errorId,
        errors: res.issues,
      },
      400,
    );
  }

  private mapHttpException(error: HttpException, errorId: string): HttpException {
    const status = error.getStatus();
    const response = error.getResponse();

    return new HttpException(
      {
        success: false,
        message:
          typeof response === 'string'
            ? response
            : (response as { message?: string })?.message || 'Erro HTTP',
        errorId,
      },
      status,
    );
  }

  private mapUnexpectedError(error: any, errorId: string): HttpException {
    const userFacingError = new HttpException(
      {
        message: `Ocorreu um erro inesperado. Por favor, entre em contato com o MIS e forneça o seguinte código de erro: ${errorId}`,
        success: false,
      },
      500,
    );

    if (error.stack) {
      Object.defineProperty(userFacingError, 'cause', {
        value: error,
        writable: false,
        enumerable: false,
      });
    }

    return userFacingError;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();

        if (this.shouldSkipLogging(error, request)) {
          return throwError(() => error);
        }

        const errorId = request.requestId || uuidv4();
        const now = new Date();
        const errorDetails = this.buildErrorDetails(error, request, errorId, now);
        this.writeErrorLog(now, errorDetails);

        const validationError = this.mapValidationError(error, errorId);
        if (validationError) {
          return throwError(() => validationError);
        }

        if (error instanceof HttpException) {
          return throwError(() => this.mapHttpException(error, errorId));
        }

        return throwError(() => this.mapUnexpectedError(error, errorId));
      }),
    );
  }
}