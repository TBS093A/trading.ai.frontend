import React from 'react';
import { setupStatusLabel, formatR } from '../../utils/setupMath';

/**
 * The tracked setup a pattern belongs to (pattern.setup from the API):
 * null | {id, pattern_type, x_time..c_time, status, entry_time, entry_price, sl, tp1, tp2,
 *         exit_time, r_multiple, created_time, prz_min, prz_max}
 */

const fmtPrice = (v) => (v == null ? '—' : Number(v).toPrecision(6));
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—');

export const SetupBadge = ({ setup }) => {
  if (!setup?.status) return null;
  return (
    <span className={`setup-status-chip ${setup.status}`} title="Status setupu z alertów">
      {setupStatusLabel(setup)}
    </span>
  );
};

export const SetupSection = ({ setup }) => {
  if (!setup) return null;
  const rows = [
    ['Status', <SetupBadge setup={setup} />],
    ['PRZ', `${fmtPrice(setup.prz_min)} – ${fmtPrice(setup.prz_max)}`],
    ['Wykryty', fmtTime(setup.created_time)],
    setup.entry_price != null && ['Wejście', `${fmtPrice(setup.entry_price)} · ${fmtTime(setup.entry_time)}`],
    setup.sl != null && ['SL', fmtPrice(setup.sl), 'neg'],
    setup.tp1 != null && ['TP1', fmtPrice(setup.tp1), 'pos'],
    setup.tp2 != null && ['TP2', fmtPrice(setup.tp2), 'pos'],
    setup.exit_time && ['Zamknięty', fmtTime(setup.exit_time)],
    setup.r_multiple != null && ['Wynik', formatR(setup.r_multiple, 2), setup.r_multiple > 0 ? 'pos' : setup.r_multiple < 0 ? 'neg' : ''],
  ].filter(Boolean);

  return (
    <div className="details-section setup-section">
      <div className="details-title">Setup z alertów</div>
      <dl className="setup-section-grid">
        {rows.map(([label, value, cls]) => (
          <React.Fragment key={label}>
            <dt className={cls || ''}>{label}</dt>
            <dd className={cls || ''}>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
};
