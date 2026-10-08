import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  GROUP_BY_OPTIONS,
  fetchSetupStats,
  fetchTrackedSetups,
  setStatsFilter,
  toggleGroupBy,
} from '../../store/slices/setupsSlice';
import './StatsView.css';

const INTERVAL_ORDER = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const r = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}R`);

// Win rate with its 95% confidence interval as whiskers - on small samples the interval
// is very wide, which is the most important thing to see
const WinRateBar = ({ rate, ci }) => {
  if (rate == null) return <span className="stats-muted">—</span>;
  const [lo, hi] = ci || [rate, rate];
  return (
    <div className="winrate" title={`95% CI: ${pct(lo)} – ${pct(hi)}`}>
      <span className="winrate-value">{pct(rate)}</span>
      <div className="winrate-track">
        <div className="winrate-ci" style={{ left: `${lo * 100}%`, width: `${Math.max(0.5, (hi - lo) * 100)}%` }} />
        <div className="winrate-dot" style={{ left: `${rate * 100}%` }} />
      </div>
      <span className="winrate-ci-text">{pct(lo)}–{pct(hi)}</span>
    </div>
  );
};

const OutcomeBreakdown = ({ g }) => {
  const parts = [
    ['win', g.wins, 'Wins'],
    ['loss', g.losses, 'Losses'],
    ['expired', g.expired, 'Expired after entry'],
    ['no_entry', g.no_entry, 'Price never reached the PRZ'],
    ['invalidated', g.invalidated, 'Invalidated before entry'],
    ['pending', g.pending, 'Still open or waiting'],
  ];
  const total = parts.reduce((s, [, n]) => s + (n || 0), 0) || 1;
  return (
    <div className="outcomes">
      <div className="outcomes-bar">
        {parts.map(([cls, n, label]) => (n > 0 ? (
          <span key={cls} className={`outcome ${cls}`} style={{ width: `${(n / total) * 100}%` }} title={`${label}: ${n}`} />
        ) : null))}
      </div>
      <span className="outcomes-text">
        {g.wins}W · {g.losses}L · {g.expired}E · {g.no_entry}NE · {g.invalidated}I{g.pending ? ` · ${g.pending}P` : ''}
      </span>
    </div>
  );
};

const StatsView = () => {
  const dispatch = useDispatch();
  const { filters, stats, tracked } = useSelector((state) => state.setups);

  useEffect(() => {
    dispatch(fetchTrackedSetups());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchSetupStats(filters));
  }, [dispatch, filters]);

  const assetNames = useMemo(() => {
    const map = {};
    tracked.list.forEach((t) => { map[t.asset_id] = `${t.asset}/${t.quote}`; });
    return map;
  }, [tracked.list]);

  const assets = useMemo(() => Object.entries(assetNames).sort((a, b) => a[1].localeCompare(b[1])), [assetNames]);
  const intervals = useMemo(() => {
    const set = new Set(tracked.list.map((t) => t.interval));
    return INTERVAL_ORDER.filter((i) => set.has(i)).concat([...set].filter((i) => !INTERVAL_ORDER.includes(i)));
  }, [tracked.list]);

  const data = stats.data;
  const groupBy = data?.group_by || filters.groupBy;
  const groups = data?.groups || [];

  const groupLabel = (key, value) => {
    if (value == null) return '—';
    if (key === 'asset_id') return assetNames[value] || `#${value}`;
    if (key === 'is_bullish') return value ? 'Bullish' : 'Bearish';
    return String(value);
  };

  const columnLabel = (key) => GROUP_BY_OPTIONS.find((o) => o.key === key)?.label || key;

  return (
    <div className="stats-view">
      <header className="stats-header">
        <div>
          <h2 className="stats-title">Setup performance</h2>
          <p className="stats-subtitle">
            How harmonic setups played out when traded by fixed rules
            {data?.params_version && <span className="stats-muted"> · rules {data.params_version}</span>}
          </p>
        </div>
      </header>

      <div className="stats-controls">
        <div className="stats-control">
          <span className="stats-label">Group by</span>
          <div className="chip-group">
            {GROUP_BY_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                className={`chip ${filters.groupBy.includes(key) ? 'active' : ''}`}
                onClick={() => dispatch(toggleGroupBy(key))}
                aria-pressed={filters.groupBy.includes(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="stats-control">
          <span className="stats-label">Interval</span>
          <select className="input" value={filters.interval} onChange={(e) => dispatch(setStatsFilter({ interval: e.target.value }))}>
            <option value="">All</option>
            {intervals.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>

        <label className="stats-control">
          <span className="stats-label">Asset</span>
          <select className="input" value={filters.assetId} onChange={(e) => dispatch(setStatsFilter({ assetId: e.target.value }))}>
            <option value="">All</option>
            {assets.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>

        <div className="stats-control">
          <span className="stats-label">Direction</span>
          <div className="chip-group">
            {['all', 'bullish', 'bearish'].map((d) => (
              <button
                key={d}
                className={`chip ${filters.direction === d ? 'active' : ''}`}
                onClick={() => dispatch(setStatsFilter({ direction: d }))}
              >
                {d === 'all' ? 'All' : d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <label className="stats-control">
          <span className="stats-label">Source</span>
          <select className="input" value={filters.source} onChange={(e) => dispatch(setStatsFilter({ source: e.target.value }))}>
            <option value="">All</option>
            <option value="live">Live</option>
            <option value="replay">Replay (backfill)</option>
          </select>
        </label>

        <label className="stats-control narrow">
          <span className="stats-label">Min trades</span>
          <input
            className="input"
            type="number"
            min="0"
            value={filters.minTrades}
            onChange={(e) => dispatch(setStatsFilter({ minTrades: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
          />
        </label>
      </div>

      {stats.error && <div className="stats-error">{stats.error}</div>}

      <div className={`stats-table-wrap ${stats.loading ? 'loading' : ''}`}>
        {groups.length === 0 && !stats.loading ? (
          <div className="stats-empty">
            No setups match these filters yet. Data appears after the backfill has run for the tracked assets.
          </div>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                {groupBy.map((k) => <th key={k}>{columnLabel(k)}</th>)}
                <th className="num" title="Setups detected (X..C known, PRZ ahead)">Setups</th>
                <th className="num" title="Setups where price reached the PRZ and a trade was opened">Trades</th>
                <th title="Share of trades closed at TP1, with the 95% confidence interval">Win rate (95% CI)</th>
                <th className="num" title="Share of trades that went on to reach TP2">TP2</th>
                <th className="num" title="Share of setups where price reached the entry">Entry rate</th>
                <th className="num" title="Expected result per trade in R (risk units)">Avg R</th>
                <th className="num" title="Average maximum favourable / adverse excursion in R">MFE / MAE</th>
                <th>Outcomes</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={groupBy.map((k) => String(g[k])).join('|')}>
                  {groupBy.map((k) => (
                    <td key={k} className="group-cell">{groupLabel(k, g[k])}</td>
                  ))}
                  <td className="num">{g.setups}</td>
                  <td className="num">{g.trades}</td>
                  <td><WinRateBar rate={g.win_rate} ci={g.win_rate_ci95} /></td>
                  <td className="num">{pct(g.tp2_rate)}</td>
                  <td className="num">{pct(g.entry_rate)}</td>
                  <td className={`num avg-r ${g.avg_r > 0 ? 'pos' : g.avg_r < 0 ? 'neg' : ''}`}>{r(g.avg_r)}</td>
                  <td className="num stats-muted">{r(g.avg_mfe_r)} / {r(g.avg_mae_r)}</td>
                  <td><OutcomeBreakdown g={g} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <details className="stats-method">
        <summary>How setups are simulated</summary>
        <ul>
          <li>A <strong>setup</strong> is an X-A-B-C structure plus its PRZ (the zone where D would complete the pattern), using only data known at that moment.</li>
          <li><strong>Entry</strong> is at the nearer edge of the PRZ once price reaches it; if it never does the setup counts as <em>no entry</em>.</li>
          <li><strong>Stop loss and targets</strong> follow the same rules as the chart (TP1/TP2); the whole position closes at TP1.</li>
          <li>If TP and SL are hit within the same candle, it counts as a <strong>loss</strong> (conservative).</li>
          <li><strong>R</strong> = result divided by the initial risk (entry to SL). Avg R above 0 means the setup made money on average.</li>
          <li>The win-rate bar shows the 95% confidence interval - with few trades it is wide, so treat the number with caution.</li>
        </ul>
        {data?.params && (
          <dl className="stats-params">
            {Object.entries(data.params).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
      </details>
    </div>
  );
};

export default StatsView;
