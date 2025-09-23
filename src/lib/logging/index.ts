type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogContext = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private isProduction(): boolean {
    try {
      return process.env.NODE_ENV === 'production';
    } catch {
      return false;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (level === 'debug' && this.isProduction()) {
      return false;
    }
    return true;
  }

  private redactKey(key: string): boolean {
    const k = key.toLowerCase();
    // redact obvious secret-bearing keys
    return (
      k.includes('secret') ||
      k === 'password' ||
      k.includes('password') ||
      k.includes('token') ||
      k === 'authorization' ||
      k === 'auth' ||
      k === 'api_key' ||
      k === 'apikey' ||
      k === 'apiKey'.toLowerCase() ||
      k === 'api_secret' ||
      k === 'webhook_secret' ||
      k === 'set-cookie' ||
      k === 'cookie' ||
      k.includes('private') ||
      k === 'pwd' ||
      k === 'passwd'
    );
  }

  private sanitizeValue(value: unknown, keyPath: string[] = []): unknown {
    // Redact by key
    const lastKey = keyPath[keyPath.length - 1];
    if (lastKey && this.redactKey(lastKey)) {
      return '[REDACTED]';
    }

    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      // Truncate very long strings to avoid logging payloads
      const limit = 200;
      return value.length > limit ? value.slice(0, limit) + '…' : value;
    }
    if (Array.isArray(value)) {
      return value.map((v, i) => this.sanitizeValue(v, [...keyPath, String(i)]));
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        sanitized[k] = this.sanitizeValue(v, [...keyPath, k]);
      }
      return sanitized;
    }
    return value;
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return context;
    return this.sanitizeValue(context, []) as LogContext;
  }

  private formatError(error: Error): Error {
    const formattedError = new Error(error.message);
    formattedError.name = error.name;
    formattedError.stack = error.stack;
    if ('cause' in error && error.cause instanceof Error) {
      (formattedError as { cause?: Error }).cause = this.formatError(error.cause);
    }
    return formattedError;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.sanitizeContext(context),
      error: error ? this.formatError(error) : undefined
    };
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }
    // In production, you might want to send this to a logging service
    // For now, we'll use console.log with proper formatting
    const output = {
      ...entry,
      error: entry.error ? {
        name: entry.error.name,
        message: entry.error.message,
        // Only include stack trace for errors
        ...(entry.level === 'error' ? { stack: entry.error.stack } : {})
      } : undefined
    };

    console[entry.level](JSON.stringify(output, null, 2));
  }

  info(message: string, context?: LogContext): void {
    this.log(this.createLogEntry('info', message, context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(this.createLogEntry('warn', message, context, error));
  }

  error(message: string, error: Error, context?: LogContext): void {
    this.log(this.createLogEntry('error', message, context, error));
  }

  debug(message: string, context?: LogContext): void {
    this.log(this.createLogEntry('debug', message, context));
  }

  // Specific trading related logs
  tradingError(operation: string, error: Error, context?: LogContext): void {
    this.error(
      `Trading operation failed: ${operation}`,
      error,
      { type: 'trading', operation, ...context }
    );
  }

  tradingSuccess(operation: string, context?: LogContext): void {
    this.info(
      `Trading operation succeeded: ${operation}`,
      { type: 'trading', operation, ...context }
    );
  }

  // Webhook related logs
  webhookError(error: Error, context?: LogContext): void {
    this.error(
      'Webhook processing failed',
      error,
      { type: 'webhook', ...context }
    );
  }

  webhookSuccess(context?: LogContext): void {
    this.info(
      'Webhook processed successfully',
      { type: 'webhook', ...context }
    );
  }
}

export const logger = new Logger();

export function normalizeError(value: unknown, fallbackMessage = 'Unknown error'): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === 'string') {
    return new Error(value);
  }

  if (value && typeof value === 'object') {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return new Error(message);
    }
  }

  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(fallbackMessage);
  }
}

export type { LogContext };
