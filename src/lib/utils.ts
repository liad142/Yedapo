import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip HTML tags and decode common HTML entities from a string */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')          // strip actual HTML tags
    .replace(/&lt;/g, '<')            // decode entities first...
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')          // ...then strip any tags that were encoded
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim();
}
