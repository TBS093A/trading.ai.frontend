// Formatting shared by the trading dashboard
export const dash = '–';

export const money = (v, cur = 'USDT', digits = 2) => (v == null ? dash
  : `${Number(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${cur}`);

export const signedMoney = (v, cur = 'USDT') => (v == null ? dash
  : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`);

export const pctSigned = (v, d = 2) => (v == null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`);
export const pct = (v, d = 1) => (v == null ? dash : `${Number(v).toFixed(d)}%`);
export const prob = (v, d = 1) => (v == null ? dash : `${(v * 100).toFixed(d)}%`);
export const rFmt = (v, d = 2) => (v == null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}R`);
export const price = (v) => (v == null ? dash : Number(v).toPrecision(6));
export const dateTime = (ms) => (ms ? new Date(ms).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : dash);
export const tone = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

// Polish plural: 1 zmiana, 2-4 zmiany (except 12-14), 5+ zmian
export const plural = (n, one, few, many) => {
  if (n === 1) return `${n} ${one}`;
  const d = n % 10;
  const dd = n % 100;
  return `${n} ${d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many}`;
};

// Higher-timeframe trend of a signal event (data_json.htf_trend): with / against the trade, or unknown
export const HTF_TREND = {
  with: { label: 'z trendem HTF', title: 'Kierunek transakcji zgodny z trendem wyższego interwału' },
  against: { label: 'pod trend HTF', title: 'Kierunek transakcji przeciwny do trendu wyższego interwału' },
};
export const htfTrendOf = (e) => (e?.data_json?.htf_trend ?? e?.data?.htf_trend ?? e?.htf_trend) || null;

export const EVENT_LABELS = {
  account_created: 'Konto utworzone', account_updated: 'Zmiana ustawień', signal_armed: 'Sygnał uzbrojony',
  signal_rejected: 'Sygnał odrzucony', entry_filled: 'Wejście wypełnione', entry_cancelled: 'Wejście anulowane',
  position_closed: 'Pozycja zamknięta', kill_switch: 'Kill switch włączony', kill_switch_off: 'Kill switch wyłączony',
  error: 'Błąd',
};
