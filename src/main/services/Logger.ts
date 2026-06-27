import fs from 'node:fs';
import path from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(
    private readonly scope: string,
    private readonly logFilePath: string | null = null,
  ) {}

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`, this.logFilePath);
  }

  debug(message: string, meta?: unknown): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      message,
      meta,
    };

    const line = JSON.stringify(record);

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    if (!this.logFilePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
      fs.appendFileSync(this.logFilePath, `${line}\n`, 'utf8');
    } catch (error) {
      console.error('Failed to write log file', error);
    }
  }
}

export function createRootLogger(userDataPath: string): Logger {
  return new Logger('app', path.join(userDataPath, 'logs', 'app.log'));
}

