import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MiniCharts.css';

/**
 * Small SVG charts for the stats dashboards. Conventions (see dataviz guidance):
 * 2px lines, bars <= 24px with a 4px rounded data end, hairline recessive grid, one y axis,
 * hover tooltip on every chart, legend for 2+ series, text in text colors (never series colors).
 */

const M = { top: 14, right: 16, bottom: 26, left: 46 };

export const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
};

// ~count "nice" ticks covering [min, max]
export const niceTicks = (min, max, count = 4) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.floor(min / step + 1e-9) * step;
  const ticks = [];
  // Last tick is the first one at or above max, so the top value never sits above the grid
  for (let i = 0; ; i++) {
    const v = Number((start + i * step).toFixed(10));
    ticks.push(v);
    if (v >= max - 1e-9 || i > 50) break;
  }
  return ticks;
};

const scale = (d0, d1, r0, r1) => (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

const Tooltip = ({ tip, width }) => {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x + 12, 4), Math.max(4, width - 190));
  return (
    <div className="mc-tooltip" style={{ left, top: Math.max(0, tip.y - 10) }}>
      {tip.title && <div className="mc-tooltip-title">{tip.title}</div>}
      {tip.rows.map((r) => (
        <div key={r.label} className="mc-tooltip-row">
          {r.color && <span className="mc-key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span className="mc-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
};

export const Legend = ({ items, kind = 'line' }) => (
  <div className="mc-legend">
    {items.map((it) => (
      <span key={it.label} className="mc-legend-item">
        <span
          className={`${kind === 'line' ? 'mc-key' : 'mc-swatch'} ${it.dashed ? 'dashed' : ''}`}
          style={it.dashed ? { color: it.color } : { background: it.color }}
        />
        {it.label}
      </span>
    ))}
  </div>
);

const YAxis = ({ ticks, y, w, format }) => (
  <g>
    {ticks.map((t) => (
      <g key={t}>
        <line className="mc-grid" x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} />
        <text className="mc-tick" x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{format(t)}</text>
      </g>
    ))}
  </g>
);

/**
 * Lines over time. series: [{ key, label, color, points: [{ x: ms, y }] }]
 */
export const LineChart = ({ series, height = 200, yDomain, yFormat = (v) => v, xFormat, refLines = [], xRefLines = [], empty = 'Brak danych' }) => {
  const [ref, w] = useWidth();
  const [tip, setTip] = useState(null);
  const all = series.flatMap((s) => s.points.filter((p) => p.y != null));
  const xs = useMemo(() => [...new Set(all.map((p) => p.x))].sort((a, b) => a - b), [all]);

  if (all.length === 0) return <div ref={ref} className="mc-empty" style={{ height }}>{empty}</div>;

  const ys = all.map((p) => p.y).concat(refLines.map((r) => r.y));
  const [y0, y1] = yDomain || [Math.min(...ys), Math.max(...ys)];
  const ticks = niceTicks(y0, y1);
  const yMin = Math.min(y0, ticks[0]);
  const yMax = Math.max(y1, ticks[ticks.length - 1]);
  const x = scale(xs[0], xs[xs.length - 1], M.left + 6, (w || 300) - M.right - 6);
  const y = scale(yMin, yMax, height - M.bottom, M.top);
  const fmtX = xFormat || ((v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = xs[0];
    xs.forEach((v) => { if (Math.abs(x(v) - px) < Math.abs(x(best) - px)) best = v; });
    const rows = series.map((s) => {
      const pts = s.points.filter((p) => p.y != null);
      if (!pts.length) return null;
      const near = pts.reduce((a, b) => (Math.abs(b.x - best) < Math.abs(a.x - best) ? b : a));
      return { label: s.label, color: s.color, value: yFormat(near.y) };
    }).filter(Boolean);
    setTip({ x: x(best), y: M.top, title: fmtX(best), rows, at: best });
  };

  const xTicks = xs.length <= 6 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];

  return (
    <div ref={ref} className="mc-wrap">
      {w > 0 && (
        <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setTip(null)} role="img">
          <YAxis ticks={ticks} y={y} w={w} format={yFormat} />
          {refLines.map((r) => (
            <g key={r.label}>
              <line className="mc-ref" x1={M.left} x2={w - M.right} y1={y(r.y)} y2={y(r.y)} />
              <text className="mc-ref-label" x={w - M.right} y={y(r.y) - 4} textAnchor="end">{r.label}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="mc-tick" x={x(t)} y={height - 8} textAnchor="middle">{fmtX(t)}</text>
          ))}
          {xRefLines.filter((r) => r.x >= xs[0] && r.x <= xs[xs.length - 1]).map((r) => (
            <g key={r.label}>
              <line className="mc-ref" x1={x(r.x)} x2={x(r.x)} y1={M.top} y2={height - M.bottom} />
              <text className="mc-ref-label" x={x(r.x) + 4} y={M.top + 10}>{r.label}</text>
            </g>
          ))}
          {series.map((s) => {
            const pts = s.points.filter((p) => p.y != null).sort((a, b) => a.x - b.x);
            if (!pts.length) return null;
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' ');
            const last = pts[pts.length - 1];
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                  strokeDasharray={s.dashed ? '6 4' : undefined} />
                <circle cx={x(last.x)} cy={y(last.y)} r="4" fill={s.color} className="mc-dot" />
              </g>
            );
          })}
          {tip && <line className="mc-crosshair" x1={tip.x} x2={tip.x} y1={M.top} y2={height - M.bottom} />}
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
};

/**
 * Columns. data: [{ label, value, title? }]. Signed values grow from 0 (up = posColor, down = negColor).
 */
export const ColumnChart = ({
  data, height = 180, color = '#2399a8', negColor = null, yFormat = (v) => v, valueLabels = true,
  refLine = null, yDomain = null, tooltipLabel = '', empty = 'Brak danych',
}) => {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const vals = data.map((d) => d.value).filter((v) => v != null);
  if (vals.length === 0) return <div ref={ref} className="mc-empty" style={{ height }}>{empty}</div>;

  const lo = Math.min(0, ...vals, refLine?.y ?? 0);
  const hi = Math.max(0, ...vals, refLine?.y ?? 0);
  const ticks = niceTicks(yDomain ? yDomain[0] : lo, yDomain ? yDomain[1] : hi);
  const y = scale(ticks[0], ticks[ticks.length - 1], height - M.bottom, M.top);
  const plotW = (w || 300) - M.left - M.right;
  const band = plotW / data.length;
  const barW = Math.max(2, Math.min(24, band * 0.6));
  const r = Math.min(4, barW / 2);
  const showLabels = valueLabels && band >= 28;
  const labelEvery = Math.ceil(data.length / 8);

  // Bar with a rounded data end, square at the baseline
  const barPath = (cx, v) => {
    const x0 = cx - barW / 2;
    const yb = y(0);
    const yt = y(v);
    const up = yt <= yb;
    const hgt = Math.abs(yb - yt);
    const rr = Math.min(r, hgt);
    if (hgt < 0.5) return '';
    return up
      ? `M${x0},${yb} V${yt + rr} Q${x0},${yt} ${x0 + rr},${yt} H${x0 + barW - rr} Q${x0 + barW},${yt} ${x0 + barW},${yt + rr} V${yb} Z`
      : `M${x0},${yb} V${yt - rr} Q${x0},${yt} ${x0 + rr},${yt} H${x0 + barW - rr} Q${x0 + barW},${yt} ${x0 + barW},${yt - rr} V${yb} Z`;
  };

  return (
    <div ref={ref} className="mc-wrap">
      {w > 0 && (
        <svg width={w} height={height} role="img" onMouseLeave={() => setHover(null)}>
          <YAxis ticks={ticks} y={y} w={w} format={yFormat} />
          <line className="mc-axis" x1={M.left} x2={w - M.right} y1={y(0)} y2={y(0)} />
          {refLine && (
            <g>
              <line className="mc-ref" x1={M.left} x2={w - M.right} y1={y(refLine.y)} y2={y(refLine.y)} />
              <text className="mc-ref-label" x={w - M.right} y={y(refLine.y) - 4} textAnchor="end">{refLine.label}</text>
            </g>
          )}
          {data.map((d, i) => {
            const cx = M.left + band * i + band / 2;
            const v = d.value;
            const fill = v != null && v < 0 && negColor ? negColor : color;
            return (
              <g
                key={d.label}
                onMouseEnter={() => setHover({ i, x: cx, y: v == null ? y(0) : Math.min(y(v), y(0)) })}
                className={hover?.i === i ? 'mc-hovered' : ''}
              >
                <rect x={cx - band / 2} y={M.top} width={band} height={height - M.top - M.bottom} fill="transparent" />
                {v != null && <path d={barPath(cx, v)} fill={fill} />}
                {showLabels && v != null && (
                  <text className="mc-value" x={cx} y={v >= 0 ? y(v) - 5 : y(v) + 12} textAnchor="middle">{yFormat(v)}</text>
                )}
                {(i % labelEvery === 0) && (
                  <text className="mc-tick" x={cx} y={height - 8} textAnchor="middle">{d.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <Tooltip
          width={w}
          tip={{
            x: hover.x, y: hover.y,
            title: data[hover.i].title || data[hover.i].label,
            rows: [{ label: tooltipLabel, value: data[hover.i].value == null ? '–' : yFormat(data[hover.i].value) }, ...(data[hover.i].extra || [])],
          }}
        />
      )}
    </div>
  );
};

/**
 * Horizontal bars diverging from 0 (feature weights). rows: [{ label, value }]
 */
export const DivergingBars = ({ rows, posColor = '#4a9e4a', negColor = '#c95f8f', format = (v) => v, empty = 'Brak danych' }) => {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  if (!rows.length) return <div ref={ref} className="mc-empty" style={{ height: 80 }}>{empty}</div>;
  const rowH = 22;
  const labelW = Math.min(220, Math.max(120, (w || 300) * 0.42));
  const height = rows.length * rowH + 8;
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  const plotL = labelW + 8;
  const plotR = (w || 300) - 56;
  const zero = (plotL + plotR) / 2;
  const half = (plotR - plotL) / 2;

  return (
    <div ref={ref} className="mc-wrap">
      {w > 0 && (
        <svg width={w} height={height} role="img" onMouseLeave={() => setHover(null)}>
          <line className="mc-axis" x1={zero} x2={zero} y1={0} y2={height} />
          {rows.map((r, i) => {
            const len = (Math.abs(r.value) / maxAbs) * half;
            const yc = 4 + i * rowH + rowH / 2;
            const pos = r.value >= 0;
            const x0 = pos ? zero : zero - len;
            return (
              <g key={r.label} onMouseEnter={() => setHover({ i, x: pos ? zero + len : zero - len, y: yc })} className={hover?.i === i ? 'mc-hovered' : ''}>
                <rect x={0} y={yc - rowH / 2} width={w} height={rowH} fill="transparent" />
                <text className="mc-row-label" x={labelW} y={yc} dy="0.32em" textAnchor="end">{r.label}</text>
                <rect x={x0} y={yc - 6} width={Math.max(1, len)} height={12} rx={Math.min(4, len / 2)} fill={pos ? posColor : negColor} />
                <text className="mc-value" x={pos ? zero + len + 4 : zero - len - 4} y={yc} dy="0.32em" textAnchor={pos ? 'start' : 'end'}>
                  {`${pos ? '+' : '−'}${format(Math.abs(r.value))}`}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <Tooltip width={w} tip={{ x: hover.x, y: hover.y - 12, title: rows[hover.i].label, rows: [{ label: rows[hover.i].value >= 0 ? 'wzmacnia' : 'osłabia', value: `${rows[hover.i].value >= 0 ? '+' : '−'}${format(Math.abs(rows[hover.i].value))}` }] }} />
      )}
    </div>
  );
};

/**
 * Calibration: predicted vs actual with the ideal diagonal. points: [{ x, y, n, label }]
 */
export const CalibrationChart = ({ points, height = 220, color = '#2399a8', format = (v) => `${Math.round(v * 100)}%`, empty = 'Brak danych o kalibracji' }) => {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const valid = points.filter((p) => p.x != null && p.y != null);
  if (!valid.length) return <div ref={ref} className="mc-empty" style={{ height }}>{empty}</div>;
  const maxV = Math.min(1, Math.max(0.1, ...valid.map((p) => Math.max(p.x, p.y))) * 1.1);
  const ticks = niceTicks(0, maxV);
  const top = ticks[ticks.length - 1];
  const size = Math.min((w || 300) - M.left - M.right, height - M.top - M.bottom);
  // Square plot, centered in the card
  const left = Math.max(M.left, ((w || 300) - size) / 2);
  const x = scale(0, top, left, left + size);
  const y = scale(0, top, M.top + size, M.top);

  return (
    <div ref={ref} className="mc-wrap">
      {w > 0 && (
        <svg width={w} height={size + M.top + M.bottom} role="img" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="mc-grid" x1={left} x2={left + size} y1={y(t)} y2={y(t)} />
              <text className="mc-tick" x={left - 6} y={y(t)} dy="0.32em" textAnchor="end">{format(t)}</text>
              <text className="mc-tick" x={x(t)} y={M.top + size + 16} textAnchor="middle">{format(t)}</text>
            </g>
          ))}
          <line className="mc-ref" x1={x(0)} y1={y(0)} x2={x(top)} y2={y(top)} />
          <text className="mc-ref-label" x={x(top)} y={y(top) + 12} textAnchor="end">idealna kalibracja</text>
          <path
            d={valid.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' ')}
            fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"
          />
          {valid.map((p, i) => (
            <g key={p.label || i} onMouseEnter={() => setHover({ i })}>
              <circle cx={x(p.x)} cy={y(p.y)} r="12" fill="transparent" />
              <circle cx={x(p.x)} cy={y(p.y)} r={hover?.i === i ? 6 : 4.5} fill={color} className="mc-dot" />
            </g>
          ))}
        </svg>
      )}
      {hover && (
        <Tooltip
          width={w}
          tip={{
            x: x(valid[hover.i].x), y: y(valid[hover.i].y) - 10,
            title: valid[hover.i].label,
            rows: [
              { label: 'rzeczywisty win rate', value: format(valid[hover.i].y) },
              { label: 'przewidywany', value: format(valid[hover.i].x) },
              ...(valid[hover.i].n != null ? [{ label: 'transakcji', value: String(valid[hover.i].n) }] : []),
            ],
          }}
        />
      )}
    </div>
  );
};
