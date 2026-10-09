import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createTradingAccount, resetTradingSave } from '../../store/slices/tradingSlice';
import { fetchTrackedAssets } from '../../store/slices/alertsSlice';
import RiskFields from './RiskFields';
import RiskPreview from './RiskPreview';
import { money, plural } from './tradingFormat';

const STEPS = ['Wariant ryzyka', 'Dopracuj ustawienia', 'Filtry sygnałów', 'Podsumowanie'];
const INTERVALS = ['15m', '30m', '1h', '4h', '1d', '1w'];
const PATTERNS = ['gartley', 'bat', 'alt_bat', 'butterfly', 'crab', 'deep_crab', 'shark', 'cypher', 'abcd'];

// Short summary of the key settings of a preset card
const presetSummary = (s) => [
  `${s.risk_per_trade_pct}% na transakcję`,
  `do ${s.max_open_positions} pozycji`,
  s.min_strength == null ? 'bez filtra siły' : `siła ≥ ${s.min_strength}`,
  `wyłącznik przy −${s.max_drawdown_stop_pct}%`,
];

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * New paper account: pick a risk preset -> fine-tune the fields (with a live preview of the
 * consequences) -> signal filters -> name and create.
 */
const AccountWizard = ({ onCancel, onCreated }) => {
  const dispatch = useDispatch();
  const { meta, save, accounts } = useSelector((state) => state.trading);
  const tracked = useSelector((state) => state.alerts.tracked.list);

  const [step, setStep] = useState(0);
  const [presetKey, setPresetKey] = useState('balanced');
  const preset = meta.presets.find((p) => p.key === presetKey) || meta.presets[0];
  const [risk, setRisk] = useState(null);
  const [startEquity, setStartEquity] = useState(10000);
  const [filters, setFilters] = useState({ asset_ids: [], intervals: [], patterns: [], direction: '' });
  const [name, setName] = useState('');

  useEffect(() => {
    dispatch(fetchTrackedAssets());
    dispatch(resetTradingSave());
  }, [dispatch]);

  // Picking a preset resets the fields to it
  useEffect(() => {
    if (preset) setRisk({ ...meta.defaults, ...preset.settings });
  }, [preset, meta.defaults]);

  const nameTaken = useMemo(() => accounts.list.some((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()), [accounts.list, name]);
  const canCreate = name.trim().length > 0 && !nameTaken && startEquity > 0 && save.status !== 'saving';

  const create = async () => {
    const body = {
      name: name.trim(),
      exchange: meta.exchanges[0] || 'paper',
      starting_equity: Number(startEquity),
      entry_mode: meta.entryModes[0] || 'touch',
      preset: null,
      risk,
      filters: Object.fromEntries(Object.entries({
        asset_ids: filters.asset_ids.length ? filters.asset_ids : null,
        intervals: filters.intervals.length ? filters.intervals : null,
        patterns: filters.patterns.length ? filters.patterns : null,
        direction: filters.direction || null,
      }).filter(([, v]) => v != null)),
    };
    const res = await dispatch(createTradingAccount(body));
    if (createTradingAccount.fulfilled.match(res)) onCreated(res.payload.id);
  };

  if (meta.loading || !risk) return <div className="stats-empty">Ładowanie ustawień ryzyka…</div>;
  if (meta.error) return <div className="stats-error">{meta.error}</div>;

  const changedCount = preset ? Object.keys(risk).filter((k) => preset.settings[k] !== undefined && preset.settings[k] !== risk[k]).length : 0;

  return (
    <div className="wizard">
      <div className="wizard-head">
        <h2 className="stats-title">Nowe konto paper</h2>
        <button className="btn-small" onClick={onCancel}>Anuluj</button>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={`${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <button type="button" onClick={() => setStep(i)} disabled={i > step + 1}>
              <span className="wizard-step-n">{i + 1}</span>{label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="preset-cards">
          {meta.presets.map((p) => (
            <button
              type="button"
              key={p.key}
              className={`preset-card ${presetKey === p.key ? 'active' : ''}`}
              onClick={() => setPresetKey(p.key)}
              aria-pressed={presetKey === p.key}
            >
              <span className="preset-title">{p.label}</span>
              <span className="preset-desc">{p.description}</span>
              <span className="preset-summary">{presetSummary(p.settings).map((x) => <span key={x}>{x}</span>)}</span>
            </button>
          ))}
          <p className="sm-card-sub preset-note">
            Wariant to punkt wyjścia - w następnym kroku możesz zmienić każde pole i od razu zobaczyć skutki na historii.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-split">
          <div>
            <label className="calc-field wizard-equity">
              <span className="stats-label">Kapitał startowy</span>
              <input className="input" type="number" min="100" step="1000" value={startEquity}
                onChange={(e) => setStartEquity(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <p className="sm-card-sub">
              Start z wariantu „{preset?.label}”{changedCount ? `, ${plural(changedCount, 'zmienione pole', 'zmienione pola', 'zmienionych pól')}` : ''}.
              Zmienione pola są oznaczone kolorem. <button type="button" className="link-btn" onClick={() => setRisk({ ...meta.defaults, ...preset.settings })}>Przywróć wariant</button>
            </p>
            <RiskFields fields={meta.fields} values={risk} onChange={setRisk} baseline={preset?.settings} />
          </div>
          <RiskPreview settings={risk} startEquity={startEquity} presets={meta.presets} />
        </div>
      )}

      {step === 2 && (
        <div className="wizard-filters">
          <p className="sm-card-sub">
            Konto handluje tylko na sygnałach setupów <strong>śledzonych assetów</strong>. Puste pole = bez ograniczenia.
          </p>
          <div className="add-field">
            <span className="stats-label">Assety ({filters.asset_ids.length ? filters.asset_ids.length : 'wszystkie śledzone'})</span>
            <div className="chip-group">
              {tracked.map((t) => (
                <button key={t.asset_id} type="button" className={`chip ${filters.asset_ids.includes(t.asset_id) ? 'active' : ''}`}
                  onClick={() => setFilters({ ...filters, asset_ids: toggle(filters.asset_ids, t.asset_id) })}>
                  {t.asset}/{t.quote}
                </button>
              ))}
              {tracked.length === 0 && <span className="stats-muted">Brak śledzonych assetów - dodaj je w „Alerty i śledzone assety”.</span>}
            </div>
          </div>
          <div className="add-field">
            <span className="stats-label">Interwały ({filters.intervals.length ? filters.intervals.join(', ') : 'wszystkie'})</span>
            <div className="chip-group">
              {INTERVALS.map((iv) => (
                <button key={iv} type="button" className={`chip ${filters.intervals.includes(iv) ? 'active' : ''}`}
                  onClick={() => setFilters({ ...filters, intervals: toggle(filters.intervals, iv) })}>{iv}</button>
              ))}
            </div>
          </div>
          <div className="add-field">
            <span className="stats-label">Formacje ({filters.patterns.length ? filters.patterns.length : 'wszystkie'})</span>
            <div className="chip-group">
              {PATTERNS.map((pt) => (
                <button key={pt} type="button" className={`chip ${filters.patterns.includes(pt) ? 'active' : ''}`}
                  onClick={() => setFilters({ ...filters, patterns: toggle(filters.patterns, pt) })}>{pt}</button>
              ))}
            </div>
          </div>
          <div className="add-field">
            <span className="stats-label">Kierunek</span>
            <div className="chip-group">
              {[['', 'Oba'], ['long', 'Tylko long'], ['short', 'Tylko short']].map(([v, l]) => (
                <button key={l} type="button" className={`chip ${filters.direction === v ? 'active' : ''}`}
                  onClick={() => setFilters({ ...filters, direction: v })}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-summary">
          <label className="add-field">
            <span className="stats-label">Nazwa konta</span>
            <input className="input wizard-name" value={name} maxLength={100} placeholder="np. Paper - zrównoważony"
              onChange={(e) => setName(e.target.value)} />
            {nameTaken && <span className="notice error">Ta nazwa jest już zajęta</span>}
          </label>
          <dl className="setup-section-grid wizard-recap">
            <dt>Giełda</dt><dd>{meta.exchanges[0] || 'paper'} (symulacja na prawdziwych świecach)</dd>
            <dt>Wejście</dt><dd>{meta.entryModes[0] === 'touch' ? 'zlecenie limit na bliższej krawędzi PRZ' : meta.entryModes[0]}</dd>
            <dt>Kapitał</dt><dd>{money(startEquity, 'USDT', 0)}</dd>
            <dt>Ryzyko</dt><dd>{preset?.label}{changedCount ? ` + ${plural(changedCount, 'zmiana', 'zmiany', 'zmian')}` : ''}: {presetSummary(risk).join(' · ')}</dd>
            <dt>Filtry</dt>
            <dd>
              {[filters.asset_ids.length ? plural(filters.asset_ids.length, 'asset', 'assety', 'assetów') : 'wszystkie assety',
                filters.intervals.length ? filters.intervals.join('/') : 'wszystkie interwały',
                filters.patterns.length ? plural(filters.patterns.length, 'formacja', 'formacje', 'formacji') : 'wszystkie formacje',
                filters.direction || 'oba kierunki'].join(' · ')}
            </dd>
          </dl>
          {save.status === 'failed' && <div className="stats-error">{save.error}</div>}
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-small" onClick={() => setStep(step - 1)} disabled={step === 0}>Wstecz</button>
        {step < STEPS.length - 1 ? (
          <button className="btn-small primary" onClick={() => setStep(step + 1)}>Dalej</button>
        ) : (
          <button className="btn-small primary" onClick={create} disabled={!canCreate}>
            {save.status === 'saving' ? 'Tworzenie…' : 'Utwórz konto'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountWizard;
