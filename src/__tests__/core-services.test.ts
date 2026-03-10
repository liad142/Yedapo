import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('JSON Repair', () => {
  it('handles trailing commas', async () => {
    const { repairJsonString } = await import('@/lib/json-repair');
    const result = repairJsonString('{"a": 1, "b": 2,}');
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ a: 1, b: 2 });
  });

  it('handles control characters in strings', async () => {
    const { repairJsonString } = await import('@/lib/json-repair');
    // Raw newline inside a JSON string value should be escaped
    const input = '{"text": "hello\nworld"}';
    const result = repairJsonString(input);
    const parsed = JSON.parse(result);
    expect(parsed.text).toBe('hello\nworld');
  });

  it('handles trailing comma in arrays', async () => {
    const { repairJsonString } = await import('@/lib/json-repair');
    const input = '{"arr": [1, 2, 3,]}';
    const result = repairJsonString(input);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ arr: [1, 2, 3] });
  });
});

describe('Logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('respects LOG_LEVEL in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'error');

    // Reset module to pick up new env
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('test');

    // Spy on console methods
    const consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    log.info('should not appear');
    expect(consoleSpy.log).not.toHaveBeenCalled();

    log.error('should appear');
    expect(consoleSpy.error).toHaveBeenCalled();

    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    vi.unstubAllEnvs();
  });
});
