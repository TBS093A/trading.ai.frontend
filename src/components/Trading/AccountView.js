import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import { selectIsAdmin } from '../../store/slices/authSlice';
import { updateTradingAccount, setAccountKillSwitch, resetTradingSave } from '../../store/slices/tradingSlice';
import { LineChart } from '../Stats/charts/MiniCharts';
import RiskFields from './RiskFields';
import RiskPreview from './RiskPreview';
import SignalTrace from './SignalTrace';
import { money, signedMoney, pctSigned, pct, rFmt, price, dateTime, tone, dash, EVENT_LABELS } from './tradingFormat';

const REFRESH_MS = 60000;
const SIGNAL_FILTERS = [
  ['', 'Wszystkie'], ['armed', 'Uzbrojone'], ['entered', 'Wejście'], ['closed', 'Zamknięte'],
  ['cancelled', 'Anulowane'], ['rejected', 'Odrzucone'],
];
const EXIT_LABELS = { tp: 'TP', sl: 'SL', timeout: 'limit czasu' };

// Unrealised P&L / R of an open position at its mark price
const openPnl = (p) => {
  if (p.mark_price == null) return { pnl: null, r: null };
  const dir = p.direction === 'long' ? 1 : -1;
  const pnl = dir * (p.mark_price - p.entry_price) * p.qty;
  const risk = Math.abs(p.entry_price - p.sl) * p.qty;
  return { pnl, r: risk > 0 ? pnl / risk : null };
};

const useAccountData = (accountId, signalStatus) => {
  const [state, setState] = useState({ loading: true, error: null });
  const load = useCallback(async () => {
    try {
      const [acc, eq, open, closed, sig, ord, ev, cmp] = await Promise.all([
        api.getTradingAccount(accountId),
        api.getAccountEquity(accountId),
        api.getAccountPositions(accountId, 'open'),
        api.getAccountPositions(accountId, 'closed'),
        api.getAccountSignals(accountId, { limit: 200, ...(signalStatus ? { status: signalStatus } : {}) }),
        api.getAccountOrders(accountId, { limit: 200 }),
        api.getAccountEvents(accountId, 200),
        api.getAccountCompare(accountId).catch(() => ({ data: null })),
      ]);
      setState({
        loading: false, error: null,
        account: acc.data,
        equity: eq.data.equity || [],
        open: open.data.positions || [],
        closed: closed.data.positions || [],
        signals: sig.data.signals || [],
        orders: ord.data.orders || [],
        events: ev.data.events || [],
        compare: cmp.data,
      });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error?.response?.data?.detail || 'Nie udało się wczytać konta' }));
    }
  }, [accountId, signalStatus]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);
  return [state, load];
};

const Tile = ({ label, value, sub, cls, title }) => (
  <div className="sm-tile" title={title}>
    <span className="sm-tile-label">{label}</span>
    <span className={`sm-tile-value ${cls || ''}`}>{value}</span>
    {sub && <span className="sm-tile-sub">{sub}</span>}
  </div>
);

const KillSwitchDialog = ({ on, onConfirm, onCancel, busy }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="account-modal-overlay" onClick={onCancel}>
      <div className="account-modal ks-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ks-modal-body">
          <h3>{on ? 'Włączyć kill switch?' : 'Wyłączyć kill switch?'}</h3>
          <p>
            {on
              ? 'Konto przestanie otwierać nowe transakcje i uzbrajać sygnały, dopóki go ręcznie nie wyłączysz. Otwarte pozycje są prowadzone dalej do SL/TP.'
              : 'Konto wróci do handlu na nowych sygnałach przy obecnych ustawieniach ryzyka.'}
          </p>
          {on && (
            <label className="add-field">
              <span className="stats-label">Powód (widoczny na koncie i w dzienniku)</span>
              <input className="input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="np. przegląd strategii" />
            </label>
          )}
          <div className="form-actions">
            <button className="btn-small" onClick={onCancel}>Anuluj</button>
            <button className={`btn-small ${on ? 'ks-confirm' : 'primary'}`} disabled={busy} onClick={() => onConfirm(reason)}>
              {busy ? '…' : on ? 'Tak, zatrzymaj konto' : 'Tak, wznów handel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountView = ({ accountId, onBack }) => {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const { meta, save } = useSelector((state) => state.trading);
  const [signalStatus, setSignalStatus] = useState('');
  const [{ loading, error, account, equity, open, closed, signals, orders, events, compare }, reload] = useAccountData(accountId, signalStatus);
  const [tab, setTab] = useState('signals');
  const [traceId, setTraceId] = useState(null);
  const [ksDialog, setKsDialog] = useState(null); // true = turn on, false = turn off
  const [editing, setEditing] = useState(false);
  const [risk, setRisk] = useState(null);

  useEffect(() => { dispatch(resetTradingSave()); }, [dispatch]);

  if (loading && !account) return <div className="stats-empty">Ładowanie konta…</div>;
  if (!account) return <div className="stats-error">{error}</div>;

  const cur = account.base_currency || 'USDT';
  const st = account.stats || {};

  const toggleEnabled = async () => {
    await dispatch(updateTradingAccount({ accountId, body: { enabled: !account.enabled } }));
    reload();
  };
  const confirmKs = async (reason) => {
    const res = await dispatch(setAccountKillSwitch({ accountId, on: ksDialog, reason: reason || null }));
    if (setAccountKillSwitch.fulfilled.match(res)) setKsDialog(null);
    reload();
  };
  const saveRisk = async () => {
    const res = await dispatch(updateTradingAccount({ accountId, body: { risk } }));
    if (updateTradingAccount.fulfilled.match(res)) setEditing(false);
    reload();
  };

  return (
    <div className="account-view">
      <header className="stats-header sm-header">
        <div>
          <button className="link-btn" onClick={onBack}>← Wszystkie konta</button>
          <h2 className="stats-title">{account.name}</h2>
          <p className="stats-subtitle">
            {account.exchange} · wejście: {account.entry_mode === 'touch' ? 'limit na bliższej krawędzi PRZ' : account.entry_mode}
            {' '}· utworzone {dateTime(Date.parse(account.created_at))}
          </p>
        </div>
        {isAdmin && (
          <div className="sm-actions">
            <button className="btn-small" onClick={toggleEnabled} disabled={save.status === 'saving'}>
              {account.enabled ? 'Wyłącz konto' : 'Włącz konto'}
            </button>
            <button className="btn-small" onClick={() => { setRisk({ ...meta.defaults, ...account.risk_json }); setEditing(!editing); }}>
              {editing ? 'Zamknij ustawienia' : 'Ustawienia ryzyka'}
            </button>
            <button className={`ks-button ${account.kill_switch ? 'off' : ''}`} onClick={() => setKsDialog(!account.kill_switch)}>
              {account.kill_switch ? 'Wyłącz kill switch' : 'KILL SWITCH'}
            </button>
          </div>
        )}
      </header>

      {account.kill_switch && (
        <div className="notice-block danger-block">
          <strong>Kill switch włączony</strong> - konto nie otwiera nowych transakcji. Powód: {account.kill_reason || 'brak'}.
        </div>
      )}
      {!account.enabled && !account.kill_switch && <div className="notice-block warn">Konto jest wyłączone - nie przyjmuje nowych sygnałów.</div>}
      {save.status === 'failed' && <div className="stats-error">{save.error}</div>}
      {error && <div className="stats-error">{error}</div>}

      {editing && risk && (
        <section className="sm-card">
          <h3 className="sm-card-title">Ustawienia ryzyka</h3>
          <p className="sm-card-sub">Zmiany działają od następnego sygnału; otwarte pozycje zostają bez zmian.</p>
          <div className="wizard-split">
            <div>
              <RiskFields fields={meta.fields} values={risk} onChange={setRisk} baseline={account.risk_json} disabled={!isAdmin} />
              <div className="form-actions">
                <button className="btn-small primary" onClick={saveRisk} disabled={save.status === 'saving'}>Zapisz ustawienia</button>
                <button className="btn-small" onClick={() => setEditing(false)}>Anuluj</button>
              </div>
            </div>
            <RiskPreview settings={risk} startEquity={account.starting_equity} presets={meta.presets} currency={cur} />
          </div>
        </section>
      )}

      <div className="sm-tiles account-tiles-row">
        <Tile label="Kapitał" value={money(account.equity, cur)} sub={`gotówka ${money(account.cash, cur)}`} />
        <Tile label="Zwrot" value={pctSigned(account.return_pct)} cls={tone(account.return_pct)} sub={`start ${money(account.starting_equity, cur, 0)}`} />
        <Tile label="Obsunięcie od szczytu" value={pct(account.drawdown_pct)} sub={`szczyt ${money(account.peak_equity, cur, 0)}`} />
        <Tile label="Niezrealizowany wynik" value={signedMoney(account.unrealized_pnl, cur)} cls={tone(account.unrealized_pnl)} sub={`${st.open ?? 0} otwartych`} />
        <Tile label="Zrealizowany wynik" value={signedMoney(st.realized_pnl, cur)} cls={tone(st.realized_pnl)} sub={`opłaty ${money(st.fees, cur)}`} />
        <Tile label="Transakcje" value={st.closed ?? 0} sub={`wygrane ${st.wins ?? 0} · avg ${rFmt(st.avg_r)}`} />
        <Tile
          label="Konto vs backtest"
          value={compare?.execution_cost_r != null ? `${rFmt(compare.execution_cost_r)} / transakcję` : dash}
          cls={compare?.execution_cost_r != null ? tone(-compare.execution_cost_r) : ''}
          title="Koszt wykonania = średnie R backtestu tych samych setupów − średnie R konta. Dodatni: konto zarabia mniej niż backtest (opłaty, poślizg, odrzucenia przez limity). Ujemny: lepiej niż backtest."
          sub={compare ? `koszt wykonania · konto ${rFmt(compare.account_avg_r)} vs backtest ${rFmt(compare.backtest_avg_r)} (${compare.paired}/${compare.trades} sparowanych)` : 'brak danych'}
        />
      </div>

      <section className="sm-card">
        <h3 className="sm-card-title">Krzywa kapitału</h3>
        <p className="sm-card-sub">Migawka co godzinę: gotówka + niezrealizowany wynik otwartych pozycji.</p>
        <LineChart
          series={[{ key: 'eq', label: 'Kapitał', color: '#3987e5', points: equity.map((e) => ({ x: Date.parse(e.market_time) || e.market_time, y: e.equity })) }]}
          height={220}
          yFormat={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          refLines={[{ y: account.starting_equity, label: 'start' }]}
          empty="Brak migawek - pojawią się po pierwszym godzinnym przebiegu"
        />
      </section>

      <section className="sm-card">
        <h3 className="sm-card-title">Otwarte pozycje ({open.length})</h3>
        <div className="stats-table-wrap">
          {open.length === 0 ? <div className="stats-empty">Brak otwartych pozycji</div> : (
            <table className="stats-table">
              <thead><tr><th>Symbol</th><th>Kierunek</th><th className="num">Ilość</th><th className="num">Wejście</th><th className="num">Cena teraz</th><th className="num">SL</th><th className="num">TP</th><th className="num">Wynik</th><th className="num">R</th><th>Otwarta</th></tr></thead>
              <tbody>
                {open.map((p) => {
                  const u = openPnl(p);
                  return (
                    <tr key={p.id} className="clickable" onClick={() => p.signal_id && setTraceId(p.signal_id)}>
                      <td className="group-cell">{p.symbol}</td>
                      <td className={p.direction === 'long' ? 'pos' : 'neg'}>{p.direction}</td>
                      <td className="num">{Number(p.qty).toPrecision(4)}</td>
                      <td className="num">{price(p.entry_price)}</td>
                      <td className="num">{price(p.mark_price)}</td>
                      <td className="num neg">{price(p.sl)}</td>
                      <td className="num pos">{price(p.tp)}</td>
                      <td className={`num ${tone(u.pnl)}`}>{signedMoney(u.pnl, cur)}</td>
                      <td className={`num ${tone(u.r)}`}>{rFmt(u.r)}</td>
                      <td>{dateTime(p.opened_time)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="sm-card">
        <nav className="hub-tabs inline-tabs" role="tablist">
          {[['signals', `Sygnały (${signals.length})`], ['positions', `Pozycje (${closed.length})`], ['orders', `Zlecenia (${orders.length})`], ['events', `Dziennik (${events.length})`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`hub-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>

        {tab === 'signals' && (
          <>
            <div className="chip-group signal-filters">
              {SIGNAL_FILTERS.map(([v, l]) => (
                <button key={l} type="button" className={`chip ${signalStatus === v ? 'active' : ''} ${v === 'rejected' ? 'chip-rejected' : ''}`} onClick={() => setSignalStatus(v)}>{l}</button>
              ))}
            </div>
            {signalStatus === 'rejected' && (
              <p className="sm-card-sub">Sygnały, które przepadły: setup przeszedł filtry, ale limity ryzyka konta go zablokowały. Powód przy każdym.</p>
            )}
            <div className="stats-table-wrap">
              {signals.length === 0 ? <div className="stats-empty">Brak sygnałów</div> : (
                <table className="stats-table">
                  <thead><tr><th>Utworzony</th><th>Symbol</th><th>Formacja</th><th>Kierunek</th><th className="num">Wejście</th><th className="num">SL</th><th className="num">TP</th><th className="num">Siła</th><th className="num">EV</th><th>Status</th><th>Powód</th></tr></thead>
                  <tbody>
                    {signals.map((s) => (
                      <tr key={s.id} className="clickable" onClick={() => setTraceId(s.id)} title="Pokaż ścieżkę sygnału">
                        <td>{dateTime(Date.parse(s.created_at))}</td>
                        <td className="group-cell">{s.symbol} <span className="stats-muted">{s.interval}</span></td>
                        <td>{s.pattern_type}</td>
                        <td className={s.direction === 'long' ? 'pos' : 'neg'}>{s.direction}</td>
                        <td className="num">{price(s.entry_price)}</td>
                        <td className="num neg">{price(s.sl)}</td>
                        <td className="num pos">{price(s.tp)}</td>
                        <td className="num">{s.strength ?? dash}</td>
                        <td className={`num ${tone(s.ev)}`}>{s.ev == null ? dash : rFmt(s.ev)}</td>
                        <td><span className={`sig-status ${s.status}`}>{s.status}</span></td>
                        <td className="sig-reason">{s.reason || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'positions' && (
          <div className="stats-table-wrap">
            {closed.length === 0 ? <div className="stats-empty">Brak zamkniętych pozycji</div> : (
              <table className="stats-table">
                <thead><tr><th>Zamknięta</th><th>Symbol</th><th>Kierunek</th><th className="num">Wejście</th><th className="num">Wyjście</th><th>Powód</th><th className="num">Ryzyko</th><th className="num">Opłaty</th><th className="num">Wynik</th><th className="num">R</th></tr></thead>
                <tbody>
                  {closed.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => p.signal_id && setTraceId(p.signal_id)}>
                      <td>{dateTime(p.closed_time)}</td>
                      <td className="group-cell">{p.symbol}</td>
                      <td className={p.direction === 'long' ? 'pos' : 'neg'}>{p.direction}</td>
                      <td className="num">{price(p.entry_price)}</td>
                      <td className="num">{price(p.exit_price)}</td>
                      <td>{EXIT_LABELS[p.exit_reason] || p.exit_reason || dash}</td>
                      <td className="num">{money(p.risk_amount, cur)}</td>
                      <td className="num">{money(p.fees, cur)}</td>
                      <td className={`num ${tone(p.pnl)}`}>{signedMoney(p.pnl, cur)}</td>
                      <td className={`num ${tone(p.r_multiple)}`}>{rFmt(p.r_multiple)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="stats-table-wrap">
            {orders.length === 0 ? <div className="stats-empty">Brak zleceń</div> : (
              <table className="stats-table">
                <thead><tr><th>Złożone</th><th>Symbol</th><th>Cel</th><th>Typ</th><th>Strona</th><th className="num">Cena</th><th className="num">Ilość</th><th className="num">Wypełnione</th><th className="num">Śr. cena</th><th className="num">Opłata</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className={o.signal_id ? 'clickable' : ''} onClick={() => o.signal_id && setTraceId(o.signal_id)} title={o.client_order_id}>
                      <td>{dateTime(o.placed_time)}</td>
                      <td className="group-cell">{o.symbol}</td>
                      <td>{o.purpose}</td>
                      <td>{o.order_type}</td>
                      <td className={o.side === 'buy' ? 'pos' : 'neg'}>{o.side} <span className="stats-muted">{o.position_side}</span></td>
                      <td className="num">{price(o.price)}</td>
                      <td className="num">{Number(o.qty).toPrecision(4)}</td>
                      <td className="num">{Number(o.filled_qty || 0).toPrecision(4)}</td>
                      <td className="num">{price(o.avg_fill_price)}</td>
                      <td className="num">{money(o.fee, cur)}</td>
                      <td><span className={`sig-status ${o.status}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'events' && (
          <ul className="event-log">
            {events.length === 0 && <li className="stats-muted">Brak wpisów</li>}
            {events.map((e, i) => (
              <li key={`${e.created_at}-${i}`} className={`event ${e.kind}`}>
                <span className="event-time">{dateTime(e.market_time || Date.parse(e.created_at))}</span>
                <span className="event-kind">{EVENT_LABELS[e.kind] || e.kind}</span>
                <span className="event-msg">{e.message}</span>
                {e.signal_id && <button className="link-btn" onClick={() => setTraceId(e.signal_id)}>ścieżka</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {traceId && <SignalTrace signalId={traceId} currency={cur} onClose={() => setTraceId(null)} />}
      {ksDialog != null && <KillSwitchDialog on={ksDialog} busy={save.status === 'saving'} onCancel={() => setKsDialog(null)} onConfirm={confirmKs} />}
    </div>
  );
};

export default AccountView;
