import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import api from '../../services/api';
import { formatApiError } from '../../store/slices/harmonicsSlice';
import { setSelectedAsset } from '../../store/slices/assetsSlice';
import { setInterval as setChartInterval, focusChartAt } from '../../store/slices/chartSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import { setShowSetupsOnChart, highlightSetup } from '../../store/slices/setupsSlice';
import { setMainView } from '../../store/slices/uiSlice';
import SetupMiniChart from './SetupMiniChart';
import { price, rFmt, signedMoney, dateTime, tone, dash, EVENT_LABELS } from './tradingFormat';
import HtfTrendBadge from './HtfTrendBadge';

const toMs = (v) => (v == null ? null : typeof v === 'number' ? v : Date.parse(v));

// Everything that happened to the signal, in time order: setup -> signal -> orders -> position -> events
const buildTimeline = ({ signal, setup, orders, position, events }) => {
  const items = [];
  if (setup?.created_time) items.push({ t: setup.created_time, kind: 'setup', title: 'Setup wykryty', text: `${setup.pattern_type} ${setup.is_bullish ? 'long' : 'short'}, PRZ ${price(setup.prz_min)}–${price(setup.prz_max)}` });
  if (signal) items.push({ t: toMs(signal.created_at), kind: `signal ${signal.status}`, title: `Sygnał: ${signal.status}`, text: signal.reason || `wejście ${price(signal.entry_price)}, SL ${price(signal.sl)}, TP ${price(signal.tp)}` });
  (orders || []).forEach((o) => {
    items.push({ t: o.placed_time, kind: 'order', title: `Zlecenie ${o.purpose} złożone`, text: `${o.order_type} ${o.side} ${Number(o.qty).toPrecision(4)} @ ${price(o.price)}` });
    if (o.filled_time) items.push({ t: o.filled_time, kind: 'fill', title: `Zlecenie ${o.purpose} wypełnione`, text: `@ ${price(o.avg_fill_price)}, opłata ${o.fee ?? 0}` });
  });
  if (position?.opened_time) items.push({ t: position.opened_time, kind: 'position', title: 'Pozycja otwarta', text: `${position.direction} ${Number(position.qty).toPrecision(4)} @ ${price(position.entry_price)}` });
  if (position?.closed_time) items.push({ t: position.closed_time, kind: `close ${position.r_multiple > 0 ? 'win' : 'loss'}`, title: `Pozycja zamknięta (${position.exit_reason})`, text: `@ ${price(position.exit_price)} · ${rFmt(position.r_multiple)}` });
  (events || []).forEach((e) => items.push({ t: e.market_time || toMs(e.created_at), kind: `event ${e.kind}`, title: EVENT_LABELS[e.kind] || e.kind, text: e.message, event: e }));
  return items.filter((i) => i.t).sort((a, b) => a.t - b.t);
};

const SignalTrace = ({ signalId, currency = 'USDT', onClose }) => {
  const dispatch = useDispatch();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let alive = true;
    api.getSignalTrace(signalId)
      .then(({ data }) => alive && setState({ loading: false, error: null, data }))
      .catch((error) => alive && setState({ loading: false, error: formatApiError(error, 'Nie udało się wczytać ścieżki'), data: null }));
    return () => { alive = false; };
  }, [signalId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const timeline = useMemo(() => (state.data ? buildTimeline(state.data) : []), [state.data]);
  const { signal, setup, position } = state.data || {};

  // Open the setup on the main chart: asset + interval, SETUPS overlay with this setup pinned
  const showOnChart = () => {
    if (!signal) return;
    const [base, quote] = (signal.symbol || '').includes('/') ? signal.symbol.split('/') : [signal.symbol, ''];
    dispatch(setSelectedAsset({ id: signal.asset_id, asset: base, quote }));
    dispatch(clearAnalysis());
    dispatch(setChartInterval(signal.interval));
    dispatch(setShowSetupsOnChart(true));
    if (setup?.id) dispatch(highlightSetup(setup.id));
    const t = position?.opened_time || setup?.created_time || toMs(signal.created_at);
    if (t) dispatch(focusChartAt({ time: t, assetId: signal.asset_id, interval: signal.interval }));
    dispatch(setMainView('chart'));
    onClose();
  };

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal trace-modal" role="dialog" aria-modal="true" aria-label="Ścieżka sygnału" onClick={(e) => e.stopPropagation()}>
        <div className="trace-head">
          <h3>Ścieżka sygnału #{signalId}</h3>
          {signal && <span className="stats-muted">{signal.symbol} · {signal.interval} · {signal.pattern_type} · {signal.direction}</span>}
          <button className="account-modal-close" onClick={onClose} aria-label="Zamknij">×</button>
        </div>

        <div className="trace-body">
          {state.loading && <div className="stats-empty">Ładowanie…</div>}
          {state.error && <div className="stats-error">{state.error}</div>}
          {state.data && (
            <>
              <div className="trace-summary">
                <span className={`sig-status ${signal.status}`}>{signal.status}</span>
                {signal.reason && <span className="sig-reason">{signal.reason}</span>}
                <span>siła {signal.strength ?? dash}{signal.p_win != null ? ` · p(TP) ${Math.round(signal.p_win * 100)}%` : ''}{signal.ev != null ? ` · EV ${rFmt(signal.ev)}` : ''}</span>
                {position?.pnl != null && <span className={tone(position.pnl)}>wynik {signedMoney(position.pnl, currency)} ({rFmt(position.r_multiple)})</span>}
                <button className="btn-small primary" onClick={showOnChart}>Pokaż na wykresie</button>
              </div>

              <SetupMiniChart setup={setup} signal={signal} position={position} />

              <ol className="trace-timeline">
                {timeline.map((i, idx) => (
                  <li key={`${i.t}-${idx}`} className={i.kind}>
                    <span className="trace-time">{dateTime(i.t)}</span>
                    <span className="trace-title">{i.title}{i.event && <HtfTrendBadge event={i.event} />}</span>
                    <span className="trace-text">{i.text}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignalTrace;
