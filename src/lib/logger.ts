const isDev = process.env.NODE_ENV === 'development';

// ── Log-level hierarchy ──────────────────────────────────────────────
// debug(0) < info(1) < success(2) < warn(3) < error(4)
const LEVEL_VALUES = { debug: 0, info: 1, success: 2, warn: 3, error: 4 } as const;
type Level = keyof typeof LEVEL_VALUES;

function resolveLogLevel(): Level {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env in LEVEL_VALUES) return env as Level;
  return isDev ? 'debug' : 'warn';
}

const CURRENT_LEVEL = resolveLogLevel();

function shouldLog(level: Level): boolean {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[CURRENT_LEVEL];
}

// ── ANSI color codes (dev only) ──────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const FG = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

type Color = keyof typeof FG;

interface DomainConfig {
  icon: string;
  color: Color;
}

const DOMAINS: Record<string, DomainConfig> = {
  cache:           { icon: '\uD83D\uDCBE', color: 'cyan' },
  feed:            { icon: '\uD83D\uDCE1', color: 'blue' },
  profile:         { icon: '\uD83D\uDC64', color: 'magenta' },
  auth:            { icon: '\uD83D\uDD10', color: 'yellow' },
  discover:        { icon: '\uD83D\uDD0D', color: 'green' },
  summary:         { icon: '\uD83D\uDCDD', color: 'cyan' },
  insights:        { icon: '\uD83D\uDCA1', color: 'magenta' },
  gemini:          { icon: '\uD83E\uDD16', color: 'yellow' },
  youtube:         { icon: '\uD83C\uDFAC', color: 'red' },
  'yt-transcript': { icon: '\uD83D\uDCDC', color: 'red' },
  'yt-import':     { icon: '\uD83D\uDCE5', color: 'red' },
  'yt-classify':   { icon: '\uD83C\uDFF7\uFE0F', color: 'yellow' },
  podcast:         { icon: '\uD83C\uDF99\uFE0F', color: 'green' },
  rss:             { icon: '\uD83D\uDCF0', color: 'green' },
  deepgram:        { icon: '\uD83C\uDF99', color: 'blue' },
  queue:           { icon: '\u23F3', color: 'cyan' },
  onboarding:      { icon: '\uD83D\uDE80', color: 'magenta' },
  notifications:   { icon: '\uD83D\uDD14', color: 'yellow' },
  token:           { icon: '\uD83D\uDD11', color: 'yellow' },
  admin:           { icon: '\uD83D\uDEE1\uFE0F', color: 'red' },
  'ask-ai':        { icon: '\uD83E\uDDE0', color: 'magenta' },
  'add-podcast':   { icon: '\u2795', color: 'green' },
};

const LEVEL_ICONS: Record<string, string> = {
  info: '',
  success: '\u2705 ',
  warn: '\u26A0\uFE0F  ',
  error: '\u274C ',
  debug: '',
};

/**
 * Format a duration in ms to a human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(0);
  return `${mins}m${secs}s`;
}

/**
 * Format structured data as key=value pairs (dev mode).
 * Handles special keys like durationMs, truncates long strings.
 */
function formatData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return '';

  const parts: string[] = [];
  for (const [key, value] of entries) {
    // Auto-format duration keys
    if ((key === 'durationMs' || key === 'totalDurationMs' || key.endsWith('Ms')) && typeof value === 'number') {
      parts.push(`${DIM}${key}=${RESET}${formatDuration(value)}`);
      continue;
    }
    if (value instanceof Error) {
      parts.push(`${DIM}${key}=${RESET}${value.message}`);
      continue;
    }
    if (typeof value === 'string' && value.length > 80) {
      parts.push(`${DIM}${key}=${RESET}${value.substring(0, 77)}...`);
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      try {
        const json = JSON.stringify(value);
        if (json.length > 100) {
          parts.push(`${DIM}${key}=${RESET}${json.substring(0, 97)}...`);
        } else {
          parts.push(`${DIM}${key}=${RESET}${json}`);
        }
      } catch {
        parts.push(`${DIM}${key}=${RESET}[Object]`);
      }
      continue;
    }
    parts.push(`${DIM}${key}=${RESET}${String(value)}`);
  }

  return '  ' + parts.join(' ');
}

/**
 * Serialize data for structured JSON output (prod mode).
 * Converts Error instances to plain strings, passes everything else through.
 */
function serializeData(data: unknown): unknown {
  if (data instanceof Error) return { message: data.message, stack: data.stack };
  return data;
}

/**
 * Emit a structured JSON log line (prod mode).
 */
function emitJsonLine(level: Level, domain: string, message: string, data?: unknown): void {
  const line: Record<string, unknown> = {
    level,
    domain,
    message,
    timestamp: new Date().toISOString(),
  };
  if (data !== undefined && data !== null) {
    line.data = serializeData(data);
  }
  const str = JSON.stringify(line);
  if (level === 'error') {
    console.error(str);
  } else if (level === 'warn') {
    console.warn(str);
  } else {
    console.log(str);
  }
}

interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  success(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: unknown): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

interface LoggerContext {
  requestId?: string;
}

/**
 * Create a rich, color-coded logger for a specific domain.
 *
 * ```ts
 * const log = createLogger('feed');
 * log.info('Fetching items', { userId, offset, limit });
 * log.success('Done', { count: 20 });
 * log.error('Failed', error);
 *
 * // With request ID context:
 * const log = createLogger('feed', { requestId: 'abc-123' });
 * ```
 */
export function createLogger(domain: string, context?: LoggerContext): Logger {
  const key = domain.toLowerCase().replace(/[_\s]+/g, '-');
  const config = DOMAINS[key] || { icon: '\u2738', color: 'white' as Color };
  const { icon, color } = config;
  const tag = domain.toUpperCase().replace(/[-_]+/g, ' ');
  const colorCode = FG[color];
  const reqId = context?.requestId;
  const prefix = reqId
    ? `${icon} ${colorCode}${BOLD}${tag}${RESET} ${DIM}[${reqId}]${RESET}`
    : `${icon} ${colorCode}${BOLD}${tag}${RESET}`;

  function mergeRequestId(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!reqId) return data;
    return { requestId: reqId, ...data };
  }

  return {
    info(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('info')) return;
      if (isDev) {
        console.log(`${prefix}  ${message}${formatData(data)}`);
      } else {
        emitJsonLine('info', tag, message, mergeRequestId(data));
      }
    },

    success(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('success')) return;
      if (isDev) {
        console.log(`${LEVEL_ICONS.success}${prefix}  ${FG.green}${message}${RESET}${formatData(data)}`);
      } else {
        emitJsonLine('success', tag, message, mergeRequestId(data));
      }
    },

    warn(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('warn')) return;
      if (isDev) {
        console.warn(`${LEVEL_ICONS.warn}${prefix}  ${FG.yellow}${message}${RESET}${formatData(data)}`);
      } else {
        emitJsonLine('warn', tag, message, mergeRequestId(data));
      }
    },

    error(message: string, data?: unknown) {
      // Errors always log regardless of level
      if (isDev) {
        const errorStr = data instanceof Error
          ? `  ${data.message}`
          : data && typeof data === 'object'
            ? formatData(data)
            : data
              ? `  ${String(data)}`
              : '';
        console.error(`${LEVEL_ICONS.error}${prefix}  ${FG.red}${message}${RESET}${errorStr}`);
      } else {
        const merged = reqId
          ? (data && typeof data === 'object' && !(data instanceof Error)
            ? { requestId: reqId, ...(data as Record<string, unknown>) }
            : data instanceof Error
              ? { requestId: reqId, message: data.message, stack: data.stack }
              : { requestId: reqId, value: data })
          : data;
        emitJsonLine('error', tag, message, merged);
      }
    },

    debug(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('debug')) return;
      if (isDev) {
        console.log(`${DIM}${icon} ${tag}  ${message}${formatData(data)}${RESET}`);
      } else {
        emitJsonLine('debug', tag, message, mergeRequestId(data));
      }
    },
  };
}
