import React from 'react';
import { useWidth } from '../Stats/charts/MiniCharts';

/**
 * Small drawing of a setup: X-A-B-C legs, the PRZ band and the trade levels (entry / SL / TP),
 * with the entry and exit marked on the time axis when they happened.
 */
const SetupMiniChart = ({ setup, signal, position, height = 180 }) => {
  const [ref, w] = useWidth();
  const pts = setup?.points_json || {};
  const legs = ['X', 'A', 'B', 'C'].filter((n) => pts[n]).map((n) => ({ n, t: pts[n].time, p: pts[n].price }));
  if (legs.length < 2) return <div ref={ref} className="mc-empty" style={{ height }}>Brak punktów setupu</div>;

  const entry = position?.entry_price ?? signal?.entry_price ?? setup?.entry_price;
  const sl = position?.sl ?? signal?.sl ?? setup?.sl;
  const tp = position?.tp ?? signal?.tp ?? setup?.tp1;
  const tEntry = position?.opened_time ?? setup?.entry_time;
  const tExit = position?.closed_time ?? setup?.exit_time;
  const tEnd = Math.max(legs[legs.length - 1].t, tExit || 0, tEntry || 0) || legs[legs.length - 1].t;
  const span = tEnd - legs[0].t || 1;
  const t1 = tEnd + span * 0.08;

  const prices = [...legs.map((l) => l.p), setup?.prz_min, setup?.prz_max, entry, sl, tp, position?.exit_price].filter((v) => v != null);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = (hi - lo) * 0.08 || hi * 0.01;
  const L = 8; const R = 64; const T = 10; const B = 18;
  const W = w || 300;
  const x = (t) => L + ((t - legs[0].t) / (t1 - legs[0].t)) * (W - L - R);
  const y = (p) => T + (1 - (p - (lo - pad)) / (hi + pad - (lo - pad))) * (height - T - B);
  const bull = setup?.is_bullish ?? signal?.direction === 'long';

  const level = (v, cls, label) => (v == null ? null : (
    <g key={label}>
      <line className={`smc-level ${cls}`} x1={x(legs[legs.length - 1].t)} x2={W - R} y1={y(v)} y2={y(v)} />
      <text className={`smc-label ${cls}`} x={W - R + 4} y={y(v)} dy="0.32em">{label}</text>
    </g>
  ));

  return (
    <div ref={ref} className="mc-wrap smc">
      {w > 0 && (
        <svg width={W} height={height} role="img" aria-label="Setup">
          {setup?.prz_min != null && (
            <rect className="smc-prz" x={x(legs[legs.length - 1].t)} width={W - R - x(legs[legs.length - 1].t)}
              y={y(setup.prz_max)} height={Math.max(2, y(setup.prz_min) - y(setup.prz_max))} />
          )}
          <path className="smc-legs" d={legs.map((l, i) => `${i ? 'L' : 'M'}${x(l.t)},${y(l.p)}`).join(' ')} />
          {legs.map((l) => (
            <g key={l.n}>
              <circle className="mc-dot smc-pt" cx={x(l.t)} cy={y(l.p)} r="4" />
              <text className="smc-pt-label" x={x(l.t)} y={y(l.p) + ((l.n === 'X' || l.n === 'B') === bull ? 14 : -8)} textAnchor="middle">{l.n}</text>
            </g>
          ))}
          {level(tp, 'tp', 'TP')}
          {level(entry, 'entry', 'wejście')}
          {level(sl, 'sl', 'SL')}
          {tEntry && <line className="smc-time" x1={x(tEntry)} x2={x(tEntry)} y1={T} y2={height - B} />}
          {tEntry && <text className="smc-time-label" x={x(tEntry)} y={height - 4} textAnchor="middle">wejście</text>}
          {tExit && <line className="smc-time" x1={x(tExit)} x2={x(tExit)} y1={T} y2={height - B} />}
          {tExit && <text className="smc-time-label" x={x(tExit)} y={height - 4} textAnchor="middle">wyjście</text>}
          {position?.exit_price != null && tExit && <circle className="smc-exit" cx={x(tExit)} cy={y(position.exit_price)} r="5" />}
        </svg>
      )}
    </div>
  );
};

export default SetupMiniChart;
