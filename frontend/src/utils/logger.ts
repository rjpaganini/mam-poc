/**
 * Logger utility
 */

// Log levels
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

class Logger {
    private isDev: boolean;

    constructor() {
        this.isDev = process.env.NODE_ENV === 'development';
    }

    private fmt(level: LogLevel, msg: string): string {
        return `[${new Date().toISOString()}] [${level}] ${msg}`;
    }

    public debug(msg: string, ...args: any[]): void {
        if (this.isDev) console.debug(this.fmt(LogLevel.DEBUG, msg), ...args);
    }

    public info(msg: string, ...args: any[]): void {
        console.info(this.fmt(LogLevel.INFO, msg), ...args);
    }

    public warn(msg: string, ...args: any[]): void {
        console.warn(this.fmt(LogLevel.WARN, msg), ...args);
    }

    public error(msg: string, ...args: any[]): void {
        console.error(this.fmt(LogLevel.ERROR, msg), ...args);
    }
}

// Export singleton instance
export const logger = new Logger(); 