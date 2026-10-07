import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  MAX_SCAN_CANDLES,
  MANUAL_POINTS,
  scanHarmonics,
  setSelectingRange,
  dismissScan,
  stopManual,
  addManualPoint,
  undoManualPoint,
  setManualError,
  validateManualPattern,
} from '../../store/slices/harmonicsSlice';
import './HarmonicTools.css';

const DRAG_THRESHOLD_PX = 4;
const MANUAL_COLOR = '#ffcc00';

const formatDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : '?');
const formatRatio = (v) => (v == null ? '—' : Number(v).toFixed(3));
const formatPrice = (v) => (v == null ? '—' : Number(v).toPrecision(6));

// Candle index under an x coordinate, clamped to the loaded data
const indexAtX = (chart, x, count) => {
  const logical = chart.timeScale().coordinateToLogical(x);
  if (logical == null) return null;
  return Math.max(0, Math.min(count - 1, Math.round(logical)));
};

/**
 * On-demand harmonics tools drawn over the main chart:
 * - range selection -> GET /harmonics scan (results go to the regular pattern list)
 * - manual X-A-B-C-D placement -> POST /harmonics/validate, with PRZ band and verdict card
 */
const HarmonicTools = ({ chartRef, seriesRef }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const { selectingRange, scan, manual } = useSelector((state) => state.harmonics);
  const datasetId = useSelector((state) => state.chart.datasetId);

  const [drag, setDrag] = useState(null); // { startX, x }
  const [rangeError, setRangeError] = useState(null);
  const [, setViewportTick] = useState(0); // re-render the scanned-range band on scroll/zoom

  // ---------- range selection ----------

  const requestScan = useCallback((lo, hi) => {
    const { chart: chartState, assets } = store.getState();
    const { klines, interval } = chartState;
    if (!assets.selectedAsset || klines.length === 0) return;
    const count = hi - lo + 1;
    if (count > MAX_SCAN_CANDLES) {
      setRangeError(`${count} candles selected - the limit is ${MAX_SCAN_CANDLES}. Select a narrower range.`);
      return;
    }
    setRangeError(null);
    dispatch(scanHarmonics({
      assetId: assets.selectedAsset.id,
      interval,
      startTime: klines[lo].open_time,
      endTime: klines[hi].open_time,
    }));
  }, [dispatch, store]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const x = e.clientX - rect.left;
    setDrag({ startX: x, x });
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({ ...drag, x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)) });
  };

  const onPointerUp = () => {
    const chart = chartRef.current;
    const count = store.getState().chart.klines.length;
    const current = drag;
    setDrag(null);
    if (!current || !chart || count === 0) return;

    let lo;
    let hi;
    if (Math.abs(current.x - current.startX) < DRAG_THRESHOLD_PX) {
      // A plain click scans what is on screen
      const visible = chart.timeScale().getVisibleLogicalRange();
      if (!visible) return;
      lo = Math.max(0, Math.ceil(visible.from));
      hi = Math.min(count - 1, Math.floor(visible.to));
    } else {
      lo = indexAtX(chart, Math.min(current.startX, current.x), count);
      hi = indexAtX(chart, Math.max(current.startX, current.x), count);
    }
    if (lo == null || hi == null || hi < lo) return;
    requestScan(lo, hi);
  };

  // Keep the scanned-range band glued to the chart while it scrolls/zooms
  useEffect(() => {
    const timeScale = chartRef.current?.timeScale();
    if (!timeScale || !scan.range) return undefined;
    const tick = () => setViewportTick((t) => t + 1);
    timeScale.subscribeVisibleLogicalRangeChange(tick);
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(tick);
  }, [chartRef, scan.range]);

  useEffect(() => {
    if (!selectingRange) {
      setDrag(null);
      return undefined;
    }
    setRangeError(null);
    const onKey = (e) => { if (e.key === 'Escape') dispatch(setSelectingRange(false)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectingRange, dispatch]);

  // ---------- manual XABCD ----------

  // Clicks place the next point on the clicked candle, snapped to its high or low.
  // Own pointer handling instead of chart.subscribeClick: the chart swallows a quick second click
  // (double-click detection), which loses points when placing them fast. Drags still pan the chart.
  useEffect(() => {
    const chart = chartRef.current;
    if (!manual.active || !chart) return undefined;
    const el = chart.chartElement();
    let down = null;

    const placeAt = (x, y) => {
      const series = seriesRef.current;
      if (!series || x > chart.timeScale().width()) return; // ignore clicks on the price scale
      const { klines } = store.getState().chart;
      if (klines.length === 0) return;
      const logical = chart.timeScale().coordinateToLogical(x);
      if (logical == null) return;
      const idx = Math.max(0, Math.min(klines.length - 1, Math.round(logical)));
      const candle = klines[idx];
      const clicked = series.coordinateToPrice(y);
      const price = clicked != null && Math.abs(clicked - candle.low) < Math.abs(clicked - candle.high)
        ? candle.low
        : candle.high;

      const placed = MANUAL_POINTS.map((n) => store.getState().harmonics.manual.points[n]).filter(Boolean);
      if (placed.length >= MANUAL_POINTS.length) return;
      const last = placed[placed.length - 1];
      if (last && candle.open_time <= last.time) {
        dispatch(setManualError('Each point has to be on a later candle than the previous one.'));
        return;
      }
      dispatch(addManualPoint({ time: candle.open_time, price }));
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > DRAG_THRESHOLD_PX) return;
      const rect = el.getBoundingClientRect();
      placeAt(e.clientX - rect.left, e.clientY - rect.top);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.classList.add('placing-points');
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.classList.remove('placing-points');
    };
  }, [manual.active, chartRef, seriesRef, store, dispatch]);

  useEffect(() => {
    if (!manual.active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') dispatch(stopManual());
      if (e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        dispatch(undoManualPoint());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manual.active, dispatch]);

  const pointCount = MANUAL_POINTS.filter((n) => manual.points[n]).length;

  // X-A-B-C gives the PRZ to wait for D in; X-A-B-C-D gives the verdict
  useEffect(() => {
    if (pointCount < 4) return;
    const points = {};
    MANUAL_POINTS.forEach((n) => { if (manual.points[n]) points[n] = manual.points[n]; });
    dispatch(validateManualPattern({ points }));
  }, [pointCount, manual.points, dispatch]);

  // Zigzag line with X/A/B/C/D labels
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || pointCount === 0) return undefined;
    const { klines } = store.getState().chart;
    const byTime = new Map(klines.map((k) => [k.open_time, k]));

    const line = chart.addLineSeries({
      color: MANUAL_COLOR,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const placed = MANUAL_POINTS.filter((n) => manual.points[n]).map((n) => ({ name: n, ...manual.points[n] }));
    line.setData(placed.map((p) => ({ time: p.time / 1000, value: p.price })));
    line.setMarkers(placed.map((p) => {
      const isHigh = byTime.get(p.time)?.high === p.price;
      return {
        time: p.time / 1000,
        position: isHigh ? 'aboveBar' : 'belowBar',
        color: MANUAL_COLOR,
        shape: 'circle',
        text: p.name,
      };
    }));
    return () => {
      try { chart.removeSeries(line); } catch (e) {}
    };
  }, [manual.points, pointCount, chartRef, store, datasetId]);

  // The pattern the card talks about: best match, else the closest candidate once D is placed
  const result = manual.result;
  const best = result && (result.matches?.[0] || (result.complete ? result.candidates?.[0] : null));

  // PRZ band (where D completes the best pattern)
  useEffect(() => {
    const series = seriesRef.current;
    const prz = best?.prz;
    if (!manual.active || !series || !prz) return undefined;
    const lines = [prz.min, prz.max].map((price, i) => series.createPriceLine({
      price,
      color: 'rgba(255, 204, 0, 0.8)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: i === 0 ? `PRZ ${best.pattern}` : '',
    }));
    return () => lines.forEach((l) => { try { series.removePriceLine(l); } catch (e) {} });
  }, [best, manual.active, seriesRef]);

  // ---------- render ----------

  const chart = chartRef.current;
  let scanBand = null;
  if (chart && scan.range && scan.status !== 'idle') {
    const ts = chart.timeScale();
    const x1 = ts.timeToCoordinate(scan.range[0] / 1000);
    const x2 = ts.timeToCoordinate(scan.range[1] / 1000);
    if (x1 != null && x2 != null) {
      scanBand = { left: Math.min(x1, x2), width: Math.max(2, Math.abs(x2 - x1)) };
    }
  }

  const nextPoint = MANUAL_POINTS.find((n) => !manual.points[n]);

  return (
    <>
      {scanBand && <div className={`scan-band ${scan.status}`} style={scanBand} />}

      {selectingRange && (
        <div
          className="range-select-overlay"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {drag && (
            <div
              className="range-select-band"
              style={{ left: Math.min(drag.startX, drag.x), width: Math.abs(drag.x - drag.startX) }}
            />
          )}
        </div>
      )}

      <div className="harmonics-hud">
        {selectingRange && (
          <div className="hud-chip hint">
            Drag across the candles to scan (click = visible range, max {MAX_SCAN_CANDLES}) · Esc to cancel
          </div>
        )}
        {rangeError && <div className="hud-chip failed">{rangeError}</div>}
        {scan.status !== 'idle' && (
          <div className={`hud-chip ${scan.status}`} role="status">
            {scan.status === 'computing' && <span className="hud-spinner">⟳</span>}
            <span>
              {scan.status === 'computing' && `Scanning for patterns… ${scan.found} so far`}
              {scan.status === 'complete' && `${scan.found} pattern${scan.found === 1 ? '' : 's'} in range`}
              {scan.status === 'failed' && `Scan failed: ${scan.error}`}
            </span>
            {scan.range && <span className="hud-muted">{formatDate(scan.range[0])} – {formatDate(scan.range[1])}</span>}
            {scan.status === 'failed' && scan.request && (
              <button className="hud-btn" onClick={() => dispatch(scanHarmonics(scan.request))}>Retry</button>
            )}
            <button className="hud-btn icon" onClick={() => dispatch(dismissScan())} aria-label="Dismiss">×</button>
          </div>
        )}
      </div>

      {manual.active && (
        <div className="manual-card">
          <div className="manual-card-header">
            <span className="manual-title">
              Manual XABCD{result?.direction ? ` · ${result.direction}` : ''}
            </span>
            <button className="hud-btn" onClick={() => dispatch(undoManualPoint())} disabled={pointCount === 0}>
              Undo
            </button>
            <button className="hud-btn icon" onClick={() => dispatch(stopManual())} aria-label="Close">×</button>
          </div>

          {nextPoint && (
            <div className="manual-hint">
              Click the candle for <strong>{nextPoint}</strong>
              {nextPoint === 'D' && best?.prz && ` – the PRZ for ${best.pattern} is ${formatPrice(best.prz.min)}–${formatPrice(best.prz.max)}`}
              {nextPoint === 'D' && result && !best && ' – X-A-B fits no pattern'}
            </div>
          )}
          {manual.validating && <div className="manual-hint">Checking…</div>}
          {manual.error && <div className="manual-error">{manual.error}</div>}

          {result?.complete && best && (
            <div className={`manual-verdict ${best.match ? 'match' : 'miss'}`}>
              {best.match
                ? `✓ ${best.pattern}`
                : `✗ No pattern – closest: ${best.pattern} (deviation ${formatRatio(best.deviation)})`}
            </div>
          )}

          {best?.checks && (
            <table className="manual-checks">
              <tbody>
                {Object.entries(best.checks).map(([name, c]) => (
                  <tr key={name} className={c.ok ? 'ok' : 'bad'}>
                    <td>{name}</td>
                    <td>{formatRatio(c.value)}</td>
                    <td className="hud-muted">{formatRatio(c.min)}–{formatRatio(c.max)}</td>
                    <td>{c.ok ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {best?.targets && (
            <div className="manual-targets">
              {Object.entries(best.targets).map(([name, price]) => (
                <span key={name}>{name}: {formatPrice(price)}</span>
              ))}
            </div>
          )}

          {result?.matches?.length > 1 && (
            <div className="manual-hint hud-muted">
              Also fits: {result.matches.slice(1).map((m) => m.pattern).join(', ')}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HarmonicTools;
