import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAdmin } from '../../store/slices/authSlice';
import { fetchVariantReports, fetchVariantReport, runVariantBenchmark } from '../../store/slices/benchmarksSlice';
import { LineChart, Legend } from './charts/MiniCharts';
import './StrengthModelView.css';
import './BenchmarksView.css';

// Equity curve colors (dataviz validator, dark surface): slots handed out when a variant is
// added to the chart and kept while it stays there, so removing one never repaints the others
const SLOT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
// Baseline is a neutral reference, told apart by its dash as well as its color
const BASELINE_COLOR = '#b7bec6';
const MIN_TRADES_FOR_BEST = 100;
const POLL_MS = 10000;
const SAMPLES = [
  { key: 'out', label: 'Out', hint: 'Po cutoff - poza próbką, na której uczył się model siły' },
  { key: 'in', label: 'In', hint: 'Przed cutoff - w okresie uczenia modelu siły' },
  { key: 'all', label: 'All', hint: 'Cały okres' },
];

const dash = '–';
const pct = (v, d = 1) => (v == null ? dash : `${(v * 100).toFixed(d)}%`);
const r2 = (v) => (v == null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`);
const rR = (v) => (v == null ? dash : `${r2(v)}R`);
const dateTime = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : dash);
const isBaseline = (v) => v.variant === 'baseline' || /baseline/i.test(v.label || '');
const hasTrades = (s) => s && s.trades > 0;

const Ci = ({ lo, hi, fmt }) => (lo == null || hi == null ? null : <span className="bm-ci">{fmt(lo)}…{fmt(hi)}</span>);

const SummaryCells = ({ s }) => {
  if (!hasTrades(s)) {
    return <><td className="num">0</td><td className="num">{dash}</td><td className="num">{dash}</td><td className="num">{dash}</td><td className="num">{dash}</td></>;
  }
  return (
    <>
      <td className="num">{s.trades.toLocaleString()}</td>
      <td className="num">{pct(s.win_rate)} <Ci lo={s.win_rate_ci95?.[0]} hi={s.win_rate_ci95?.[1]} fmt={(v) => pct(v, 0)} /></td>
      <td className={`num ${s.avg_r > 0 ? 'pos' : s.avg_r < 0 ? 'neg' : ''}`}>
        {rR(s.avg_r)} <Ci lo={s.avg_r_ci95?.[0]} hi={s.avg_r_ci95?.[1]} fmt={r2} />
      </td>
      <td className={`num ${s.total_r > 0 ? 'pos' : s.total_r < 0 ? 'neg' : ''}`}>{rR(s.total_r)}</td>
      <td className="num neg">{s.max_drawdown_r == null ? dash : `−${Math.abs(s.max_drawdown_r).toFixed(2)}R`}</td>
    </>
  );
};

const BreakdownTable = ({ title, rows }) => {
  const entries = Object.entries(rows || {}).sort((a, b) => (b[1]?.trades || 0) - (a[1]?.trades || 0));
  return (
    <div className="bm-breakdown">
      <h4 className="bm-breakdown-title">{title}</h4>
      <div className="stats-table-wrap">
        {entries.length === 0 ? <div className="stats-empty">Brak danych</div> : (
          <table className="stats-table">
            <thead>
              <tr><th /><th className="num">Trades</th><th className="num">Win rate (95% CI)</th><th className="num">Avg R (95% CI)</th><th className="num">Total R</th><th className="num">Max DD</th></tr>
            </thead>
            <tbody>
              {entries.map(([k, s]) => (
                <tr key={k}><td className="group-cell">{k}</td><SummaryCells s={s} /></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const BenchmarksView = () => {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const { reports, report, run } = useSelector((state) => state.benchmarks);
  const [reportId, setReportId] = useState(null); // null = latest
  const [sample, setSample] = useState('out');
  const [onChart, setOnChart] = useState({}); // variant -> color slot
  const [selected, setSelected] = useState(null); // variant shown in the breakdown
  const [candles, setCandles] = useState(5000);

  useEffect(() => {
    dispatch(fetchVariantReports());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchVariantReport(reportId));
  }, [dispatch, reportId]);

  const data = report.data;
  const incomplete = data && !data.complete;

  // Workers fill the report in the background - poll until it is complete
  useEffect(() => {
    if (!incomplete) return undefined;
    const timer = setInterval(() => {
      dispatch(fetchVariantReport(reportId));
      dispatch(fetchVariantReports());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [incomplete, reportId, dispatch]);

  // New report or switch: start with the baseline + best "out" variant on the chart
  const variants = useMemo(() => data?.variants || [], [data]);
  const best = useMemo(() => {
    const eligible = variants.filter((v) => (v.out?.trades || 0) >= MIN_TRADES_FOR_BEST && v.out?.avg_r != null);
    return eligible.reduce((a, b) => (!a || b.out.avg_r > a.out.avg_r ? b : a), null);
  }, [variants]);

  // Reset the chart picks only when a different report arrives - polling the same one keeps them
  const shownReportRef = useRef(null);
  useEffect(() => {
    if (!data || shownReportRef.current === data.report_id) return;
    shownReportRef.current = data.report_id;
    const initial = {};
    if (best && !isBaseline(best)) initial[best.variant] = 0;
    setOnChart(initial);
    setSelected(null);
  }, [data, best]);

  const toggleOnChart = (variant) => {
    setOnChart((prev) => {
      if (variant in prev) {
        const next = { ...prev };
        delete next[variant];
        return next;
      }
      const used = new Set(Object.values(prev));
      const slot = SLOT_COLORS.findIndex((_, i) => !used.has(i));
      if (slot === -1) return prev; // all slots taken
      return { ...prev, [variant]: slot };
    });
  };

  const series = variants
    .filter((v) => isBaseline(v) || v.variant in onChart)
    .map((v) => ({
      key: v.variant,
      label: v.label || v.variant,
      color: isBaseline(v) ? BASELINE_COLOR : SLOT_COLORS[onChart[v.variant]],
      dashed: isBaseline(v),
      points: (v.equity || []).map(([t, cum]) => ({ x: t, y: cum })),
    }));

  const selectedVariant = variants.find((v) => v.variant === selected);
  const slotsFull = Object.keys(onChart).length >= SLOT_COLORS.length;

  return (
    <div className={`stats-view bm-view ${report.loading && !data ? 'loading' : ''}`}>
      <header className="stats-header sm-header">
        <div>
          <h2 className="stats-title">Benchmarki</h2>
          <p className="stats-subtitle">
            Warianty strategii na tych samych parach i tym samym okresie. Wyniki „out” (po cutoff) są poza próbką,
            na której uczył się model siły - tylko one są miarodajne dla wariantów korzystających z siły.
          </p>
        </div>
        <div className="sm-actions">
          <select className="input compact" value={reportId ?? ''} onChange={(e) => setReportId(e.target.value ? Number(e.target.value) : null)} aria-label="Raport">
            <option value="">Najnowszy raport</option>
            {reports.list.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {dateTime(r.created_at)}{r.complete ? '' : ` · ${r.pairs_done}/${r.pairs_total}`}
              </option>
            ))}
          </select>
          {isAdmin && (
            <>
              <input className="input compact narrow-num" type="number" min="500" step="500" value={candles}
                onChange={(e) => setCandles(Number(e.target.value))} title="Świec na parę" aria-label="Świec na parę" />
              <button
                className="btn-small primary"
                disabled={run.status === 'starting' || !(candles > 0)}
                onClick={async () => {
                  const res = await dispatch(runVariantBenchmark(candles));
                  if (runVariantBenchmark.fulfilled.match(res)) {
                    setReportId(res.payload.report_id ?? null);
                    dispatch(fetchVariantReports());
                  }
                }}
              >
                {run.status === 'starting' ? 'Uruchamianie…' : 'Uruchom benchmark'}
              </button>
            </>
          )}
        </div>
      </header>

      {run.status === 'failed' && <div className="stats-error">{run.error}</div>}
      {(report.error || reports.error) && <div className="stats-error">{report.error || reports.error}</div>}

      {!data && !report.loading && !report.error && (
        <div className="stats-empty sm-card">Nie ma jeszcze żadnego raportu.{isAdmin ? ' Uruchom benchmark przyciskiem powyżej.' : ''}</div>
      )}

      {data && (
        <>
          <div className="bm-meta">
            <span>Raport #{data.report_id} · {dateTime(data.created_at)}</span>
            <span>cutoff: <strong>{dateTime(data.cutoff_ms)}</strong></span>
            {incomplete ? (
              <span className="bm-progress" title="Liczą to workery; strona odświeża się co 10 s">
                <span className="bm-progress-bar">
                  <span style={{ width: `${data.pairs_total ? (data.pairs_done / data.pairs_total) * 100 : 0}%` }} />
                </span>
                {data.pairs_done}/{data.pairs_total} par
              </span>
            ) : (
              <span>{data.pairs_total} par · gotowy</span>
            )}
          </div>

          <section className="sm-card">
            <div className="bm-table-head">
              <h3 className="sm-card-title">Warianty</h3>
              <div className="chip-group" role="radiogroup" aria-label="Okres">
                {SAMPLES.map((s) => (
                  <button key={s.key} role="radio" aria-checked={sample === s.key} title={s.hint}
                    className={`chip ${sample === s.key ? 'active' : ''}`} onClick={() => setSample(s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {sample !== 'out' && (
              <p className="sm-card-sub">
                Uwaga: w okresie „{sample}” warianty z siłą korzystają z modelu, który widział te dane - ich wyniki są zawyżone.
              </p>
            )}
            <div className="stats-table-wrap">
              <table className="stats-table bm-table">
                <thead>
                  <tr>
                    <th title="Pokaż krzywą kapitału na wykresie">Wykres</th>
                    <th>Wariant</th>
                    <th className="num">Trades</th>
                    <th className="num" title="Odsetek transakcji zamkniętych na TP1, z 95% przedziałem ufności">Win rate (95% CI)</th>
                    <th className="num" title="Średni wynik na transakcję w R, z 95% przedziałem ufności">Avg R (95% CI)</th>
                    <th className="num">Total R</th>
                    <th className="num" title="Największe obsunięcie kapitału">Max DD</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const base = isBaseline(v);
                    const slot = onChart[v.variant];
                    const isBest = best && best.variant === v.variant;
                    return (
                      <tr key={v.variant} className={`${selected === v.variant ? 'bm-selected' : ''} ${isBest ? 'bm-best' : ''}`}
                        onClick={() => setSelected(selected === v.variant ? null : v.variant)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          {base ? (
                            <span className="bm-key dashed" style={{ color: BASELINE_COLOR }} title="Baseline jest zawsze na wykresie" />
                          ) : (
                            <label className="bm-check">
                              <input type="checkbox" checked={slot != null} disabled={slot == null && slotsFull}
                                onChange={() => toggleOnChart(v.variant)} aria-label={`Pokaż ${v.label || v.variant} na wykresie`} />
                              {slot != null && <span className="bm-key" style={{ background: SLOT_COLORS[slot] }} />}
                            </label>
                          )}
                        </td>
                        <td className="group-cell">
                          {v.label || v.variant}
                          {isBest && <span className="bm-star" title={`Najlepsze średnie R „out” przy co najmniej ${MIN_TRADES_FOR_BEST} transakcjach`}>★ najlepszy out</span>}
                        </td>
                        <SummaryCells s={v[sample]} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="sm-card-sub">Kliknij wiersz, żeby zobaczyć rozbicie na interwały i formacje. Na wykresie naraz do {SLOT_COLORS.length} wariantów + baseline.</p>
          </section>

          <section className="sm-card">
            <h3 className="sm-card-title">Krzywa kapitału (skumulowane R)</h3>
            <p className="sm-card-sub">Każdy punkt to zamknięcie transakcji. Linia „cutoff” oddziela okres uczenia modelu (in) od testu (out).</p>
            <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
            <LineChart
              series={series}
              height={260}
              yFormat={(v) => `${r2(v)}R`}
              xFormat={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
              refLines={[{ y: 0, label: '0R' }]}
              xRefLines={data.cutoff_ms ? [{ x: data.cutoff_ms, label: 'cutoff' }] : []}
              empty="Brak transakcji w tym raporcie"
            />
          </section>

          {selectedVariant && (
            <section className="sm-card">
              <div className="bm-table-head">
                <h3 className="sm-card-title">Rozbicie: {selectedVariant.label || selectedVariant.variant}</h3>
                <button className="btn-small" onClick={() => setSelected(null)}>Zamknij</button>
              </div>
              <div className="bm-breakdowns">
                <BreakdownTable title="Interwały" rows={selectedVariant.by_interval} />
                <BreakdownTable title="Formacje" rows={selectedVariant.by_pattern} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default BenchmarksView;
