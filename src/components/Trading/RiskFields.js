import React from 'react';

const decimals = (step) => {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
};

// type "select": a dropdown of {value, label, description} options; the chosen option's
// description is shown under it, the field description stays as the general explanation
const SelectField = ({ f, value, onChange, changed, disabled }) => {
  const options = f.options || [];
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div className={`risk-field risk-field-select ${changed ? 'changed' : ''}`}>
      <div className="risk-field-head">
        <label className="risk-field-label" htmlFor={`risk-${f.key}`}>{f.label}</label>
        <select
          id={`risk-${f.key}`}
          className="input select risk-select"
          value={current?.value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
        </select>
      </div>
      {current?.description && <p className="risk-option-desc">{current.description}</p>}
      {f.description && <p className="risk-field-desc">{f.description}</p>}
    </div>
  );
};

/**
 * Risk settings form built from GET /trading/risk/fields: every numeric field with a slider, an
 * exact number input and its description; nullable fields get a "no filter" switch; "select"
 * fields render as a dropdown.
 */
const RiskFields = ({ fields, values, onChange, baseline = null, disabled = false }) => (
  <div className="risk-fields">
    {fields.map((f) => {
      const value = values[f.key];
      if (f.type === 'select') {
        return (
          <SelectField
            key={f.key}
            f={f}
            value={value}
            changed={!!baseline && baseline[f.key] !== undefined && baseline[f.key] !== value}
            disabled={disabled}
            onChange={(v) => onChange({ ...values, [f.key]: v })}
          />
        );
      }
      const off = f.nullable && value == null;
      const shown = off ? (baseline?.[f.key] ?? f.min) : value;
      const changed = baseline && baseline[f.key] !== value;
      const set = (v) => {
        if (v === '' || v == null || Number.isNaN(Number(v))) return;
        const n = Math.min(f.max, Math.max(f.min, Number(Number(v).toFixed(decimals(f.step)))));
        onChange({ ...values, [f.key]: n });
      };
      return (
        <div key={f.key} className={`risk-field ${off ? 'off' : ''} ${changed ? 'changed' : ''}`}>
          <div className="risk-field-head">
            <label className="risk-field-label" htmlFor={`risk-${f.key}`}>{f.label}</label>
            {f.nullable && (
              <label className="risk-null-toggle" title="Wyłącz ten filtr">
                <input
                  type="checkbox"
                  checked={off}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...values, [f.key]: e.target.checked ? null : (baseline?.[f.key] ?? f.min) })}
                />
                bez filtra
              </label>
            )}
            <input
              id={`risk-${f.key}`}
              className="input risk-number"
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={off ? '' : shown}
              placeholder={off ? 'brak' : undefined}
              disabled={disabled || off}
              onChange={(e) => set(e.target.value)}
            />
          </div>
          <input
            type="range"
            className="risk-slider"
            min={f.min}
            max={f.max}
            step={f.step}
            value={shown ?? f.min}
            disabled={disabled || off}
            onChange={(e) => set(e.target.value)}
            aria-label={f.label}
          />
          <div className="risk-scale"><span>{f.min}</span><span>{f.max}</span></div>
          <p className="risk-field-desc">{f.description}</p>
        </div>
      );
    })}
  </div>
);

export default RiskFields;
