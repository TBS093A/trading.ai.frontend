import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import { selectIsAdmin } from '../../store/slices/authSlice';
import {
  DEFAULT_SETUP_INTERVALS,
  DEFAULT_BACKFILL_CANDLES,
  fetchTrackedAssets,
  saveTrackedAsset,
  removeTrackedAsset,
  dismissBackfillNotice,
} from '../../store/slices/alertsSlice';
import './AlertsViews.css';

const INTERVAL_ORDER = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
const sortIntervals = (list) => [...list].sort((a, b) => INTERVAL_ORDER.indexOf(a) - INTERVAL_ORDER.indexOf(b));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

const IntervalChips = ({ choices, value, onChange, disabled }) => (
  <div className="chip-group">
    {choices.map((iv) => (
      <button
        key={iv}
        type="button"
        className={`chip ${value.includes(iv) ? 'active' : ''}`}
        disabled={disabled}
        aria-pressed={value.includes(iv)}
        onClick={() => onChange(value.includes(iv) ? value.filter((x) => x !== iv) : sortIntervals([...value, iv]))}
      >
        {iv}
      </button>
    ))}
  </div>
);

const Switch = ({ checked, onChange, disabled, label }) => (
  <label className={`switch ${disabled ? 'disabled' : ''}`} title={label}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span className="switch-track"><span className="switch-thumb" /></span>
  </label>
);

const TrackedRow = ({ row, choices, isAdmin }) => {
  const dispatch = useDispatch();
  const saving = useSelector((state) => !!state.alerts.tracked.saving[row.asset_id]);
  const backfill = useSelector((state) => state.alerts.tracked.backfill[row.asset_id]);
  const error = useSelector((state) => state.alerts.tracked.rowErrors[row.asset_id]);

  const [patternsSync, setPatternsSync] = useState(row.patterns_sync);
  const [intervals, setIntervals] = useState(row.setup_intervals || []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Server row changed (saved / reloaded) - drop local edits
  useEffect(() => {
    setPatternsSync(row.patterns_sync);
    setIntervals(row.setup_intervals || []);
  }, [row.patterns_sync, row.setup_intervals]);

  const dirty = patternsSync !== row.patterns_sync || !sameSet(intervals, row.setup_intervals || []);
  const added = intervals.filter((iv) => !(row.setup_intervals || []).includes(iv));

  return (
    <tr className={dirty ? 'dirty' : ''}>
      <td className="group-cell">
        {row.asset}/{row.quote}
        {row.full_name && <div className="stats-muted row-sub">{row.full_name}</div>}
      </td>
      <td>
        <Switch checked={patternsSync} onChange={setPatternsSync} disabled={!isAdmin || saving}
          label="Nightly harmonic pattern sync for this asset" />
      </td>
      <td>
        <IntervalChips choices={choices} value={intervals} onChange={setIntervals} disabled={!isAdmin || saving} />
      </td>
      <td className="stats-muted">{fmtDate(row.updated_at || row.created_at)}</td>
      <td className="row-actions">
        {isAdmin && (
          <>
            <button
              className="btn-small primary"
              disabled={!dirty || saving}
              onClick={() => dispatch(saveTrackedAsset({ assetId: row.asset_id, patternsSync, setupIntervals: intervals }))}
              title={added.length ? `Saving starts a backfill for ${added.join(', ')}` : 'Save changes'}
            >
              {saving ? '…' : 'Save'}
            </button>
            {dirty && !saving && (
              <button className="btn-small" onClick={() => { setPatternsSync(row.patterns_sync); setIntervals(row.setup_intervals || []); }}>
                Reset
              </button>
            )}
            <button
              className={`btn-small danger ${confirmDelete ? 'confirm' : ''}`}
              disabled={saving}
              onClick={() => (confirmDelete ? dispatch(removeTrackedAsset(row.asset_id)) : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              title="Stop tracking (setup history is kept)"
            >
              {confirmDelete ? 'Confirm' : 'Remove'}
            </button>
          </>
        )}
        {backfill && (
          <span className="notice ok">
            Backfill started: {backfill.join(', ')}
            <button className="notice-dismiss" onClick={() => dispatch(dismissBackfillNotice(row.asset_id))} aria-label="Dismiss">×</button>
          </span>
        )}
        {error && <span className="notice error">{error}</span>}
      </td>
    </tr>
  );
};

// Search all assets and start tracking one (admin)
const AddTrackedAsset = ({ trackedIds, choices }) => {
  const dispatch = useDispatch();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [patternsSync, setPatternsSync] = useState(true);
  const [intervals, setIntervals] = useState(DEFAULT_SETUP_INTERVALS);
  const [candles, setCandles] = useState(DEFAULT_BACKFILL_CANDLES);
  const saving = useSelector((state) => (picked ? !!state.alerts.tracked.saving[picked.id] : false));
  const error = useSelector((state) => (picked ? state.alerts.tracked.rowErrors[picked.id] : null));

  // Debounced search on the base asset name
  useEffect(() => {
    const q = term.trim();
    if (q.length < 1 || picked) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      api.searchAssets(q)
        .then(({ data }) => { if (!cancelled) setResults(Array.isArray(data) ? data.slice(0, 20) : []); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, picked]);

  const add = async () => {
    const result = await dispatch(saveTrackedAsset({
      assetId: picked.id,
      patternsSync,
      setupIntervals: intervals,
      backfillCandles: candles,
    }));
    if (saveTrackedAsset.fulfilled.match(result)) {
      setPicked(null);
      setTerm('');
    }
  };

  const candlesValid = candles >= 100 && candles <= 10000;

  return (
    <section className="panel">
      <h3 className="panel-title">Track a new asset</h3>
      {!picked ? (
        <div className="asset-search">
          <input
            className="input"
            placeholder="Search by ticker, e.g. BTC, AAPL…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {(searching || results.length > 0) && (
            <ul className="asset-search-results">
              {searching && <li className="stats-muted">Searching…</li>}
              {results.map((a) => {
                const already = trackedIds.has(a.id);
                return (
                  <li key={a.id}>
                    <button disabled={already} onClick={() => setPicked(a)}>
                      <strong>{a.asset}/{a.quote}</strong>
                      <span className="stats-muted"> {a.full_name || ''}{a.kind ? ` · ${a.kind}` : ''}</span>
                      {already && <span className="stats-muted"> · already tracked</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="add-form">
          <div className="add-picked">
            <strong>{picked.asset}/{picked.quote}</strong>
            <span className="stats-muted">{picked.full_name}</span>
            <button className="btn-small" onClick={() => setPicked(null)}>Change</button>
          </div>
          <label className="add-field">
            <span className="stats-label">Pattern sync</span>
            <Switch checked={patternsSync} onChange={setPatternsSync} label="Nightly harmonic pattern sync" />
          </label>
          <div className="add-field">
            <span className="stats-label">Setup intervals</span>
            <IntervalChips choices={choices} value={intervals} onChange={setIntervals} />
          </div>
          <label className="add-field">
            <span className="stats-label">Backfill candles</span>
            <input
              className="input narrow"
              type="number"
              min="100"
              max="10000"
              step="500"
              value={candles}
              onChange={(e) => setCandles(Number(e.target.value))}
            />
          </label>
          <button className="btn-small primary" disabled={saving || !candlesValid} onClick={add}>
            {saving ? 'Adding…' : 'Add & backfill'}
          </button>
          {!candlesValid && <span className="notice error">Backfill must be 100–10000 candles</span>}
          {error && <span className="notice error">{error}</span>}
        </div>
      )}
    </section>
  );
};

const TrackedAssetsView = () => {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const { list, loading, error } = useSelector((state) => state.alerts.tracked);

  useEffect(() => {
    dispatch(fetchTrackedAssets());
  }, [dispatch]);

  const choices = useMemo(() => {
    const set = new Set(DEFAULT_SETUP_INTERVALS);
    list.forEach((t) => (t.setup_intervals || []).forEach((iv) => set.add(iv)));
    return sortIntervals([...set]);
  }, [list]);
  const trackedIds = useMemo(() => new Set(list.map((t) => t.asset_id)), [list]);
  const sorted = useMemo(() => [...list].sort((a, b) => `${a.asset}/${a.quote}`.localeCompare(`${b.asset}/${b.quote}`)), [list]);

  return (
    <div className="stats-view">
      <header className="stats-header">
        <h2 className="stats-title">Tracked assets</h2>
        <p className="stats-subtitle">
          The nightly pattern sync and the hourly setup tracking (with e-mail alerts) cover only these assets.
          Anything else is scanned on demand from the chart (SCAN).
          {!isAdmin && ' Only an administrator can change this list.'}
        </p>
      </header>

      {isAdmin && <AddTrackedAsset trackedIds={trackedIds} choices={choices} />}

      {error && <div className="stats-error">{error}</div>}

      <div className={`stats-table-wrap ${loading ? 'loading' : ''}`}>
        {sorted.length === 0 && !loading ? (
          <div className="stats-empty">No tracked assets yet.</div>
        ) : (
          <table className="stats-table tracked-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th title="Nightly harmonic pattern sync">Pattern sync</th>
                <th title="Intervals whose setups are tracked every hour; adding one starts a backfill">Setup intervals</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <TrackedRow key={row.asset_id} row={row} choices={choices} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TrackedAssetsView;
