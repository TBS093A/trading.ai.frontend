import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  fetchChartSetups,
  MAX_CHART_SETUPS,
  SETUP_STATUSES,
  toggleSetupStatus,
  soloSetupStatus,
  highlightSetup,
  setHighlightQuery,
} from '../../store/slices/setupsSlice';
import './SetupsOverlay.css';

export const SETUP_STATUS_COLORS = {
  win: '#00ff88',
  loss: '#ff3366',
  open: '#00f0ff',
  waiting: '#ffcc00',
  expired: '#ff9933',
  no_entry: '#8b949e',
  invalidated: '#9945ff',
};

const STATUS_HELP = {
  win: 'Entered at the PRZ and reached TP1',
  loss: 'Entered and hit SL first (TP and SL in one candle counts as SL)',
  open: 'Trade is open right now',
  waiting: 'PRZ known, price has not reached it yet',
  expired: 'Entered, but neither TP nor SL within the time limit - closed at market',
  no_entry: 'Price never reached the PRZ',
  invalidated: 'Structure broke before entry',
};

const SL_COLOR = '#ff3366';
const TP_COLOR = '#00ff88';
// How far outside the PRZ (in px) the cursor still counts as "on" the setup
const HOVER_PAD_PX = 6;
const TOOLTIP_WIDTH = 230;

const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const fmtPrice = (v) => (v == null ? '—' : Number(v).toPrecision(6));
const fmtR = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}R`);
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—');

// Where the simulated trade closed: TP1 for a win, SL for a loss. An expired trade closes at the
// last candle's close, which isn't stored - derive it from R (risk = |entry - SL|) so the line
// matches the reported result. Still-open trades are drawn flat at entry.
const exitPrice = (s) => {
  if (s.status === 'win') return s.tp1;
  if (s.status === 'loss') return s.sl;
  if (s.status === 'expired' && s.r_multiple != null && s.sl != null) {
    const move = s.r_multiple * Math.abs(s.entry_price - s.sl);
    return s.is_bullish ? s.entry_price + move : s.entry_price - move;
  }
  return s.entry_price;
};

// Until the setup resolved, or the last loaded candle while it is still live
const endTime = (s, lastOpen) => Math.min(s.exit_time || lastOpen, lastOpen);

/**
 * Tracked harmonic setups on the chart: X-A-B-C legs, the PRZ from creation until exit (or now),
 * and the simulated trade from entry to exit, colored by status. The legend filters statuses;
 * hovering a PRZ shows the setup's details and draws its SL/TP levels.
 */
const SetupsOverlay = ({ chartRef, seriesRef }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const showOnChart = useSelector((state) => state.setups.showOnChart);
  const hiddenStatuses = useSelector((state) => state.setups.hiddenStatuses);
  const highlightedId = useSelector((state) => state.setups.highlightedId);
  const highlightQuery = useSelector((state) => state.setups.highlightQuery);
  const { setups, loading, error } = useSelector((state) => state.setups.chart);
  const datasetId = useSelector((state) => state.chart.datasetId);
  const firstOpen = useSelector((state) => state.chart.klines[0]?.open_time);
  const lastOpen = useSelector((state) => {
    const { klines } = state.chart;
    return klines.length ? klines[klines.length - 1].open_time : undefined;
  });

  const [hover, setHover] = useState(null); // { id, x, y }

  // Load setups for the dataset on screen
  useEffect(() => {
    if (!showOnChart || datasetId === 0) return;
    const { chart: chartState, assets } = store.getState();
    if (!assets.selectedAsset || chartState.klines.length === 0) return;
    dispatch(fetchChartSetups({ assetId: assets.selectedAsset.id, interval: chartState.interval }));
  }, [showOnChart, datasetId, dispatch, store]);

  // Setups for this asset/interval whose whole structure is inside the loaded candles
  const inRange = useMemo(() => {
    if (!showOnChart || firstOpen == null) return [];
    const { assets, chart: chartState } = store.getState();
    return setups
      .filter((s) => s.asset_id === assets.selectedAsset?.id && s.interval === chartState.interval)
      .filter((s) => s.x_time >= firstOpen && s.created_time <= lastOpen);
  }, [showOnChart, setups, firstOpen, lastOpen, store]);

  const counts = useMemo(() => {
    const c = {};
    inRange.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [inRange]);

  // An e-mail link names its setup by pattern + X/C time; pin it once the overlay has loaded
  useEffect(() => {
    if (!highlightQuery || loading || datasetId === 0) return;
    const { pattern, x, c } = highlightQuery;
    const found = setups.find((s) => (pattern == null || s.pattern_type === pattern)
      && (x == null || s.x_time === x)
      && (c == null || s.c_time === c));
    if (found) dispatch(highlightSetup(found.id));
    else if (setups.length > 0) dispatch(setHighlightQuery(null)); // loaded, but it isn't there
  }, [highlightQuery, setups, loading, datasetId, dispatch]);

  // The status filter applies before the cap, so hiding statuses frees room for the others.
  // A pinned setup is always drawn.
  const drawable = useMemo(() => {
    const list = inRange
      .filter((s) => !hiddenStatuses.includes(s.status))
      .sort((a, b) => b.created_time - a.created_time)
      .slice(0, MAX_CHART_SETUPS);
    const pinned = highlightedId != null && inRange.find((s) => s.id === highlightedId);
    return pinned && !list.includes(pinned) ? [...list, pinned] : list;
  }, [inRange, hiddenStatuses, highlightedId]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || drawable.length === 0) return undefined;
    const series = [];
    const add = (options, data, markers) => {
      const line = chart.addLineSeries({
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        // Overlay never rescales the price axis - it follows the candles
        autoscaleInfoProvider: () => null,
        ...options,
      });
      line.setData(data);
      if (markers) line.setMarkers(markers);
      series.push(line);
    };

    drawable.forEach((s) => {
      const color = SETUP_STATUS_COLORS[s.status] || '#8b949e';
      const pts = s.points_json || {};
      const pinned = s.id === highlightedId;

      // X-A-B-C legs
      const legs = ['X', 'A', 'B', 'C'].filter((n) => pts[n]).map((n) => ({ time: pts[n].time / 1000, value: pts[n].price }));
      if (legs.length >= 2) add({ color: withAlpha(color, pinned ? 1 : 0.55), lineWidth: pinned ? 2 : 1 }, legs);

      // PRZ band edges, from when the setup was known until it resolved (or now)
      const end = endTime(s, lastOpen);
      if (s.prz_min != null && s.prz_max != null && end > s.created_time) {
        [s.prz_min, s.prz_max].forEach((price) => add(
          { color: withAlpha(color, pinned ? 1 : 0.8), lineWidth: pinned ? 3 : 2 },
          [{ time: s.created_time / 1000, value: price }, { time: end / 1000, value: price }],
        ));
      }

      // Simulated trade: entry -> exit
      if (s.entry_time && s.entry_price != null) {
        const data = [{ time: s.entry_time / 1000, value: s.entry_price }];
        if (end > s.entry_time) data.push({ time: end / 1000, value: exitPrice(s) });
        const markers = [{
          time: s.entry_time / 1000,
          position: s.is_bullish ? 'belowBar' : 'aboveBar',
          shape: s.is_bullish ? 'arrowUp' : 'arrowDown',
          color,
          text: s.pattern_type,
        }];
        if (s.exit_time && s.exit_time <= lastOpen && s.exit_time > s.entry_time) {
          markers.push({
            time: s.exit_time / 1000,
            position: 'inBar',
            shape: 'circle',
            color,
            text: s.r_multiple != null ? `${s.r_multiple > 0 ? '+' : ''}${Number(s.r_multiple).toFixed(1)}R` : s.status,
          });
        }
        add({ color, lineWidth: 1, lineStyle: 2 }, data, markers);
      }
    });

    return () => series.forEach((line) => { try { chart.removeSeries(line); } catch (e) {} });
  }, [drawable, chartRef, lastOpen, highlightedId]);

  // Hit-test the PRZ bands under the cursor; the narrowest (most specific) band wins
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || drawable.length === 0) {
      setHover(null);
      return undefined;
    }
    const onMove = (param) => {
      const series = seriesRef.current;
      if (!param.point || param.logical == null || !series) {
        setHover(null);
        return;
      }
      const { klines } = store.getState().chart;
      const idx = Math.round(param.logical);
      if (idx < 0 || idx >= klines.length) {
        setHover(null);
        return;
      }
      const t = klines[idx].open_time;
      const price = series.coordinateToPrice(param.point.y);
      const pricePad = Math.abs(series.coordinateToPrice(param.point.y - HOVER_PAD_PX) - price);
      if (price == null) {
        setHover(null);
        return;
      }
      let best = null;
      drawable.forEach((s) => {
        if (s.prz_min == null || t < s.created_time || t > endTime(s, lastOpen)) return;
        if (price < s.prz_min - pricePad || price > s.prz_max + pricePad) return;
        if (!best || (s.prz_max - s.prz_min) < (best.prz_max - best.prz_min)) best = s;
      });
      setHover(best ? { id: best.id, x: param.point.x, y: param.point.y } : null);
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      setHover(null);
    };
  }, [drawable, chartRef, seriesRef, store, lastOpen]);

  const hovered = hover ? drawable.find((s) => s.id === hover.id) : null;
  const pinnedSetup = highlightedId != null ? drawable.find((s) => s.id === highlightedId) : null;
  // Levels follow the hovered setup, otherwise stay on the pinned one
  const levelsFor = hovered || pinnedSetup;

  // SL / TP1 / TP2 of the hovered (or pinned) setup, from entry (or creation) until it resolved
  useEffect(() => {
    const chart = chartRef.current;
    const target = levelsFor;
    if (!chart || !target) return undefined;
    const from = (target.entry_time || target.created_time) / 1000;
    const to = endTime(target, lastOpen) / 1000;
    if (to <= from) return undefined;
    const levels = [
      [target.sl, SL_COLOR, 'SL'],
      [target.tp1, TP_COLOR, 'TP1'],
      [target.tp2, withAlpha(TP_COLOR, 0.6), 'TP2'],
    ].filter(([price]) => price != null);
    const series = levels.map(([price, color, title]) => {
      const line = chart.addLineSeries({
        color,
        lineWidth: 2,
        lineStyle: title === 'SL' ? 0 : 2,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        lastValueVisible: true,
        title,
        autoscaleInfoProvider: () => null,
      });
      line.setData([{ time: from, value: price }, { time: to, value: price }]);
      return line;
    });
    return () => series.forEach((line) => { try { chart.removeSeries(line); } catch (e) {} });
  }, [levelsFor, chartRef, lastOpen]);

  if (!showOnChart) return null;

  const total = setups.length;
  const container = chartRef.current?.chartElement();
  const width = container?.clientWidth || 0;
  const tooltipLeft = hover && hover.x + 16 + TOOLTIP_WIDTH > width ? hover.x - 16 - TOOLTIP_WIDTH : hover?.x + 16;

  return (
    <>
      <div className="setups-legend">
        <span className="setups-legend-title">
          {loading ? 'Loading setups…' : error || `Setups: ${drawable.length} shown${total > drawable.length ? ` of ${total}` : ''}`}
        </span>
        {!loading && !error && SETUP_STATUSES.map((status) => {
          const hidden = hiddenStatuses.includes(status);
          return (
            <button
              key={status}
              className={`setups-legend-item ${hidden ? 'off' : ''}`}
              onClick={() => dispatch(toggleSetupStatus(status))}
              onDoubleClick={() => dispatch(soloSetupStatus(status))}
              title={`${STATUS_HELP[status]}\nClick: show/hide · Double-click: show only this`}
              aria-pressed={!hidden}
            >
              <span className="setups-legend-dot" style={{ background: SETUP_STATUS_COLORS[status] }} />
              {status.replace('_', ' ')}
              <span className="setups-legend-count">{counts[status] || 0}</span>
            </button>
          );
        })}
      </div>

      {hovered && (
        <div className="setup-tooltip" style={{ left: tooltipLeft, top: Math.max(8, hover.y - 20), width: TOOLTIP_WIDTH }}>
          <div className="setup-tooltip-head">
            <span className="setup-tooltip-name">{hovered.pattern_type}</span>
            <span className={hovered.is_bullish ? 'bull' : 'bear'}>{hovered.is_bullish ? 'Long' : 'Short'}</span>
            <span className="setup-tooltip-status" style={{ color: SETUP_STATUS_COLORS[hovered.status] }}>
              {hovered.status.replace('_', ' ')}
            </span>
          </div>
          <dl className="setup-tooltip-grid">
            <dt>PRZ</dt><dd>{fmtPrice(hovered.prz_min)} – {fmtPrice(hovered.prz_max)}</dd>
            <dt>Detected</dt><dd>{fmtTime(hovered.created_time)}</dd>
            {hovered.entry_price != null && (
              <>
                <dt>Entry</dt><dd>{fmtPrice(hovered.entry_price)} · {fmtTime(hovered.entry_time)}</dd>
                <dt className="sl">SL</dt><dd>{fmtPrice(hovered.sl)}</dd>
                <dt className="tp">TP1</dt><dd>{fmtPrice(hovered.tp1)}</dd>
                {hovered.tp2 != null && (<><dt className="tp">TP2</dt><dd>{fmtPrice(hovered.tp2)}{hovered.tp2_reached ? ' ✓' : ''}</dd></>)}
              </>
            )}
            {hovered.exit_time && (<><dt>Closed</dt><dd>{fmtTime(hovered.exit_time)}</dd></>)}
            {hovered.r_multiple != null && (
              <>
                <dt>Result</dt>
                <dd className={hovered.r_multiple > 0 ? 'pos' : hovered.r_multiple < 0 ? 'neg' : ''}>{fmtR(hovered.r_multiple)}</dd>
              </>
            )}
            {(hovered.mfe_r != null || hovered.mae_r != null) && (
              <><dt>MFE / MAE</dt><dd>{fmtR(hovered.mfe_r)} / {fmtR(hovered.mae_r)}</dd></>
            )}
            {hovered.targets_source && (<><dt>Targets</dt><dd>{hovered.targets_source}</dd></>)}
            {hovered.strength?.score != null && (
              <>
                <dt>Strength</dt>
                <dd>{Math.round(hovered.strength.score)}/100 · p(TP1) {Math.round((hovered.strength.p_win || 0) * 100)}%</dd>
              </>
            )}
            {hovered.confluences_json?.total_score != null && (
              <><dt>Confluence</dt><dd>{hovered.confluences_json.total_score}</dd></>
            )}
          </dl>
          <div className="setup-tooltip-help">{STATUS_HELP[hovered.status]}</div>
        </div>
      )}
    </>
  );
};

export default SetupsOverlay;
