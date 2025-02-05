/**
 * Logger utility for consistent logging across the application
 */

// Log levels
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

class Logger {
    private isDevelopment: boolean;

    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    public debug(message: string, ...args: any[]): void {
        if (this.isDevelopment) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
        }
    }

    public info(message: string, ...args: any[]): void {
        console.info(this.formatMessage(LogLevel.INFO, message), ...args);
    }

    public warn(message: string, ...args: any[]): void {
        console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
    }

    public error(message: string, ...args: any[]): void {
        console.error(this.formatMessage(LogLevel.ERROR, message), ...args);
    }
}

// Export singleton instance
export const logger = new Logger(); 