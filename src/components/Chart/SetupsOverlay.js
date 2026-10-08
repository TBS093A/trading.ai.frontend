import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { fetchChartSetups, MAX_CHART_SETUPS } from '../../store/slices/setupsSlice';
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

const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Where the simulated trade closed: TP1 for a win, SL for a loss, otherwise flat at entry
const exitPrice = (s) => {
  if (s.status === 'win') return s.tp1;
  if (s.status === 'loss') return s.sl;
  return s.entry_price;
};

/**
 * Tracked harmonic setups on the chart: X-A-B-C legs, the PRZ from creation until exit (or now),
 * and the simulated trade from entry to exit, colored by status.
 */
const SetupsOverlay = ({ chartRef }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const showOnChart = useSelector((state) => state.setups.showOnChart);
  const { setups, loading, error } = useSelector((state) => state.setups.chart);
  const datasetId = useSelector((state) => state.chart.datasetId);
  const firstOpen = useSelector((state) => state.chart.klines[0]?.open_time);
  const lastOpen = useSelector((state) => {
    const { klines } = state.chart;
    return klines.length ? klines[klines.length - 1].open_time : undefined;
  });

  // Load setups for the dataset on screen
  useEffect(() => {
    if (!showOnChart || datasetId === 0) return;
    const { chart: chartState, assets } = store.getState();
    if (!assets.selectedAsset || chartState.klines.length === 0) return;
    dispatch(fetchChartSetups({ assetId: assets.selectedAsset.id, interval: chartState.interval }));
  }, [showOnChart, datasetId, dispatch, store]);

  // Only setups for this asset/interval whose whole structure is inside the loaded candles
  const drawable = useMemo(() => {
    if (!showOnChart || firstOpen == null) return [];
    const { assets, chart: chartState } = store.getState();
    return setups
      .filter((s) => s.asset_id === assets.selectedAsset?.id && s.interval === chartState.interval)
      .filter((s) => s.x_time >= firstOpen && s.created_time <= lastOpen)
      .sort((a, b) => b.created_time - a.created_time)
      .slice(0, MAX_CHART_SETUPS);
  }, [showOnChart, setups, firstOpen, lastOpen, store]);

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

      // X-A-B-C legs
      const legs = ['X', 'A', 'B', 'C'].filter((n) => pts[n]).map((n) => ({ time: pts[n].time / 1000, value: pts[n].price }));
      if (legs.length >= 2) add({ color: withAlpha(color, 0.55), lineWidth: 1 }, legs);

      // PRZ band edges, from when the setup was known until it resolved (or now)
      const end = Math.min(s.exit_time || lastOpen, lastOpen);
      if (s.prz_min != null && s.prz_max != null && end > s.created_time) {
        [s.prz_min, s.prz_max].forEach((price) => add(
          { color: withAlpha(color, 0.8), lineWidth: 2 },
          [{ time: s.created_time / 1000, value: price }, { time: end / 1000, value: price }],
        ));
      }

      // Simulated trade: entry -> exit
      if (s.entry_time && s.entry_price != null) {
        const exitTime = Math.min(s.exit_time || lastOpen, lastOpen);
        const data = [{ time: s.entry_time / 1000, value: s.entry_price }];
        if (exitTime > s.entry_time) data.push({ time: exitTime / 1000, value: exitPrice(s) });
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
  }, [drawable, chartRef, lastOpen]);

  if (!showOnChart) return null;

  const total = setups.length;
  return (
    <div className="setups-legend">
      <span className="setups-legend-title">
        {loading ? 'Loading setups…' : error ? error : `Setups: ${drawable.length}${total > drawable.length ? ` of ${total}` : ''} shown`}
      </span>
      {!loading && !error && Object.entries(SETUP_STATUS_COLORS).map(([status, color]) => (
        <span key={status} className="setups-legend-item">
          <span className="setups-legend-dot" style={{ background: color }} />
          {status.replace('_', ' ')}
        </span>
      ))}
    </div>
  );
};

export default SetupsOverlay;
