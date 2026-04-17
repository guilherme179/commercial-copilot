/**
 * ========================================
 * SENTRY - Error Monitoring Configuration
 * ========================================
 *
 * This file contains the full Sentry configuration for error tracking.
 * It is fully decoupled and can be copied to any Node.js/NestJS project.
 *
 * REQUIREMENTS:
 * - npm install @sentry/node @sentry/profiling-node
 *
 * ENVIRONMENT VARIABLES (.env):
 * - SENTRY_DSN: Sentry project URL (required)
 * - SENTRY_ENVIRONMENT: environment (development, staging, production)
 * - SENTRY_SAMPLE_RATE: error sampling rate (0.0 to 1.0)
 * - SENTRY_TRACES_SAMPLE_RATE: trace sampling rate (0.0 to 1.0)
 */

import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Interface for custom Sentry configuration
 */
export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  enabled?: boolean;
}

/**
 * Initializes Sentry with environment settings
 *
 * @param customConfig - Custom settings (optional)
 * @returns void
 *
 * @example
 * // At the beginning of main.ts or app.ts
 * initSentry();
 *
 * @example
 * // With custom settings
 * initSentry({
 *   environment: 'staging',
 *   sampleRate: 0.5
 * });
 */
export function initSentry(customConfig?: SentryConfig): void {
  const config = {
    dsn: customConfig?.dsn || process.env.SENTRY_DSN,
    environment:
      customConfig?.environment ||
      process.env.SENTRY_ENVIRONMENT ||
      process.env.NODE_ENV ||
      'development',
    release:
      customConfig?.release || process.env.npm_package_version || '1.0.0',
    sampleRate:
      customConfig?.sampleRate ||
      parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
    tracesSampleRate:
      customConfig?.tracesSampleRate ||
      parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    enabled:
      customConfig?.enabled !== undefined
        ? customConfig.enabled
        : !!process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test',
  };

  // If not enabled, do not initialize
  if (!config.enabled) {
    console.warn('Sentry disabled — DSN not configured or test environment');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,

    // Sends default PII info (e.g. IP address)
    sendDefaultPii: true,

    // Error sampling rate (1.0 = 100% of errors)
    sampleRate: config.sampleRate,

    // Traces sampling rate (0.1 = 10% of transactions)
    tracesSampleRate: config.tracesSampleRate,

    // Automatic integrations
    integrations: [
      // Automatic HTTP tracking
      Sentry.httpIntegration(),

      // Local context tracking
      Sentry.localVariablesIntegration(),

      // Performance profiling
      nodeProfilingIntegration(),

      // Module tracking
      Sentry.modulesIntegration(),

      // Context lines in the stack trace
      Sentry.contextLinesIntegration(),
    ],

    beforeSend(event, _hint) {
      // Enrich event with additional context here if needed
      return event;
    },

    beforeBreadcrumb(breadcrumb, _hint) {
      // Filters sensitive breadcrumbs if needed
      if (
        breadcrumb.category === 'http' &&
        breadcrumb.data?.url?.includes('password')
      ) {
        return null; // Do not send breadcrumbs containing passwords
      }
      return breadcrumb;
    },

    // Ignores specific errors (optional)
    ignoreErrors: [
      // Common errors that add noise without actionable value
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
    ],
  });
}

/**
 * Captures an error manually and sends it to Sentry
 *
 * @param error - The error to capture
 * @param context - Additional context (tags, extras, user, etc)
 * @returns Sentry Event ID
 *
 * @example
 * try {
 *   // code that may throw an error
 * } catch (error) {
 *   captureError(error, {
 *     tags: { module: 'payment' },
 *     extra: { orderId: '123' },
 *     user: { id: 'user-123' }
 *   });
 * }
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string; username?: string };
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    errorId?: string; // Custom error ID (from your system)
  },
): string {
  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: {
      ...context?.extra,
      // Includes the custom errorId if provided
      errorId: context?.errorId,
    },
    user: context?.user,
    level: context?.level || 'error',
  });
}

/**
 * Captures a message (not an error, but relevant info)
 *
 * @param message - Message to capture
 * @param level - Severity level
 * @param context - Additional context
 * @returns Sentry Event ID
 *
 * @example
 * captureMessage('Payment processed successfully', 'info', {
 *   tags: { payment_method: 'credit_card' }
 * });
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): string {
  return Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Adds user context to the current session
 *
 * @param user - User data
 *
 * @example
 * setUser({ id: '123', email: 'user@example.com', username: 'john' });
 */
export function setUser(
  user: { id?: string; email?: string; username?: string } | null,
): void {
  Sentry.setUser(user);
}

/**
 * Adds a tag to the current context
 *
 * @param key - Tag key
 * @param value - Tag value
 *
 * @example
 * setTag('payment_method', 'credit_card');
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Adds multiple tags to the current context
 *
 * @param tags - Object containing tags
 *
 * @example
 * setTags({ module: 'payment', action: 'process' });
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Adds extra context (any additional data)
 *
 * @param key - Context key
 * @param value - Context value
 *
 * @example
 * setExtra('orderDetails', { id: '123', total: 100.50 });
 */
export function setExtra(key: string, value: unknown): void {
  Sentry.setExtra(key, value);
}

/**
 * Adds a breadcrumb manually
 *
 * @param breadcrumb - Breadcrumb data
 *
 * @example
 * addBreadcrumb({
 *   category: 'payment',
 *   message: 'Starting payment processing',
 *   level: 'info',
 *   data: { amount: 100.50 }
 * });
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Captures all unhandled exceptions (uncaught exceptions and unhandled rejections)
 * Must be called at application startup
 *
 * @example
 * setupGlobalErrorHandlers();
 */
export function setupGlobalErrorHandlers(): void {
  // Captures unhandled synchronous errors
  process.on('uncaughtException', (error: Error) => {
    console.error('❌ Uncaught Exception:', error);
    captureError(error, {
      tags: { type: 'uncaughtException' },
      level: 'fatal',
    });

    // Waits for sending before exiting
    Sentry.close(2000).then(() => {
      process.exit(1);
    });
  });

  // Captures unhandled rejected promises
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌ Unhandled Rejection:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureError(error, {
      tags: { type: 'unhandledRejection' },
      level: 'fatal',
    });
  });
}

/**
 * Waits for all pending events to be sent before shutting down
 * Use before process.exit() or during application shutdown
 *
 * @param timeout - Timeout in milliseconds (default: 2000)
 * @returns Promise that resolves when all events have been sent
 *
 * @example
 * await flushSentry();
 * process.exit(0);
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

// Exports the original Sentry for advanced use cases
export { Sentry };
