/**
 * Shared JSON repair utility.
 * Fixes common issues in LLM-generated JSON:
 * - Trailing commas
 * - Unescaped control characters (newlines, tabs)
 * - Unescaped double quotes inside string values (e.g. Hebrew תנ"ך)
 */
export function repairJsonString(text: string): string {
  let result = text;

  // 1. Remove trailing commas before } or ] (with optional whitespace)
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // 2. Fix unescaped control characters and embedded quotes inside JSON strings.
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
      if (!inString) {
        // Opening a string
        inString = true;
        chars.push(ch);
      } else {
        // Could be closing the string OR an unescaped embedded quote.
        // Look ahead: if the next non-whitespace char is a valid JSON
        // structural character after a string value (, : } ]), it's a real close.
        // Otherwise it's an embedded quote that needs escaping.
        const nextSignificant = peekNextNonWhitespace(result, i + 1);
        if (nextSignificant === ',' || nextSignificant === ':' ||
            nextSignificant === '}' || nextSignificant === ']' ||
            nextSignificant === null) {
          // Real string terminator
          inString = false;
          chars.push(ch);
        } else {
          // Embedded quote — escape it
          chars.push('\\"');
        }
      }
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

/** Return the next non-whitespace character, or null if end of string. */
function peekNextNonWhitespace(text: string, from: number): string | null {
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') {
      return ch;
    }
  }
  return null;
}
