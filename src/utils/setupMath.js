/**
 * Helpers for live setup numbers shown in the sidebar.
 * Prices and candles are the normalized chart klines ({open_time, open, high, low, close, volume}).
 */

// Average True Range (Wilder smoothing) of the last candles; null when there aren't enough
export const atr = (klines, period = 14) => {
  if (!Array.isArray(klines) || klines.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < klines.length; i++) {
    const { high, low } = klines[i];
    const prevClose = klines[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let value = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) value = (value * (period - 1) + trs[i]) / period;
  return value;
};

// The PRZ edge price meets first: a bullish setup waits for price to come down to prz_max,
// a bearish one for price to come up to prz_min
export const nearPrzEdge = (setup) => (setup.is_bullish ? setup.prz_max : setup.prz_min);

/**
 * How far price still has to travel to the near PRZ edge.
 * Positive = still away from the zone, negative = already past the edge (inside / through it).
 */
export const distanceToPrz = (setup, price, atrValue = null) => {
  const edge = nearPrzEdge(setup);
  if (edge == null || price == null || !(price > 0)) return null;
  const move = setup.is_bullish ? price - edge : edge - price;
  return {
    edge,
    pct: (move / price) * 100,
    atr: atrValue > 0 ? move / atrValue : null,
  };
};

// Unrealised result of an open setup in R (risk = |entry - SL|), signed by direction
export const currentR = (setup, price) => {
  const { entry_price: entry, sl } = setup;
  if (entry == null || sl == null || price == null) return null;
  const risk = Math.abs(entry - sl);
  if (!(risk > 0)) return null;
  const dir = setup.is_bullish ? 1 : -1;
  return (dir * (price - entry)) / risk;
};

export const formatR = (r, digits = 1) => {
  if (r == null) return '';
  const v = Number(r).toFixed(digits);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${v.replace('-', '')}R`;
};

// Badge text for a setup status, e.g. "WIN +1.6R", "LOSS −1.0R", "NO ENTRY"
export const setupStatusLabel = (setup) => {
  if (!setup?.status) return '';
  const name = setup.status.replace('_', ' ').toUpperCase();
  if (['win', 'loss', 'expired'].includes(setup.status) && setup.r_multiple != null) {
    return `${name} ${formatR(setup.r_multiple)}`;
  }
  return name;
};
