import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { highlightSetup, setShowSetupsOnChart } from '../../store/slices/setupsSlice';
import { atr, distanceToPrz, currentR, formatR } from '../../utils/setupMath';
import { strengthTint } from './PatternStrength';

const fmtPrice = (v) => (v == null ? '—' : Number(v).toPrecision(6));
const fmtSigned = (v, digits, suffix) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}${suffix}`);

// Strongest first, unscored last, then most recently created
const byStrength = (a, b) => {
  const sa = a.strength?.score ?? -1;
  const sb = b.strength?.score ?? -1;
  return sb !== sa ? sb - sa : (b.created_time || 0) - (a.created_time || 0);
};

/**
 * Waiting / open setups for the asset and interval on the chart, strongest first.
 * Clicking one centers the chart on it, turns the SETUPS overlay on and pins it there.
 */
const ActiveSetups = ({ onCenter }) => {
  const dispatch = useDispatch();
  const { list, loading, error } = useSelector((state) => state.setups.active);
  const highlightedId = useSelector((state) => state.setups.highlightedId);
  const klines = useSelector((state) => state.chart.klines);
  const [collapsed, setCollapsed] = useState(false);

  const price = klines.length ? klines[klines.length - 1].close : null;
  // ATR(14) from the latest candles only - the rest of the loaded history doesn't change it
  const atrValue = useMemo(() => atr(klines.slice(-200)), [klines]);
  const sorted = useMemo(() => [...list].sort(byStrength), [list]);

  if (!loading && !error && list.length === 0) return null;

  const open = (s) => {
    dispatch(setShowSetupsOnChart(true));
    dispatch(highlightSetup(s.id));
    onCenter?.({ x_point_timestamp: s.x_time, d_point_timestamp: s.entry_time || s.c_time });
  };

  return (
    <section className="active-setups">
      <button type="button" className="active-setups-head" onClick={() => setCollapsed(!collapsed)}>
        <span className="active-setups-chevron">{collapsed ? '▸' : '▾'}</span>
        <span className="active-setups-title">Aktywne setupy</span>
        <span className="active-setups-count">{list.length}</span>
        {loading && <span className="active-setups-muted">⟳</span>}
      </button>

      {!collapsed && (
        <div className="active-setups-list">
          {error && <div className="active-setups-error">{error}</div>}
          {sorted.map((s) => {
            const tint = strengthTint(s.strength);
            const isOpen = s.status === 'open';
            const dist = !isOpen ? distanceToPrz(s, price, atrValue) : null;
            const r = isOpen ? currentR(s, price) : null;
            return (
              <button
                type="button"
                key={s.id}
                className={`active-setup ${tint ? 'has-strength' : ''} ${highlightedId === s.id ? 'pinned' : ''}`}
                style={tint ? { '--strength-tint': tint } : undefined}
                onClick={() => open(s)}
                title="Pokaż na wykresie"
              >
                <div className="active-setup-row">
                  <span className={`pattern-direction ${s.is_bullish ? 'bullish' : 'bearish'}`}>{s.is_bullish ? '▲' : '▼'}</span>
                  <span className="active-setup-name">{s.pattern_type}</span>
                  <span className={`setup-status-chip ${s.status}`}>{s.status.toUpperCase()}</span>
                  {s.strength?.score != null ? (
                    <span
                      className="active-setup-score"
                      title={`Siła ${s.strength.kind === 'pre' ? 'wstępna (przed wejściem, z konfluencji poziomowych)' : 'od wejścia'}: ${Math.round(s.strength.score)}/100 · szansa TP1 przed SL ${Math.round((s.strength.p_win || 0) * 100)}%`}
                    >
                      {Math.round(s.strength.score)}
                      {s.strength.kind === 'pre' && <span className="active-setup-pre">wstępna</span>}
                    </span>
                  ) : (
                    <span className="active-setup-score none" title="Brak oceny siły">–</span>
                  )}
                </div>

                {isOpen ? (
                  <div className="active-setup-levels">
                    <span>wejście {fmtPrice(s.entry_price)}</span>
                    <span className="neg">SL {fmtPrice(s.sl)}</span>
                    <span className="pos">TP1 {fmtPrice(s.tp1)}</span>
                    {r != null && <span className={`active-setup-r ${r > 0 ? 'pos' : r < 0 ? 'neg' : ''}`}>{formatR(r, 2)}</span>}
                  </div>
                ) : (
                  <div className="active-setup-levels">
                    <span>PRZ {fmtPrice(s.prz_min)}–{fmtPrice(s.prz_max)}</span>
                    {dist && (
                      <span title={dist.pct > 0 ? `Cena musi jeszcze przejść do krawędzi PRZ (${fmtPrice(dist.edge)})` : 'Cena jest już za bliższą krawędzią PRZ'}>
                        do PRZ {fmtSigned(dist.pct, 2, '%')}
                        {dist.atr != null && ` · ${fmtSigned(dist.atr, 1, ' ATR')}`}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ActiveSetups;
