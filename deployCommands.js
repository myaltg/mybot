// Tiny leveled logger. Set LOG_LEVEL=debug|info|warn|error
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 20;

function ts() {
  return new Date().toISOString();
}

function fmt(level, args) {
  return [`[${ts()}] [${level.toUpperCase()}]`, ...args];
}

export const logger = {
  debug: (...a) => current <= 10 && console.log(...fmt('debug', a)),
  info:  (...a) => current <= 20 && console.log(...fmt('info',  a)),
  warn:  (...a) => current <= 30 && console.warn(...fmt('warn',  a)),
  error: (...a) => current <= 40 && console.error(...fmt('error', a)),
};
