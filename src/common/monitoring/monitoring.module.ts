/**
 * ========================================
 * MONITORING MODULE - NestJS
 * ========================================
 *
 * Módulo que integra Sentry e Prometheus na aplicação NestJS.
 * Totalmente desacoplado e pronto para ser copiado em outros projetos.
 */

import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';

/**
 * Módulo global de monitoramento
 * Fornece integração com Sentry e Prometheus
 *
 * @example
 * // No app.module.ts
 * @Module({
 *   imports: [MonitoringModule],
 * })
 * export class AppModule {}
 */
@Global()
@Module({
  providers: [
    // Registra o interceptor do Sentry globalmente
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
  exports: [],
})
export class MonitoringModule {}
