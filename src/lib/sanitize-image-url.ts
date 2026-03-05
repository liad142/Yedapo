/** Sanitize artwork URLs that may contain malformed data (e.g., wrapped in ["..."]) */
export function sanitizeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  let cleaned = url.trim();
  // Strip JSON array/quote wrapping: ["url"] or ['url']
  if (cleaned.startsWith('[')) {
    cleaned = cleaned.replace(/^\[["']?/, '').replace(/["']?\]$/, '');
  }
  // Must start with http:// or https://
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return null;
  }
  try {
    new URL(cleaned);
    return cleaned;
  } catch {
    return null;
  }
}
