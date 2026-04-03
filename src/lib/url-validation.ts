/**
 * Shared URL validation with SSRF protection.
 * Extracted from /api/podcasts/add to be reused by rss.ts, apple-podcasts.ts, etc.
 */

import dns from 'dns/promises';
import net from 'net';

// Block SSRF: reject private/reserved IP ranges
const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/0\./,
  /^https?:\/\/localhost/i,
  /^https?:\/\/\[::1\]/,
];

/**
 * Check if an IP address falls within private/reserved ranges.
 */
export function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
  }
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80') || /^::ffff:/.test(normalized);
}

/**
 * Validate that a URL uses https (or http) and does not target private IP ranges.
 * Does NOT perform DNS resolution — use validateResolvedIP for that.
 */
export function isValidFetchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;
    if (PRIVATE_IP_PATTERNS.some(p => p.test(url))) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the hostname in a URL and verify the resulting IP is not private.
 * Returns true if safe to fetch, false if it resolves to a private address.
 */
export async function validateResolvedIP(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (net.isIPv4(hostname) || net.isIPv6(hostname)) return !isPrivateIP(hostname);
    const { address } = await dns.lookup(hostname);
    return !isPrivateIP(address);
  } catch {
    return false;
  }
}

/**
 * Full SSRF validation: scheme check + pattern check + DNS resolution.
 * Throws an error if the URL is unsafe.
 */
export async function assertSafeUrl(url: string): Promise<void> {
  if (!isValidFetchUrl(url)) {
    throw new Error(`Unsafe URL blocked: invalid scheme or private address pattern in ${url}`);
  }
  const dnsClean = await validateResolvedIP(url);
  if (!dnsClean) {
    throw new Error(`Unsafe URL blocked: ${url} resolves to a private address`);
  }
}
