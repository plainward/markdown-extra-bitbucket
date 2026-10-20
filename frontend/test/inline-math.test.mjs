import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasInlineMath, splitInlineMath } from '../src/utils/inline-math.mjs';

const maths = (text) => splitInlineMath(text).filter((p) => 'math' in p);

test('prices are not math', () => {
  for (const t of ['Plans cost $5 and $10 per month.', 'It costs $5.', 'From $5 to $10, or $20', 'Pay $ 5 now $']) {
    assert.equal(hasInlineMath(t), false, t);
    assert.deepEqual(maths(t), [], t);
  }
});

test('inline and display math are found', () => {
  assert.deepEqual(maths('Area $a^2 + b^2$ here'), [{ math: 'a^2 + b^2', display: false }]);
  assert.deepEqual(maths('Let $x$ be'), [{ math: 'x', display: false }]);
  assert.deepEqual(maths('So $$E=mc^2$$.'), [{ math: 'E=mc^2', display: true }]);
});

test('text around math is kept in order', () => {
  assert.deepEqual(splitInlineMath('a $x$ b $$y$$ c'), [
    { text: 'a ' }, { math: 'x', display: false }, { text: ' b ' }, { math: 'y', display: true }, { text: ' c' },
  ]);
});
