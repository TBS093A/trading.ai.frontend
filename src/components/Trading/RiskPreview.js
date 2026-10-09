import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import { formatApiError } from '../../store/slices/harmonicsSlice';
import { fetchVariantReport } from '../../store/slices/benchmarksSlice';
import { setMainView } from '../../store/slices/uiSlice';
import { LineChart, Legend } from '../Stats/charts/MiniCharts';
import { money, pctSigned, pct, prob, dateTime, tone, dash } from './tradingFormat';

const DEBOUNCE_MS = 500;
const CUSTOM_COLOR = '#3987e5';
// Validated categorical slots (dark surface) next to the blue "your settings" line; one per preset,
// in the backend's preset order, never cycled - extra presets fall back to the legend + table
const PRESET_COLORS = ['#199e70', '#c98500', '#d55181'];

// Open the benchmarks tab of the model group
const goToBenchmarks = (dispatch) => {
  try { localStorage.setItem('dashboards.model.tab', 'benchmarks'); } catch { /* fine */ }
  dispatch(setMainView('model'));
};

const runPreview = async (body) => {
  try {
    const { data } = await api.previewRisk(body);
    return { data, error: null, noReport: false };
  } catch (error) {
    if (error?.response?.status === 404) return { data: null, error: null, noReport: true };
    return { data: null, error: formatApiError(error, 'Podgląd się nie udał'), noReport: false };
  }
};

const Tile = ({ label, value, sub, cls }) => (
  <div className="sm-tile">
    <span className="sm-tile-label">{label}</span>
    <span className={`sm-tile-value ${cls || ''}`}>{value}</span>
    {sub && <span className="sm-tile-sub">{sub}</span>}
  </div>
);

/**
 * "Podgląd skutków": replays the trades of a strategy variant from the latest benchmark report
 * under these risk settings (debounced), and the ready presets next to them for comparison.
 */
const RiskPreview = ({ settings, startEquity, presets, currency = 'USDT' }) => {
  const dispatch = useDispatch();
  const report = useSelector((state) => state.benchmarks.report.data);
  const [variant, setVariant] = useState('baseline');
  const [main, setMain] = useState({ data: null, error: null, noReport: false, loading: false });
  const [compare, setCompare] = useState({});
  const seq = useRef(0);

  useEffect(() => {
    if (!report) dispatch(fetchVariantReport(null));
  }, [report, dispatch]);

  const variantOptions = report?.variants?.map((v) => ({ key: v.variant, label: v.label || v.variant })) || [{ key: 'baseline', label: 'baseline' }];
  // Same settings object while the values don't change (the parent rebuilds it on every render)
  const settingsKey = JSON.stringify(settings);
  const stableSettings = useMemo(() => (settingsKey ? JSON.parse(settingsKey) : null), [settingsKey]);

  // Main preview, debounced while sliders move; older answers are dropped
  useEffect(() => {
    if (!stableSettings || !(startEquity > 0)) return undefined;
    const my = ++seq.current;
    setMain((m) => ({ ...m, loading: true }));
    const timer = setTimeout(async () => {
      const res = await runPreview({ settings: stableSettings, variant, start_equity: startEquity, simulations: 300 });
      if (my === seq.current) setMain({ ...res, loading: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [stableSettings, variant, startEquity]);

  // Presets for comparison: only depend on the variant and starting capital
  useEffect(() => {
    if (!presets?.length || !(startEquity > 0)) return undefined;
    let alive = true;
    Promise.all(presets.map((p) => runPreview({ preset: p.key, variant, start_equity: startEquity, simulations: 0 })))
      .then((results) => {
        if (!alive) return;
        const next = {};
        presets.forEach((p, i) => { next[p.key] = results[i].data; });
        setCompare(next);
      });
    return () => { alive = false; };
  }, [presets, variant, startEquity]);

  const d = main.data;
  const b = d?.bootstrap;

  const series = useMemo(() => {
    const out = [];
    if (d?.equity_curve?.length) {
      out.push({ key: 'custom', label: 'Twoje ustawienia', color: CUSTOM_COLOR, points: d.equity_curve.map(([t, e]) => ({ x: t, y: e })) });
    }
    (presets || []).slice(0, PRESET_COLORS.length).forEach((p, i) => {
      const c = compare[p.key];
      if (c?.equity_curve?.length) {
        out.push({ key: p.key, label: p.label, color: PRESET_COLORS[i], dashed: true, points: c.equity_curve.map(([t, e]) => ({ x: t, y: e })) });
      }
    });
    return out;
  }, [d, compare, presets]);

  if (main.noReport) {
    return (
      <div className="risk-preview">
        <div className="notice-block warn">
          Podgląd liczy się na transakcjach z raportu wariantów, a takiego raportu jeszcze nie ma.
          <button type="button" className="btn-small" onClick={() => goToBenchmarks(dispatch)}>Uruchom raport w Benchmarkach</button>
        </div>
      </div>
    );
  }

  const rows = [
    { key: 'custom', label: 'Twoje ustawienia', color: CUSTOM_COLOR, data: d },
    ...(presets || []).map((p, i) => ({ key: p.key, label: p.label, color: PRESET_COLORS[i] || 'var(--text-muted)', data: compare[p.key], dashed: true })),
  ];

  return (
    <div className={`risk-preview ${main.loading ? 'loading' : ''}`}>
      <div className="risk-preview-head">
        <h4>Podgląd skutków</h4>
        <label className="risk-preview-variant">
          <span className="stats-label">na transakcjach wariantu</span>
          <select className="input compact" value={variant} onChange={(e) => setVariant(e.target.value)}>
            {variantOptions.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </label>
        {main.loading && <span className="stats-muted">przeliczanie…</span>}
      </div>
      <p className="sm-card-sub">
        Te same transakcje z raportu Benchmarków{d?.report_id ? ` (#${d.report_id})` : ''}, rozegrane z tymi ustawieniami:
        wielkość pozycji z ryzyka, limity pozycji, dzienny limit i wyłącznik obsunięcia. To historia, nie prognoza.
      </p>

      {main.error && <div className="stats-error">{main.error}</div>}

      {d && (
        <>
          <div className="sm-tiles risk-tiles">
            <Tile label="Kapitał końcowy" value={money(d.final_equity, currency, 0)} sub={`start ${money(startEquity, currency, 0)}`} />
            <Tile label="Zwrot" value={pctSigned(d.return_pct)} cls={tone(d.return_pct)} />
            <Tile label="Max obsunięcie" value={pct(d.max_drawdown_pct)} cls="neg" />
            <Tile label="Transakcje" value={d.trades_taken ?? dash} sub={`pominięte ${d.trades_skipped ?? 0}`} />
            <Tile label="Najdłuższa seria strat" value={d.worst_losing_streak ?? dash} />
            <Tile label="Dni zatrzymane limitem" value={d.days_stopped_by_daily_limit ?? dash} />
          </div>
          {d.kill_switch_at && (
            <div className="notice-block danger-block">
              Wyłącznik obsunięcia zadziałałby {dateTime(d.kill_switch_at)} - po tym dniu konto nie otwierałoby już transakcji.
            </div>
          )}
          {b && (
            <div className="risk-bootstrap">
              <span className="stats-label">Losowanie kolejności ({b.simulations}×)</span>
              <span>zwrot: mediana <strong>{pctSigned(b.return_pct_median)}</strong>, pesymistycznie (5%) <strong className={tone(b.return_pct_p5)}>{pctSigned(b.return_pct_p5)}</strong></span>
              <span>obsunięcie: mediana <strong>{pct(b.max_drawdown_pct_median)}</strong>, 95% przypadków poniżej <strong>{pct(b.max_drawdown_pct_p95)}</strong></span>
              <span>szansa ruiny (obsunięcie ≥ {pct(b.ruin_drawdown_pct, 0)}): <strong className={b.ruin_probability > 0.05 ? 'neg' : ''}>{prob(b.ruin_probability)}</strong></span>
            </div>
          )}
        </>
      )}

      <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
      <LineChart
        series={series}
        height={220}
        yFormat={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        refLines={startEquity > 0 ? [{ y: startEquity, label: 'start' }] : []}
        empty={main.loading ? 'Przeliczanie…' : 'Brak transakcji do pokazania'}
      />

      <div className="stats-table-wrap">
        <table className="stats-table risk-compare">
          <thead>
            <tr>
              <th>Wariant ryzyka</th>
              <th className="num">Zwrot</th>
              <th className="num">Max DD</th>
              <th className="num">Transakcje</th>
              <th className="num">Seria strat</th>
              <th>Wyłącznik</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.key === 'custom' ? 'risk-compare-custom' : ''}>
                <td className="group-cell">
                  <span className={`mc-key ${r.dashed ? 'dashed' : ''}`} style={r.dashed ? { color: r.color } : { background: r.color }} /> {r.label}
                </td>
                <td className={`num ${tone(r.data?.return_pct)}`}>{pctSigned(r.data?.return_pct)}</td>
                <td className="num">{pct(r.data?.max_drawdown_pct)}</td>
                <td className="num">{r.data?.trades_taken ?? dash}</td>
                <td className="num">{r.data?.worst_losing_streak ?? dash}</td>
                <td>{r.data ? (r.data.kill_switch_at ? `zadziałałby ${dateTime(r.data.kill_switch_at)}` : 'nie') : dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RiskPreview;
