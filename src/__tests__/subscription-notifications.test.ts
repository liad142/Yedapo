/**
 * Integration tests for the Subscription Notifications & Auto-Summary system.
 * These tests run against the live dev server (localhost:3000).
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret-local';

async function fetchApi(path: string, options?: RequestInit) {
  const url = `${BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

describe('Notification Count Endpoint', () => {
  it('GET /api/notifications/in-app/count returns unreadCount: 0 for unauthenticated users', async () => {
    const res = await fetchApi('/api/notifications/in-app/count');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('unreadCount', 0);
  });
});

describe('Notification List Endpoint', () => {
  it('GET /api/notifications/in-app returns 401 for unauthenticated users', async () => {
    const res = await fetchApi('/api/notifications/in-app');
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });
});

describe('Cron Endpoint Auth', () => {
  it('GET /api/cron/check-new-episodes returns 401 without Bearer token', async () => {
    const res = await fetchApi('/api/cron/check-new-episodes');
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error', 'Unauthorized');
  });

  it('GET /api/cron/check-new-episodes returns 401 with wrong token', async () => {
    const res = await fetchApi('/api/cron/check-new-episodes', {
      headers: { Authorization: 'Bearer wrong-secret-token' },
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error', 'Unauthorized');
  });

  it('GET /api/cron/check-new-episodes returns 200 with correct CRON_SECRET', async () => {
    const res = await fetchApi('/api/cron/check-new-episodes', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // Verify response shape
    expect(data).toHaveProperty('podcasts');
    expect(data).toHaveProperty('youtube');
    expect(data).toHaveProperty('totalSourcesChecked');
    expect(data).toHaveProperty('totalNewEpisodes');
    expect(data).toHaveProperty('totalNotifications');
    expect(data).toHaveProperty('totalSummariesQueued');
    // Each sub-result should have the correct shape
    expect(data.podcasts).toHaveProperty('sourcesChecked');
    expect(data.podcasts).toHaveProperty('newEpisodesFound');
    expect(data.podcasts).toHaveProperty('notificationsCreated');
    expect(data.podcasts).toHaveProperty('summariesQueued');
  });
});

describe('Subscription PATCH Endpoint', () => {
  // This test verifies the endpoint accepts the notification fields.
  // Without auth, it should return 401.
  it('PATCH /api/subscriptions/[id] returns 401 for unauthenticated users', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetchApi(`/api/subscriptions/${fakeId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        notifyEnabled: true,
        notifyChannels: ['in_app'],
        updateLastViewed: false,
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Notification PATCH Endpoint', () => {
  it('PATCH /api/notifications/in-app with markAllRead returns 401 for unauthenticated', async () => {
    const res = await fetchApi('/api/notifications/in-app', {
      method: 'PATCH',
      body: JSON.stringify({ markAllRead: true }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/notifications/in-app with empty ids returns 401 for unauthenticated', async () => {
    const res = await fetchApi('/api/notifications/in-app', {
      method: 'PATCH',
      body: JSON.stringify({ ids: [] }),
    });
    // Unauthenticated gets 401 before body validation
    expect(res.status).toBe(401);
  });
});
