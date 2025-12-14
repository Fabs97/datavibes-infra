type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    requestId?: string;
    [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private context: LogContext = {};
    private minLevel: LogLevel;

    constructor() {
        const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
        this.minLevel = LOG_LEVELS[level] !== undefined ? level : 'info';
    }

    /**
     * Set context that will be included in all subsequent log messages
     */
    setContext(context: LogContext): void {
        this.context = { ...this.context, ...context };
    }

    /**
     * Clear the current context
     */
    clearContext(): void {
        this.context = {};
    }

    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): Logger {
        const child = new Logger();
        child.context = { ...this.context, ...context };
        child.minLevel = this.minLevel;
        return child;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    }

    private formatMessage(level: LogLevel, message: string, data?: Record<string, unknown>): string {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            ...this.context,
            ...data,
        };
        return JSON.stringify(logEntry);
    }

    debug(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message, data));
        }
    }

    info(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message, data));
        }
    }

    warn(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }

    error(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }
}

// Singleton instance
export const logger = new Logger();

// Factory function for creating request-scoped loggers
export function createRequestLogger(requestId: string): Logger {
    return logger.child({ requestId });
}
