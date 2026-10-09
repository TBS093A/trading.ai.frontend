import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAdmin } from '../../store/slices/authSlice';
import {
  fetchStrengthModels,
  fetchStrengthHistory,
  fetchStrengthData,
  fitStrengthModel,
  dismissFit,
} from '../../store/slices/strengthSlice';
import { LineChart, ColumnChart, DivergingBars, CalibrationChart, Legend } from './charts/MiniCharts';
import ModelTrainingGuide from './ModelTrainingGuide';
import './StrengthModelView.css';

// Validated (dataviz checks, dark surface): full model vs pre-entry model
export const KIND_COLORS = { entry: '#2399a8', pre: '#d4762a' };
const KIND_LABELS = { entry: 'Pełny (od wejścia)', pre: 'Wstępny (przed PRZ)' };
const KIND_TITLES = { entry: 'model pełny (od wejścia)', pre: 'model wstępny (przed PRZ)' };
const POS = '#4a9e4a';
const NEG = '#c95f8f';
// After "Naucz teraz" the history is re-checked this often, for this long
const FIT_POLL_MS = 15000;
const FIT_POLL_FOR_MS = 3 * 60 * 1000;

const dash = '–';
const pct = (v, d = 0) => (v == null ? dash : `${(v * 100).toFixed(d)}%`);
const num = (v, d = 2) => (v == null ? dash : Number(v).toFixed(d));
const rFmt = (v) => (v == null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
const date = (v) => (v ? new Date(v).toLocaleDateString() : dash);
const dateTime = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : dash);

const StatTile = ({ label, value, sub }) => (
  <div className="sm-tile">
    <span className="sm-tile-label">{label}</span>
    <span className="sm-tile-value">{value}</span>
    {sub && <span className="sm-tile-sub">{sub}</span>}
  </div>
);

const ModelTiles = ({ kind, model }) => (
  <div className="sm-model-card">
    <div className="sm-model-head">
      <span className="mc-swatch" style={{ background: KIND_COLORS[kind] }} />
      <span className="sm-model-title">{KIND_TITLES[kind][0].toUpperCase() + KIND_TITLES[kind].slice(1)}</span>
      <span className="stats-muted">{model ? `nauczony ${dateTime(model.trained_at)}` : 'brak modelu'}</span>
    </div>
    <div className="sm-tiles">
      <StatTile label="AUC (test)" value={num(model?.metrics?.auc_test)} sub="0.5 = losowo" />
      <StatTile label="Próbki" value={model?.metrics?.samples?.toLocaleString() ?? dash}
        sub={model?.metrics ? `train ${model.metrics.train ?? dash} · test ${model.metrics.test ?? dash}` : null} />
      <StatTile label="Bazowy win rate (test)" value={pct(model?.metrics?.base_win_rate_test, 1)} />
      <StatTile label="Średnie R (test)" value={rFmt(model?.metrics?.avg_r_test)} />
    </div>
  </div>
);

const Card = ({ title, sub, children, wide }) => (
  <section className={`sm-card ${wide ? 'wide' : ''}`}>
    <h3 className="sm-card-title">{title}</h3>
    {sub && <p className="sm-card-sub">{sub}</p>}
    {children}
  </section>
);

const StrengthModelView = () => {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const { models, history, data, fit } = useSelector((state) => state.strength);
  const [kind, setKind] = useState('entry');

  const reload = useCallback(() => {
    dispatch(fetchStrengthModels());
    dispatch(fetchStrengthHistory({ kind: 'entry' }));
    dispatch(fetchStrengthHistory({ kind: 'pre' }));
    dispatch(fetchStrengthData());
  }, [dispatch]);

  useEffect(() => {
    reload();
  }, [reload]);

  // After starting a fit, keep checking until a new run shows up (or time runs out)
  useEffect(() => {
    if (fit.status !== 'started') return undefined;
    const timer = setInterval(() => {
      if (Date.now() - fit.startedAt > FIT_POLL_FOR_MS) {
        clearInterval(timer);
        return;
      }
      dispatch(fetchStrengthModels());
      dispatch(fetchStrengthHistory({ kind: 'entry' }));
      dispatch(fetchStrengthHistory({ kind: 'pre' }));
    }, FIT_POLL_MS);
    return () => clearInterval(timer);
  }, [fit.status, fit.startedAt, dispatch]);

  const current = models[kind];
  const metrics = current?.metrics || {};

  const aucSeries = useMemo(() => ['entry', 'pre'].map((k) => ({
    key: k,
    label: KIND_LABELS[k],
    color: KIND_COLORS[k],
    points: history[k].runs.map((r) => ({ x: new Date(r.created_at).getTime(), y: r.metrics?.auc_test ?? null })),
  })), [history]);

  const quintiles = metrics.quintiles_test || [];
  const winRateCols = quintiles.map((q) => ({
    label: `Q${q.quintile}`, value: q.win_rate, title: `Kwintyl ${q.quintile} (n = ${q.n})`,
  }));
  const avgRCols = quintiles.map((q) => ({
    label: `Q${q.quintile}`, value: q.avg_r, title: `Kwintyl ${q.quintile} (n = ${q.n})`,
  }));
  const calibration = (metrics.calibration_test || []).map((b) => ({
    x: b.predicted, y: b.actual, n: b.n, label: `Przedział ${b.bin}`,
  }));
  const weights = (current?.top_weights || []).map((w) => ({ label: w.label || w.feature, value: w.weight }));

  const weeks = data.weeks || [];
  const weekLabel = (w) => {
    const d = new Date(w.week);
    return Number.isNaN(d.getTime()) ? String(w.week) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const tradeCols = weeks.map((w) => ({
    label: weekLabel(w), value: w.trades, title: `Tydzień od ${weekLabel(w)}`,
    extra: [{ label: 'wygranych', value: String(w.wins ?? dash) }, { label: 'win rate', value: pct(w.win_rate, 1) }],
  }));
  const winRateLine = [{
    key: 'wr', label: 'Win rate', color: KIND_COLORS.entry,
    points: weeks.map((w) => ({ x: new Date(w.week).getTime(), y: w.win_rate })).filter((p) => Number.isFinite(p.x)),
  }];

  const runs = [...history[kind].runs].reverse(); // newest first in the table
  const anyError = models.error || history.entry.error || history.pre.error || data.error;
  const loading = models.loading || history.entry.loading || data.loading;

  return (
    <div className={`stats-view sm-view ${loading ? 'loading' : ''}`}>
      <header className="stats-header sm-header">
        <div>
          <h2 className="stats-title">Model siły</h2>
          <p className="stats-subtitle">
            Jak dobrze model przewiduje, czy setup dojdzie do TP1 przed SL - na danych testowych, których nie widział przy nauce.
          </p>
        </div>
        <div className="sm-actions">
          <button className="btn-small" onClick={reload} disabled={loading}>{loading ? 'Ładowanie…' : 'Odśwież'}</button>
          {isAdmin && (
            <button className="btn-small primary" onClick={() => dispatch(fitStrengthModel())} disabled={fit.status === 'starting'}
              title="Uruchamia uczenie obu modeli w tle">
              {fit.status === 'starting' ? 'Uruchamianie…' : 'Naucz teraz'}
            </button>
          )}
        </div>
      </header>

      {fit.status === 'started' && (
        <div className="notice-block ok-block">
          Uczenie ruszyło{fit.taskId ? ` (zadanie ${fit.taskId})` : ''}. Historia odświeża się sama co 15 s przez 3 minuty.
          <button className="notice-dismiss" onClick={() => dispatch(dismissFit())} aria-label="Zamknij">×</button>
        </div>
      )}
      {fit.status === 'failed' && <div className="stats-error">{fit.error}</div>}
      {anyError && <div className="stats-error">{anyError}</div>}

      <ModelTrainingGuide
        decided={data.totals && Object.keys(data.totals).length
          ? ['win', 'loss', 'expired'].reduce((s, k) => s + (Number(data.totals[k]) || 0), 0)
          : null}
      />

      <div className="sm-models">
        <ModelTiles kind="entry" model={models.entry} />
        <ModelTiles kind="pre" model={models.pre} />
      </div>

      <div className="sm-grid">
        <Card title="AUC w czasie" sub="Każdy punkt to jedno uczenie. Powyżej 0.5 model odróżnia wygrane od przegranych lepiej niż losowo." wide>
          <Legend items={aucSeries.map((s) => ({ label: s.label, color: s.color }))} />
          <LineChart
            series={aucSeries}
            yFormat={(v) => Number(v).toFixed(2)}
            refLines={[{ y: 0.5, label: '0.5 losowo' }]}
            height={220}
            empty="Brak historii uczenia"
          />
        </Card>

        <div className="sm-kind-switch wide" role="radiogroup" aria-label="Model">
          <span className="stats-label">Szczegóły modelu</span>
          {['entry', 'pre'].map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
              <span className="mc-swatch" style={{ background: KIND_COLORS[k] }} /> {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <Card title="Win rate w kwintylach siły" sub="Q1 = najsłabsze 20% setupów, Q5 = najsilniejsze. Dobry model rośnie od Q1 do Q5.">
          <ColumnChart
            data={winRateCols}
            color={KIND_COLORS[kind]}
            yFormat={(v) => `${Math.round(v * 100)}%`}
            refLine={metrics.base_win_rate_test != null ? { y: metrics.base_win_rate_test, label: 'bazowy' } : null}
            tooltipLabel="win rate"
          />
        </Card>

        <Card title="Średnie R w kwintylach" sub="Oczekiwany wynik na transakcję w każdym kwintylu.">
          <ColumnChart
            data={avgRCols}
            color={POS}
            negColor={NEG}
            yFormat={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`}
            tooltipLabel="średnie R"
          />
        </Card>

        <Card title="Kalibracja" sub="Przewidywana szansa TP1 vs rzeczywisty win rate w przedziałach. Punkty na przekątnej = model mówi prawdę o prawdopodobieństwie.">
          <CalibrationChart points={calibration} color={KIND_COLORS[kind]} />
        </Card>

        <Card title="Wagi cech" sub="Cechy o największym wpływie na siłę: + wzmacnia, − osłabia.">
          <DivergingBars rows={weights} posColor={POS} negColor={NEG} format={(v) => v.toFixed(2)} />
        </Card>

        <Card title="Dane uczące" sub="Zamknięte transakcje na tydzień i ich win rate." wide>
          <ColumnChart data={tradeCols} color={KIND_COLORS.entry} valueLabels={false} tooltipLabel="transakcji" height={150} />
          <p className="sm-mini-title">Win rate tygodniowo</p>
          <LineChart series={winRateLine} yFormat={(v) => `${Math.round(v * 100)}%`} height={140} empty="Brak danych tygodniowych" />
          {data.totals && Object.keys(data.totals).length > 0 && (
            <div className="sm-totals">
              {Object.entries(data.totals).map(([st, n]) => (
                <span key={st}><span className={`st ${st}`}>{st.replace('_', ' ')}</span> {Number(n).toLocaleString()}</span>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Historia uczenia: ${KIND_TITLES[kind]}`} wide>
          <div className="stats-table-wrap">
            {runs.length === 0 ? (
              <div className="stats-empty">Brak przebiegów.</div>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Kiedy</th>
                    <th>Aktywny</th>
                    <th className="num">Próbki</th>
                    <th className="num">Train / test</th>
                    <th>Okno testu</th>
                    <th className="num">AUC</th>
                    <th className="num">Bazowy WR</th>
                    <th className="num">Średnie R</th>
                    <th>Reguły</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className={r.active ? 'sm-active-run' : ''}>
                      <td>{dateTime(r.created_at)}</td>
                      <td>{r.active ? '✓' : ''}</td>
                      <td className="num">{r.metrics?.samples?.toLocaleString() ?? dash}</td>
                      <td className="num">{r.metrics?.train ?? dash} / {r.metrics?.test ?? dash}</td>
                      <td>{date(r.metrics?.test_from)} – {date(r.metrics?.test_to)}</td>
                      <td className="num">{num(r.metrics?.auc_test)}</td>
                      <td className="num">{pct(r.metrics?.base_win_rate_test, 1)}</td>
                      <td className="num">{rFmt(r.metrics?.avg_r_test)}</td>
                      <td className="stats-muted">{r.params_version || dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StrengthModelView;
