/**
 * Obsidian integration helpers.
 *
 * Uses the `obsidian://` URI scheme to create a new note in the user's
 * default (or named) vault. The Advanced URI plugin is not required —
 * the built-in `obsidian://new` action is supported out of the box.
 *
 * @see https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
 */

export interface BuildObsidianUriOptions {
  /** Optional vault name. If omitted, Obsidian uses the last-opened vault. */
  vault?: string;
  /** File name including extension, e.g. "My Episode.md". */
  fileName: string;
  /** Markdown content of the note. */
  content: string;
}

/**
 * Build an `obsidian://new` URI that creates a new note with the given
 * filename and markdown content. Safe to assign to `window.location.href`
 * or open in a new tab — the browser hands it off to Obsidian.
 */
export function buildObsidianUri(opts: BuildObsidianUriOptions): string {
  // Build URI manually with encodeURIComponent — URLSearchParams encodes
  // spaces as "+" (form-urlencoded) which Obsidian renders literally.
  // We need RFC 3986 percent-encoding (%20 for space).
  const parts: string[] = [];
  if (opts.vault) parts.push(`vault=${encodeURIComponent(opts.vault)}`);
  parts.push(`file=${encodeURIComponent(opts.fileName)}`);
  parts.push(`content=${encodeURIComponent(opts.content)}`);
  return `obsidian://new?${parts.join('&')}`;
}

/**
 * Sanitize a string for use as an Obsidian filename.
 * Obsidian (and most file systems) disallow: \ / : * ? " < > |
 * We also trim whitespace and collapse consecutive spaces.
 */
export function sanitizeObsidianFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200); // keep path lengths reasonable on Windows
}
