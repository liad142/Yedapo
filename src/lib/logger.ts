const isDev = process.env.NODE_ENV === 'development';

// ANSI color codes
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
 * Format structured data as key=value pairs.
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

interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  success(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: unknown): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

/**
 * Create a rich, color-coded logger for a specific domain.
 *
 * ```ts
 * const log = createLogger('feed');
 * log.info('Fetching items', { userId, offset, limit });
 * log.success('Done', { count: 20 });
 * log.error('Failed', error);
 * ```
 */
export function createLogger(domain: string): Logger {
  const key = domain.toLowerCase().replace(/[_\s]+/g, '-');
  const config = DOMAINS[key] || { icon: '\u2738', color: 'white' as Color };
  const { icon, color } = config;
  const tag = domain.toUpperCase().replace(/[-_]+/g, ' ');
  const colorCode = FG[color];
  const prefix = `${icon} ${colorCode}${BOLD}${tag}${RESET}`;

  return {
    info(message: string, data?: Record<string, unknown>) {
      if (!isDev) return;
      console.log(`${prefix}  ${message}${formatData(data)}`);
    },

    success(message: string, data?: Record<string, unknown>) {
      if (!isDev) return;
      console.log(`${LEVEL_ICONS.success}${prefix}  ${FG.green}${message}${RESET}${formatData(data)}`);
    },

    warn(message: string, data?: Record<string, unknown>) {
      if (!isDev) return;
      console.warn(`${LEVEL_ICONS.warn}${prefix}  ${FG.yellow}${message}${RESET}${formatData(data)}`);
    },

    error(message: string, data?: unknown) {
      // Errors always log (even in production)
      const errorStr = data instanceof Error
        ? `  ${data.message}`
        : data && typeof data === 'object'
          ? formatData(data)
          : data
            ? `  ${String(data)}`
            : '';
      console.error(`${LEVEL_ICONS.error}${prefix}  ${FG.red}${message}${RESET}${errorStr}`);
    },

    debug(message: string, data?: Record<string, unknown>) {
      if (!isDev) return;
      console.log(`${DIM}${icon} ${tag}  ${message}${formatData(data)}${RESET}`);
    },
  };
}
