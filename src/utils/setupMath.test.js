import { atr, nearPrzEdge, distanceToPrz, currentR, formatR, setupStatusLabel } from './setupMath';

const k = (high, low, close) => ({ high, low, close });

test('ATR uses the true range and Wilder smoothing', () => {
  // constant 10-wide candles, no gaps -> ATR 10
  const flat = Array.from({ length: 20 }, () => k(110, 100, 105));
  expect(atr(flat)).toBeCloseTo(10, 6);
  // a gap counts: prev close 105, next high 130 / low 120 -> TR 25
  const gap = [...flat.slice(0, 15), k(130, 120, 125)];
  expect(atr(gap)).toBeCloseTo((10 * 13 + 25) / 14, 6);
  expect(atr(flat.slice(0, 10))).toBeNull();
});

test('near PRZ edge depends on direction', () => {
  expect(nearPrzEdge({ is_bullish: true, prz_min: 90, prz_max: 95 })).toBe(95);
  expect(nearPrzEdge({ is_bullish: false, prz_min: 105, prz_max: 110 })).toBe(105);
});

test('distance to PRZ in % and ATR, positive while still away', () => {
  const bull = { is_bullish: true, prz_min: 90, prz_max: 95 };
  expect(distanceToPrz(bull, 100, 2.5)).toEqual({ edge: 95, pct: 5, atr: 2 });
  const bear = { is_bullish: false, prz_min: 105, prz_max: 110 };
  const d = distanceToPrz(bear, 100, null);
  expect(d.pct).toBeCloseTo(5, 6);
  expect(d.atr).toBeNull();
  // already through the edge -> negative
  expect(distanceToPrz(bull, 94, 1).pct).toBeLessThan(0);
});

test('current R is signed by direction', () => {
  expect(currentR({ is_bullish: true, entry_price: 100, sl: 95 }, 110)).toBeCloseTo(2, 6);
  expect(currentR({ is_bullish: false, entry_price: 100, sl: 105 }, 110)).toBeCloseTo(-2, 6);
  expect(currentR({ is_bullish: true, entry_price: 100, sl: 100 }, 110)).toBeNull();
  expect(currentR({ is_bullish: true, entry_price: null, sl: 95 }, 110)).toBeNull();
});

test('status labels', () => {
  expect(formatR(1.6)).toBe('+1.6R');
  expect(formatR(-1)).toBe('−1.0R');
  expect(setupStatusLabel({ status: 'win', r_multiple: 1.6 })).toBe('WIN +1.6R');
  expect(setupStatusLabel({ status: 'loss', r_multiple: -1 })).toBe('LOSS −1.0R');
  expect(setupStatusLabel({ status: 'no_entry' })).toBe('NO ENTRY');
  expect(setupStatusLabel({ status: 'waiting' })).toBe('WAITING');
  expect(setupStatusLabel(null)).toBe('');
});
