import React, { useEffect, useState } from 'react';
import { riskAmount, feeInR } from '../../utils/tradeMath';

const SETTINGS_KEY = 'stats.calculator';

export const DEFAULT_CALCULATOR = {
  capital: 1000,
  riskPct: 1,
  feePct: 0.1,
  stopDistancePct: 1.5,
  horizon: 100,
};

const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return stored && typeof stored === 'object' ? { ...DEFAULT_CALCULATOR, ...stored } : DEFAULT_CALCULATOR;
  } catch {
    return DEFAULT_CALCULATOR;
  }
};

// Calculator inputs, remembered per browser
export const useCalculatorSettings = () => {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable - settings just won't be remembered
    }
  }, [settings]);
  return [settings, setSettings];
};

const Field = ({ label, hint, suffix, value, onChange, step = 'any', min = 0 }) => (
  <label className="calc-field" title={hint}>
    <span className="stats-label">{label}</span>
    <span className="calc-input">
      <input
        className="input"
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {suffix && <span className="calc-suffix">{suffix}</span>}
    </span>
  </label>
);

const fmtUsd = (v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} $`;

const TradeCalculator = ({ settings, onChange }) => {
  const set = (key) => (value) => onChange({ ...settings, [key]: value === '' ? '' : Math.max(0, value) });
  const capital = Number(settings.capital) || 0;
  const riskPct = Number(settings.riskPct) || 0;
  const risk = riskAmount(capital, riskPct);
  const fee = feeInR(Number(settings.feePct) || 0, Number(settings.stopDistancePct) || 0);
  const notional = Number(settings.stopDistancePct) > 0 ? risk / (Number(settings.stopDistancePct) / 100) : null;

  return (
    <section className="calc">
      <div className="calc-head">
        <h3 className="calc-title">Kalkulator</h3>
        <span className="stats-muted">
          Przelicza statystyki na pieniądze: dodaje do tabeli wynik netto po prowizjach i typową serię strat.
        </span>
      </div>
      <div className="calc-fields">
        <Field label="Kapitał" suffix="$" value={settings.capital} onChange={set('capital')} step="100"
          hint="Kwota na koncie, od której liczysz ryzyko" />
        <Field label="Ryzyko / transakcję" suffix="%" value={settings.riskPct} onChange={set('riskPct')} step="0.1"
          hint="Ile % kapitału tracisz, gdy zadziała SL (to jest 1R)" />
        <Field label="Prowizja / stronę" suffix="%" value={settings.feePct} onChange={set('feePct')} step="0.01"
          hint="Prowizja giełdy za wejście i osobno za wyjście (np. 0.1% na Binance spot)" />
        <Field label="Typowy SL od wejścia" suffix="%" value={settings.stopDistancePct} onChange={set('stopDistancePct')} step="0.1"
          hint="Średnia odległość SL od ceny wejścia. Im bliżej SL, tym większa pozycja i tym więcej kosztują prowizje w R." />
        <Field label="Horyzont" suffix="transakcji" value={settings.horizon} onChange={set('horizon')} step="10" min={1}
          hint="Dla ilu transakcji liczyć wynik i serię strat" />
      </div>
      <div className="calc-summary">
        <span>1R = <strong>{fmtUsd(risk)}</strong></span>
        {notional != null && <span>pozycja ≈ <strong>{fmtUsd(notional)}</strong></span>}
        {fee != null && <span>prowizje ≈ <strong>{fee.toFixed(2)}R</strong> na transakcję</span>}
        <span className="stats-muted">Wyniki liniowe (bez procentu składanego), bez poślizgu.</span>
      </div>
    </section>
  );
};

export default TradeCalculator;
