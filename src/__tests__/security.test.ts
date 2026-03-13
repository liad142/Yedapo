import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing modules under test
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      upsert: vi.fn(() => ({ data: null, error: null })),
    })),
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAuthServerClient: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(() => null),
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({
    incr: vi.fn(() => 1),
    expire: vi.fn(),
    get: vi.fn(() => null),
    set: vi.fn(() => 'OK'),
    del: vi.fn(),
    ping: vi.fn(),
    pipeline: vi.fn(() => ({
      incr: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(() => [1, true]),
    })),
  })),
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.resetModules();
    // Set required env vars
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('checkRateLimit returns true when under limit', async () => {
    const { checkRateLimit } = await import('@/lib/cache');
    const result = await checkRateLimit('test-user', 5, 60);
    expect(result).toBe(true);
  });

  it('checkRateLimit fails open when Redis is down', async () => {
    // Mock Redis to throw
    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(() => ({
        pipeline: vi.fn(() => ({
          incr: vi.fn(),
          expire: vi.fn(),
          exec: vi.fn(() => { throw new Error('Connection refused'); }),
        })),
      })),
    }));

    const { checkRateLimit } = await import('@/lib/cache');
    const result = await checkRateLimit('test-user', 5, 60);
    // Rate limiting fails open — don't block users when Redis is down
    expect(result).toBe(true);
  });
});

describe('Quota System', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('checkQuota fails closed when Redis is down', async () => {
    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(() => ({
        get: vi.fn(() => { throw new Error('Connection refused'); }),
      })),
    }));

    const { checkQuota } = await import('@/lib/cache');
    const result = await checkQuota('user-123', 'summary', 5);
    expect(result.allowed).toBe(false);
  });
});

describe('Distributed Locking', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('acquireLock returns true on success', async () => {
    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(() => ({
        set: vi.fn(() => 'OK'),
      })),
    }));

    const { acquireLock } = await import('@/lib/cache');
    const result = await acquireLock('test-lock', 60);
    expect(result).toBe(true);
  });

  it('acquireLock returns false when lock already held', async () => {
    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(() => ({
        set: vi.fn(() => null), // NX returns null when key exists
      })),
    }));

    const { acquireLock } = await import('@/lib/cache');
    const result = await acquireLock('test-lock', 60);
    expect(result).toBe(false);
  });
});
