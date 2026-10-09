import React from 'react';

export const EMPTY_FILTERS = { asset_ids: [], intervals: [], patterns: [], direction: '' };

// Account filters_json -> form value (missing = no filter)
export const filtersToForm = (f = {}) => ({
  asset_ids: f.asset_ids || [],
  intervals: f.intervals || [],
  patterns: f.patterns || [],
  direction: f.direction || '',
});

// Form value -> API body: empty lists / "both" directions are left out (= no filter)
export const formToFilters = (v) => Object.fromEntries(Object.entries({
  asset_ids: v.asset_ids.length ? v.asset_ids : null,
  intervals: v.intervals.length ? v.intervals : null,
  patterns: v.patterns.length ? v.patterns : null,
  direction: v.direction || null,
}).filter(([, x]) => x != null));

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const ENTRY_LABELS = { touch: 'Dotknięcie PRZ', confirm: 'Potwierdzenie' };

/**
 * What an account trades: tracked assets (with their setup intervals), intervals, patterns,
 * direction and the entry mode. Empty selection = no filter. Shared by the wizard and the
 * account settings.
 */
const AccountFilters = ({
  value, onChange, options, entryMode, onEntryModeChange, entryModeOptions = [], suggestion = null, disabled = false,
}) => {
  const set = (patch) => onChange({ ...value, ...patch });
  const noneLabel = (n, all) => (n ? `wybrane: ${n}` : all);

  return (
    <div className="account-filters">
      <fieldset className="af-group" disabled={disabled}>
        <legend className="stats-label">Assety ({noneLabel(value.asset_ids.length, 'wszystkie śledzone')})</legend>
        {options.assets.length === 0 ? (
          <span className="stats-muted">Brak śledzonych assetów - dodaj je w „Alerty i śledzone assety” → Tracked assets.</span>
        ) : (
          <div className="af-assets">
            {options.assets.map((a) => (
              <label key={a.asset_id} className={`af-asset ${value.asset_ids.includes(a.asset_id) ? 'active' : ''}`}>
                <input type="checkbox" checked={value.asset_ids.includes(a.asset_id)}
                  onChange={() => set({ asset_ids: toggle(value.asset_ids, a.asset_id) })} />
                <span className="af-asset-symbol">{a.symbol}</span>
                <span className="af-asset-ivs">{(a.intervals || []).join(' · ') || 'brak interwałów'}</span>
              </label>
            ))}
          </div>
        )}
        {value.asset_ids.length > 0 && (
          <button type="button" className="link-btn" onClick={() => set({ asset_ids: [] })}>wyczyść (wszystkie)</button>
        )}
      </fieldset>

      <fieldset className="af-group" disabled={disabled}>
        <legend className="stats-label">Interwały ({noneLabel(value.intervals.length, 'wszystkie')})</legend>
        <div className="af-checks">
          {options.intervals.map((iv) => (
            <label key={iv} className="af-check">
              <input type="checkbox" checked={value.intervals.includes(iv)} onChange={() => set({ intervals: toggle(value.intervals, iv) })} />
              {iv}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="af-group" disabled={disabled}>
        <legend className="stats-label">Formacje ({noneLabel(value.patterns.length, 'wszystkie')})</legend>
        <div className="af-checks">
          {options.patterns.map((pt) => (
            <label key={pt} className="af-check">
              <input type="checkbox" checked={value.patterns.includes(pt)} onChange={() => set({ patterns: toggle(value.patterns, pt) })} />
              {pt}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="af-group" disabled={disabled}>
        <legend className="stats-label">Kierunek</legend>
        <div className="segmented af-direction" role="radiogroup">
          {[['', 'Oba'], ...options.directions.map((d) => [d, d === 'long' ? 'Tylko long' : d === 'short' ? 'Tylko short' : d])].map(([v, l]) => (
            <button key={l} type="button" role="radio" aria-checked={value.direction === v}
              className={`segment ${value.direction === v ? 'active' : ''}`} onClick={() => set({ direction: v })}>{l}</button>
          ))}
        </div>
      </fieldset>

      {onEntryModeChange && (
        <fieldset className="af-group" disabled={disabled}>
          <legend className="stats-label">Tryb wejścia</legend>
          <div className="af-modes">
            {entryModeOptions.map((m) => (
              <label key={m.key} className={`af-mode ${entryMode === m.key ? 'active' : ''}`}>
                <input type="radio" name="entry_mode" checked={entryMode === m.key} onChange={() => onEntryModeChange(m.key)} />
                <span className="af-mode-text">
                  <strong>{ENTRY_LABELS[m.key] || m.key}</strong>
                  {m.description && <span>{m.description}</span>}
                </span>
              </label>
            ))}
          </div>
          {suggestion}
        </fieldset>
      )}
    </div>
  );
};

export default AccountFilters;
