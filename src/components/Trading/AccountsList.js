import React from 'react';
import { money, pctSigned, pct, rFmt, tone } from './tradingFormat';

const statusOf = (a) => {
  if (a.kill_switch) return { cls: 'killed', label: 'KILL SWITCH' };
  if (!a.enabled) return { cls: 'disabled', label: 'wyłączone' };
  return { cls: 'active', label: 'aktywne' };
};

const AccountsList = ({ accounts, onOpen }) => (
  <div className="account-tiles">
    {accounts.map((a) => {
      const st = statusOf(a);
      const cur = a.base_currency || 'USDT';
      return (
        <button type="button" key={a.id} className={`account-tile ${st.cls}`} onClick={() => onOpen(a.id)}>
          <span className="account-tile-head">
            <span className="account-name">{a.name}</span>
            <span className={`account-status ${st.cls}`}>{st.label}</span>
          </span>
          <span className="account-equity">{money(a.equity, cur, 0)}</span>
          <span className="account-row">
            <span className={tone(a.return_pct)}>{pctSigned(a.return_pct)}</span>
            <span className="stats-muted">obsunięcie {pct(a.drawdown_pct)}</span>
          </span>
          <span className="account-row stats-muted">
            <span>otwarte {a.stats?.open ?? 0}</span>
            <span>zamknięte {a.stats?.closed ?? 0}</span>
            <span>avg {rFmt(a.stats?.avg_r)}</span>
          </span>
          <span className="account-row stats-muted">
            <span>{a.exchange}</span>
            <span>start {money(a.starting_equity, cur, 0)}</span>
          </span>
        </button>
      );
    })}
  </div>
);

export default AccountsList;
