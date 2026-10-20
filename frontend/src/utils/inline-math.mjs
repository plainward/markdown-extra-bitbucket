/**
 * Inline math in rendered text: $$...$$ (display) and $...$ (inline).
 * Like Pandoc, the opening $ must not be followed by a space and the closing $
 * must not follow a space or precede a digit, so prices such as "$5 and $10"
 * stay text.
 */
const INLINE_MATH = /\$\$[^$]+\$\$|\$(?=[^\s$])[^$\n]*?[^\s$]\$(?!\d)/g;

export function hasInlineMath(text) {
  INLINE_MATH.lastIndex = 0;
  return INLINE_MATH.test(text);
}

/** Splits text into [{ text }] and [{ math, display }] parts, in order. */
export function splitInlineMath(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_MATH)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    const display = m[0].startsWith('$$');
    parts.push({ math: display ? m[0].slice(2, -2) : m[0].slice(1, -1), display });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
