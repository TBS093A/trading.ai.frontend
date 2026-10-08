import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAlertSettings,
  saveAlertSettings,
  sendTestAlert,
  resetTestAlert,
  fetchAlertEvents,
  fetchTrackedAssets,
} from '../../store/slices/alertsSlice';
import { setSelectedAsset } from '../../store/slices/assetsSlice';
import { setInterval as setChartInterval, focusChartAt } from '../../store/slices/chartSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import { setShowSetupsOnChart } from '../../store/slices/setupsSlice';
import { setMainView } from '../../store/slices/uiSlice';
import './AlertsViews.css';

const INTERVAL_ORDER = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
const STATUS_LABELS = {
  waiting: 'New setup (waiting)',
  open: 'Entered (open)',
  win: 'Win (TP1)',
  loss: 'Loss (SL)',
  expired: 'Expired',
  no_entry: 'No entry',
  invalidated: 'Invalidated',
};

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—');
const fmtPrice = (v) => (v == null ? '—' : Number(v).toPrecision(6));
const fmtR = (v) => (v == null ? '' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}R`);
const toggleIn = (list, value) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
const sameSet = (a, b) => (a || []).length === (b || []).length && (a || []).every((x) => (b || []).includes(x));

const StatusChip = ({ status }) => (status ? <span className={`st ${status}`}>{status.replace('_', ' ')}</span> : <span className="st new">new</span>);

const AlertSettingsForm = ({ tracked }) => {
  const dispatch = useDispatch();
  const { data, loading, saving, error, savedAt } = useSelector((state) => state.alerts.settings);
  const test = useSelector((state) => state.alerts.test);

  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [assetIds, setAssetIds] = useState([]); // empty = all tracked
  const [intervals, setIntervals] = useState([]); // empty = all tracked

  useEffect(() => {
    if (!data) return;
    setEmail(data.email || '');
    setEnabled(!!data.email_enabled);
    setStatuses(data.statuses || []);
    setAssetIds(data.asset_ids || []);
    setIntervals(data.intervals || []);
  }, [data]);

  const intervalChoices = useMemo(() => {
    const set = new Set();
    tracked.forEach((t) => (t.setup_intervals || []).forEach((iv) => set.add(iv)));
    (data?.intervals || []).forEach((iv) => set.add(iv));
    return [...set].sort((a, b) => INTERVAL_ORDER.indexOf(a) - INTERVAL_ORDER.indexOf(b));
  }, [tracked, data]);

  if (!data) {
    return <section className="panel">{loading ? 'Loading alert settings…' : error && <div className="stats-error">{error}</div>}</section>;
  }

  const dirty = email !== (data.email || '')
    || enabled !== !!data.email_enabled
    || !sameSet(statuses, data.statuses)
    || !sameSet(assetIds, data.asset_ids || [])
    || !sameSet(intervals, data.intervals || []);

  const save = () => {
    dispatch(resetTestAlert());
    dispatch(saveAlertSettings({
      email: email.trim() || null,
      email_enabled: enabled,
      statuses,
      asset_ids: assetIds.length ? assetIds : null,
      intervals: intervals.length ? intervals : null,
    }));
  };

  const testDisabled = dirty || !data.email || !data.smtp_configured || test.status === 'sending';
  const testHint = !data.smtp_configured ? 'Mail server not configured'
    : !data.email ? 'Save an e-mail address first'
      : dirty ? 'Save your changes first' : `Send a test e-mail to ${data.email}`;

  return (
    <section className="panel">
      <h3 className="panel-title">E-mail alerts</h3>

      {!data.smtp_configured && (
        <div className="notice-block warn">
          The mail server (SMTP) isn't configured yet. Your settings are saved and alerts will start going out
          once an administrator sets up mail.
        </div>
      )}

      <div className="alert-form">
        <label className="add-field">
          <span className="stats-label">E-mail</span>
          <input className="input" type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="add-field inline">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Send e-mails when a setup changes status</span>
        </label>

        <div className="add-field">
          <span className="stats-label">Notify about</span>
          <div className="checkbox-grid">
            {(data.available_statuses || []).map((st) => (
              <label key={st} className="checkbox-item">
                <input type="checkbox" checked={statuses.includes(st)} onChange={() => setStatuses(toggleIn(statuses, st))} />
                <StatusChip status={st} />
                <span className="stats-muted">{STATUS_LABELS[st] || st}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="add-field">
          <span className="stats-label">Assets <span className="stats-muted">({assetIds.length ? `${assetIds.length} selected` : 'all tracked'})</span></span>
          <div className="chip-group">
            {tracked.map((t) => (
              <button
                key={t.asset_id}
                type="button"
                className={`chip ${assetIds.includes(t.asset_id) ? 'active' : ''}`}
                aria-pressed={assetIds.includes(t.asset_id)}
                onClick={() => setAssetIds(toggleIn(assetIds, t.asset_id))}
              >
                {t.asset}/{t.quote}
              </button>
            ))}
            {tracked.length === 0 && <span className="stats-muted">No tracked assets yet</span>}
          </div>
        </div>

        <div className="add-field">
          <span className="stats-label">Intervals <span className="stats-muted">({intervals.length ? `${intervals.length} selected` : 'all tracked'})</span></span>
          <div className="chip-group">
            {intervalChoices.map((iv) => (
              <button
                key={iv}
                type="button"
                className={`chip ${intervals.includes(iv) ? 'active' : ''}`}
                aria-pressed={intervals.includes(iv)}
                onClick={() => setIntervals(toggleIn(intervals, iv))}
              >
                {iv}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-small primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-small" disabled={testDisabled} onClick={() => dispatch(sendTestAlert())} title={testHint}>
            {test.status === 'sending' ? 'Sending…' : 'Send test e-mail'}
          </button>
          {error && <span className="notice error">{error}</span>}
          {!error && savedAt && !dirty && <span className="notice ok">Saved</span>}
          {test.status === 'sent' && <span className="notice ok">Test e-mail sent to {test.message}</span>}
          {test.status === 'failed' && <span className="notice error">{test.message}</span>}
        </div>
      </div>
    </section>
  );
};

const AlertEvents = ({ tracked }) => {
  const dispatch = useDispatch();
  const { list, loading, error } = useSelector((state) => state.alerts.events);
  const [assetId, setAssetId] = useState('');
  const [interval, setIntervalFilter] = useState('');

  useEffect(() => {
    dispatch(fetchAlertEvents({ assetId, interval }));
  }, [dispatch, assetId, interval]);

  const intervals = useMemo(() => {
    const set = new Set();
    tracked.forEach((t) => (t.setup_intervals || []).forEach((iv) => set.add(iv)));
    return [...set].sort((a, b) => INTERVAL_ORDER.indexOf(a) - INTERVAL_ORDER.indexOf(b));
  }, [tracked]);

  // Open the chart on the event's asset/interval, centered on the event, with setups drawn
  const openOnChart = (ev) => {
    dispatch(setSelectedAsset({ id: ev.asset_id, asset: ev.asset, quote: ev.quote }));
    dispatch(clearAnalysis());
    dispatch(setChartInterval(ev.interval));
    dispatch(setShowSetupsOnChart(true));
    dispatch(focusChartAt({ time: ev.event_time, assetId: ev.asset_id, interval: ev.interval }));
    dispatch(setMainView('chart'));
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h3 className="panel-title">Recent setup events</h3>
        <select className="input compact" value={assetId} onChange={(e) => setAssetId(e.target.value)} aria-label="Asset">
          <option value="">All assets</option>
          {tracked.map((t) => <option key={t.asset_id} value={t.asset_id}>{t.asset}/{t.quote}</option>)}
        </select>
        <select className="input compact" value={interval} onChange={(e) => setIntervalFilter(e.target.value)} aria-label="Interval">
          <option value="">All intervals</option>
          {intervals.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
        </select>
        <button className="btn-small" onClick={() => dispatch(fetchAlertEvents({ assetId, interval }))} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="stats-error">{error}</div>}

      <div className={`stats-table-wrap ${loading ? 'loading' : ''}`}>
        {list.length === 0 && !loading ? (
          <div className="stats-empty">No setup events yet. They appear when a tracked setup is created or changes status.</div>
        ) : (
          <table className="stats-table events-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Asset</th>
                <th>Setup</th>
                <th>Change</th>
                <th className="num">Entry</th>
                <th className="num">SL</th>
                <th className="num">TP1</th>
                <th className="num">Result</th>
                <th title="When the e-mail went out">E-mail</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((ev) => {
                const p = ev.payload || {};
                return (
                  <tr key={ev.id}>
                    <td>{fmtTime(ev.event_time)}</td>
                    <td className="group-cell">{ev.asset}/{ev.quote} <span className="stats-muted">{ev.interval}</span></td>
                    <td>
                      {ev.pattern_type}{' '}
                      <span className={ev.is_bullish ? 'pos' : 'neg'}>{ev.is_bullish ? 'long' : 'short'}</span>
                    </td>
                    <td><StatusChip status={ev.from_status} /> → <StatusChip status={ev.to_status} /></td>
                    <td className="num">{fmtPrice(p.entry_price)}</td>
                    <td className="num neg">{fmtPrice(p.sl)}</td>
                    <td className="num pos">{fmtPrice(p.tp1)}</td>
                    <td className={`num ${p.r_multiple > 0 ? 'pos' : p.r_multiple < 0 ? 'neg' : ''}`}>{fmtR(p.r_multiple)}</td>
                    <td className="stats-muted">{ev.notified_at ? `✓ ${fmtTime(ev.notified_at)}` : '—'}</td>
                    <td><button className="btn-small" onClick={() => openOnChart(ev)}>Chart</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

const AlertsView = () => {
  const dispatch = useDispatch();
  const tracked = useSelector((state) => state.alerts.tracked.list);

  useEffect(() => {
    dispatch(fetchAlertSettings());
    dispatch(fetchTrackedAssets());
  }, [dispatch]);

  return (
    <div className="stats-view">
      <header className="stats-header">
        <h2 className="stats-title">Alerts</h2>
        <p className="stats-subtitle">
          Setups on tracked assets are updated every hour. Choose which status changes you want by e-mail.
        </p>
      </header>
      <AlertSettingsForm tracked={tracked} />
      <AlertEvents tracked={tracked} />
    </div>
  );
};

export default AlertsView;
