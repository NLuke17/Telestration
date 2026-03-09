// Log levels
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Get log level from environment variable (default to INFO)
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  'error': LogLevel.ERROR,
  'warn': LogLevel.WARN,
  'info': LogLevel.INFO,
  'debug': LogLevel.DEBUG,
};

const currentLogLevel = LOG_LEVEL_MAP[process.env.LOG_LEVEL?.toLowerCase() || 'info'] ?? LogLevel.INFO;

function shouldLog(level: LogLevel): boolean {
  return level <= currentLogLevel;
}

export function logInfo(msg: string, meta?: any): void {
  if (!shouldLog(LogLevel.INFO)) return;
  
  if (meta) {
    console.log(`[INFO] ${msg}`, meta);
  } else {
    console.log(`[INFO] ${msg}`);
  }
}

export function logWarn(msg: string, meta?: any): void {
  if (!shouldLog(LogLevel.WARN)) return;
  
  if (meta) {
    console.warn(`[WARN] ${msg}`, meta);
  } else {
    console.warn(`[WARN] ${msg}`);
  }
}

export function logError(msg: string, meta?: any): void {
  if (!shouldLog(LogLevel.ERROR)) return;
  
  if (meta) {
    console.error(`[ERROR] ${msg}`, meta);
  } else {
    console.error(`[ERROR] ${msg}`);
  }
}

export function logDebug(msg: string, meta?: any): void {
  if (!shouldLog(LogLevel.DEBUG)) return;
  
  if (meta) {
    console.log(`[DEBUG] ${msg}`, meta);
  } else {
    console.log(`[DEBUG] ${msg}`);
  }
}
