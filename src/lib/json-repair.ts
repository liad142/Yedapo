/**
 * Shared JSON repair utility.
 * Fixes common issues in LLM-generated JSON (trailing commas, unescaped control chars).
 */
export function repairJsonString(text: string): string {
  let result = text;

  // 1. Remove trailing commas before } or ] (with optional whitespace)
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // 2. Fix unescaped control characters inside JSON strings.
  //    Walk through the string tracking whether we're inside a JSON string value,
  //    and escape raw newlines/tabs that appear inside.
  const chars: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < result.length; i++) {
    const ch = result[i];

    if (escaped) {
      chars.push(ch);
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      chars.push(ch);
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      chars.push(ch);
      continue;
    }

    // If inside a string, escape raw control characters
    if (inString) {
      if (ch === '\n') {
        chars.push('\\n');
        continue;
      }
      if (ch === '\r') {
        chars.push('\\r');
        continue;
      }
      if (ch === '\t') {
        chars.push('\\t');
        continue;
      }
    }

    chars.push(ch);
  }

  return chars.join('');
}
