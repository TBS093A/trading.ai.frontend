import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { setSelectedPattern, setHoveredPattern } from '../../store/slices/analysisSlice';
import { showTooltip, hideTooltip } from '../../store/slices/uiSlice';
import { clearScaleReset } from '../../store/slices/chartSlice';
import { calculateRSI, calculateMACD, calculateOBV } from '../../utils/indicators';
import './TradingViewChart.css';

// Helper function to convert hex color to rgba with alpha
const hexToRgba = (hex, alpha = 1) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const TradingViewChart = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const patternLinesRef = useRef([]);
  const patternMarkersRef = useRef([]);
  const patternShapesRef = useRef([]); // Line series for pattern shapes (triangles)
  const retraceLinesRef = useRef([]); // Line series for retrace lines
  
  // Refs for indicator charts (for synchronization)
  const indicatorChartsRef = useRef([]);
  const isSyncingRef = useRef(false); // Prevent infinite sync loops

  const { klines, asset, quote, interval: currentInterval, shouldResetScale } = useSelector((state) => state.chart);
  const { selectedAsset } = useSelector((state) => state.assets);
  const { harmonicPatterns, selectedPattern, expandedPatternId, unselectedAlpha, patternDisplayOptions, globalPatternDisplay, indicators, sharedPatternData } = useSelector((state) => state.analysis);

  // Track asset ID to reset chart when asset changes
  const prevAssetIdRef = useRef(null);

  // Helper to get display options for a pattern
  const getPatternOptions = useCallback((patternId) => {
    return patternDisplayOptions[patternId] || {
      showInternalFibo: false,
      showExternalFibo: false,
      showFiboFE: false,
      showTPPRZSL: false,
    };
  }, [patternDisplayOptions]);

  // Expose centerOnPattern method via ref
  useImperativeHandle(ref, () => ({
    centerOnPattern: (pattern) => {
      if (!chartRef.current || !pattern) return;
      
      const { x_point_timestamp, d_point_timestamp } = pattern;
      if (!x_point_timestamp || !d_point_timestamp) return;
      
      // Calculate time range with some padding
      const startTime = x_point_timestamp / 1000;
      const endTime = d_point_timestamp / 1000;
      const duration = endTime - startTime;
      const padding = duration * 0.2; // 20% padding on each side
      
      try {
        chartRef.current.timeScale().setVisibleRange({
          from: startTime - padding,
          to: endTime + padding,
        });
      } catch (e) {
        console.warn('Failed to center on pattern:', e);
      }
    }
  }), []);

  const isSyncingCrosshairRef = useRef(false);

  // Register indicator chart for synchronization (chart + its primary series)
  const registerIndicatorChart = useCallback((chart, series) => {
    if (chart && !indicatorChartsRef.current.find(e => e.chart === chart)) {
      indicatorChartsRef.current.push({ chart, series });
    }
  }, []);

  // Unregister indicator chart
  const unregisterIndicatorChart = useCallback((chart) => {
    indicatorChartsRef.current = indicatorChartsRef.current.filter(e => e.chart !== chart);
  }, []);

  // Sync time range from source to all other charts
  const syncTimeRange = useCallback((sourceChart, range) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      // Sync main chart if source is not main
      if (sourceChart !== chartRef.current && chartRef.current) {
        chartRef.current.timeScale().setVisibleRange(range);
      }

      // Sync all indicator charts
      indicatorChartsRef.current.forEach(({ chart }) => {
        if (chart !== sourceChart && chart) {
          try {
            chart.timeScale().setVisibleRange(range);
          } catch (e) {}
        }
      });
    } finally {
      // Use requestAnimationFrame to reset sync flag after all updates
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  }, []);

  // Sync crosshair position across all charts
  const syncCrosshair = useCallback((sourceChart, time) => {
    if (isSyncingCrosshairRef.current) return;
    isSyncingCrosshairRef.current = true;

    try {
      if (!time) {
        if (sourceChart !== chartRef.current && chartRef.current) {
          try { chartRef.current.clearCrosshairPosition(); } catch (e) {}
        }
        indicatorChartsRef.current.forEach(({ chart }) => {
          if (chart !== sourceChart && chart) {
            try { chart.clearCrosshairPosition(); } catch (e) {}
          }
        });
        return;
      }

      if (sourceChart !== chartRef.current && chartRef.current && candlestickSeriesRef.current) {
        try { chartRef.current.setCrosshairPosition(0, time, candlestickSeriesRef.current); } catch (e) {}
      }

      indicatorChartsRef.current.forEach(({ chart, series }) => {
        if (chart !== sourceChart && chart && series) {
          try { chart.setCrosshairPosition(0, time, series); } catch (e) {}
        }
      });
    } finally {
      requestAnimationFrame(() => {
        isSyncingCrosshairRef.current = false;
      });
    }
  }, []);

  // Convert klines to chart data format
  const convertKlinesToCandlestickData = useCallback((klines) => {
    return klines.map((k) => ({
      time: k.open_time / 1000, // Convert to seconds
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
    }));
  }, []);

  const convertKlinesToVolumeData = useCallback((klines) => {
    return klines.map((k) => ({
      time: k.open_time / 1000,
      value: parseFloat(k.volume),
      color: globalPatternDisplay.monochromaticMode
        ? (parseFloat(k.close) >= parseFloat(k.open) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.25)')
        : (parseFloat(k.close) >= parseFloat(k.open) ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 51, 102, 0.5)'),
    }));
  }, [globalPatternDisplay.monochromaticMode]);

  // Create timestamp to index map for pattern drawing
  const createTimestampMap = useCallback((klines) => {
    const map = new Map();
    klines.forEach((k, index) => {
      map.set(k.open_time, index);
    });
    return map;
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: 'solid', color: '#060810' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0, 240, 255, 0.3)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0f1419',
        },
        horzLine: {
          color: 'rgba(0, 240, 255, 0.3)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0f1419',
        },
      },
      rightPriceScale: {
        borderColor: '#21262d',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    };

    // Create main chart
    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      height: chartContainerRef.current.clientHeight,
      width: chartContainerRef.current.clientWidth,
    });
    chartRef.current = chart;

    // Add candlestick series with monochromatic colors (default mode)
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ffffff',
      downColor: 'transparent',
      borderUpColor: '#ffffff',
      borderDownColor: '#ffffff',
      wickUpColor: '#ffffff',
      wickDownColor: '#ffffff',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      chart.timeScale().fitContent();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update candlestick and volume colors based on monochromatic mode
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    if (globalPatternDisplay.monochromaticMode) {
      // Monochromatic mode: white candles (filled up, hollow down)
      candlestickSeriesRef.current.applyOptions({
        upColor: '#ffffff',
        downColor: 'transparent',
        borderUpColor: '#ffffff',
        borderDownColor: '#ffffff',
        wickUpColor: '#ffffff',
        wickDownColor: '#ffffff',
      });
    } else {
      // Normal mode: bright green up, bright red down
      candlestickSeriesRef.current.applyOptions({
        upColor: '#00ff88',
        downColor: '#ff3366',
        borderUpColor: '#00ff88',
        borderDownColor: '#ff3366',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff3366',
      });
    }

    // Update volume colors if volume data is available
    if (volumeSeriesRef.current && klines.length > 0) {
      const volumeData = klines.map((k) => ({
        time: k.open_time / 1000,
        value: parseFloat(k.volume),
        color: globalPatternDisplay.monochromaticMode
          ? (parseFloat(k.close) >= parseFloat(k.open) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.25)')
          : (parseFloat(k.close) >= parseFloat(k.open) ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 51, 102, 0.5)'),
      }));
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [globalPatternDisplay.monochromaticMode, klines]);

  // Update chart data and reset scale when asset changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || klines.length === 0) return;

    const currentAssetId = selectedAsset?.id;
    const assetChanged = prevAssetIdRef.current !== null && prevAssetIdRef.current !== currentAssetId;
    prevAssetIdRef.current = currentAssetId;

    const candlestickData = convertKlinesToCandlestickData(klines);
    const volumeData = convertKlinesToVolumeData(klines);

    candlestickSeriesRef.current.setData(candlestickData);
    if (volumeSeriesRef.current && indicators.volume) {
      volumeSeriesRef.current.setData(volumeData);
    }

    // Always fit content, but also reset price scale when asset changes
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      
      // Reset price scale to auto-fit the new data
      if (assetChanged) {
        chartRef.current.priceScale('right').applyOptions({
          autoScale: true,
        });
      }
    }
  }, [klines, selectedAsset, convertKlinesToCandlestickData, convertKlinesToVolumeData, indicators.volume]);

  // Force scale reset when triggered (e.g., when loading saved analysis)
  useEffect(() => {
    if (shouldResetScale && chartRef.current) {
      // Reset time scale to fit all content
      chartRef.current.timeScale().fitContent();
      
      // Reset price scale to auto-fit
      chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
      });
      
      // Clear the flag
      dispatch(clearScaleReset());
    }
  }, [shouldResetScale, dispatch]);

  // Draw harmonic patterns - point level lines and markers
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || harmonicPatterns.length === 0) return;

    // Clear previous pattern lines (can be price lines or series)
    patternLinesRef.current.forEach((item) => {
      try {
        if (item.type === 'series') {
          chartRef.current.removeSeries(item.series);
        } else if (item.type === 'priceLine') {
          candlestickSeriesRef.current.removePriceLine(item.line);
        } else {
          // Legacy: direct price line object
          candlestickSeriesRef.current.removePriceLine(item);
        }
      } catch (e) {}
    });
    patternLinesRef.current = [];

    // Draw patterns
    harmonicPatterns.forEach((pattern) => {
      const { ta_object_json: taData, x_point_timestamp, a_point_timestamp, b_point_timestamp, c_point_timestamp, d_point_timestamp } = pattern;
      
      if (!taData || !taData.points) return;

      const points = taData.points;
      const isBullish = taData.is_bullish;
      // Use gray in monochromatic mode, otherwise dark green/dark red
      const baseColor = globalPatternDisplay.monochromaticMode 
        ? '#666666' 
        : (isBullish ? '#1a6b1a' : '#8b1a1a');
      
      // Apply alpha for unselected patterns (selected or expanded pattern gets full opacity)
      const isSelected = selectedPattern?.id === pattern.id || expandedPatternId === pattern.id;
      const alpha = isSelected ? 1 : unselectedAlpha;
      const patternColor = hexToRgba(baseColor, alpha);

      // Draw point level lines only if enabled
      if (globalPatternDisplay.showPointLevelLines) {
        const pricePoints = [];
        ['X', 'A', 'B', 'C', 'D'].forEach((pointName) => {
          if (points[pointName]) {
            pricePoints.push({
              name: pointName,
              price: points[pointName].price,
            });
          }
        });

        const useFromFirstPoint = globalPatternDisplay.lineDisplayStyle === 'fromFirstPoint';
        const firstPointTimestamp = x_point_timestamp || a_point_timestamp;
        const showLabel = isSelected || globalPatternDisplay.showUnselectedLabels;

        pricePoints.forEach((point) => {
          try {
            if (useFromFirstPoint && firstPointTimestamp) {
              // Use line series starting from first point
              const series = chartRef.current.addLineSeries({
                color: patternColor,
                lineWidth: isSelected ? 2 : 1,
                lineStyle: 2, // Dashed
                crosshairMarkerVisible: false,
                lastValueVisible: showLabel,
                priceLineVisible: false,
                title: showLabel ? point.name : '',
              });
              const farFutureTime = 4102444800; // Jan 1, 2100
              series.setData([
                { time: firstPointTimestamp / 1000, value: point.price },
                { time: farFutureTime, value: point.price },
              ]);
              patternLinesRef.current.push({ type: 'series', series });
            } else {
              // Use price line (full width)
            const line = candlestickSeriesRef.current.createPriceLine({
              price: point.price,
              color: patternColor,
              lineWidth: isSelected ? 2 : 1,
              lineStyle: 2, // Dashed
                axisLabelVisible: showLabel,
                title: showLabel ? point.name : '',
            });
              patternLinesRef.current.push({ type: 'priceLine', line });
            }
          } catch (e) {
            console.warn('Failed to create price line:', e);
          }
        });
      }

      // Add markers for pattern points
      const markers = [];
      if (x_point_timestamp && points.X) {
        markers.push({
          time: x_point_timestamp / 1000,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: patternColor,
          shape: 'circle',
          text: isSelected ? 'X' : '',
        });
      }
      if (a_point_timestamp && points.A) {
        markers.push({
          time: a_point_timestamp / 1000,
          position: isBullish ? 'aboveBar' : 'belowBar',
          color: patternColor,
          shape: 'circle',
          text: isSelected ? 'A' : '',
        });
      }
      if (b_point_timestamp && points.B) {
        markers.push({
          time: b_point_timestamp / 1000,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: patternColor,
          shape: 'circle',
          text: isSelected ? 'B' : '',
        });
      }
      if (c_point_timestamp && points.C) {
        markers.push({
          time: c_point_timestamp / 1000,
          position: isBullish ? 'aboveBar' : 'belowBar',
          color: patternColor,
          shape: 'circle',
          text: isSelected ? 'C' : '',
        });
      }
      if (d_point_timestamp && points.D) {
        markers.push({
          time: d_point_timestamp / 1000,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: patternColor,
          shape: 'circle',
          text: isSelected ? 'D' : '',
        });
      }

      // Sort markers by time and set them
      if (markers.length > 0) {
        markers.sort((a, b) => a.time - b.time);
        patternMarkersRef.current = [...patternMarkersRef.current, ...markers];
      }
    });

    // Apply all markers at once
    if (patternMarkersRef.current.length > 0) {
      candlestickSeriesRef.current.setMarkers(
        patternMarkersRef.current.sort((a, b) => a.time - b.time)
      );
    }

    return () => {
      patternMarkersRef.current = [];
    };
  }, [harmonicPatterns, klines, selectedPattern, expandedPatternId, unselectedAlpha, globalPatternDisplay.showPointLevelLines, globalPatternDisplay.monochromaticMode, globalPatternDisplay.lineDisplayStyle, globalPatternDisplay.showUnselectedLabels]);

  // Draw pattern shapes - main legs (X-A, A-B, B-C, C-D) and closing lines (X-B, B-D)
  useEffect(() => {
    if (!chartRef.current || harmonicPatterns.length === 0) return;

    // Clear previous shape series
    patternShapesRef.current.forEach((series) => {
      try {
        chartRef.current.removeSeries(series);
      } catch (e) {}
    });
    patternShapesRef.current = [];

    if (!globalPatternDisplay.showPatternShapes) return;

    harmonicPatterns.forEach((pattern) => {
      const { ta_object_json: taData, x_point_timestamp, a_point_timestamp, b_point_timestamp, c_point_timestamp, d_point_timestamp } = pattern;
      
      if (!taData || !taData.points) return;

      const points = taData.points;
      const isBullish = taData.is_bullish;
      // Use gray in monochromatic mode, otherwise dark green/dark red
      const baseColor = globalPatternDisplay.monochromaticMode 
        ? '#666666' 
        : (isBullish ? '#1a6b1a' : '#8b1a1a');
      const isSelected = selectedPattern?.id === pattern.id || expandedPatternId === pattern.id;
      const lineAlpha = isSelected ? 1 : unselectedAlpha;
      const mainLineWidth = isSelected ? 2 : 1;

      const hasX = points.X && x_point_timestamp;
      const hasA = points.A && a_point_timestamp;
      const hasB = points.B && b_point_timestamp;
      const hasC = points.C && c_point_timestamp;
      const hasD = points.D && d_point_timestamp;

      // Draw main legs (solid lines): X-A, A-B, B-C, C-D
      if (hasX && hasA) {
        try {
          const series = chartRef.current.addLineSeries({
            color: hexToRgba(baseColor, lineAlpha),
            lineWidth: mainLineWidth,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          series.setData([
            { time: x_point_timestamp / 1000, value: points.X.price },
            { time: a_point_timestamp / 1000, value: points.A.price },
          ]);
          patternShapesRef.current.push(series);
        } catch (e) {}
      }

      if (hasA && hasB) {
        try {
          const series = chartRef.current.addLineSeries({
            color: hexToRgba(baseColor, lineAlpha),
            lineWidth: mainLineWidth,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          series.setData([
            { time: a_point_timestamp / 1000, value: points.A.price },
            { time: b_point_timestamp / 1000, value: points.B.price },
          ]);
          patternShapesRef.current.push(series);
        } catch (e) {}
      }

      if (hasB && hasC) {
        try {
          const series = chartRef.current.addLineSeries({
            color: hexToRgba(baseColor, lineAlpha),
            lineWidth: mainLineWidth,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          series.setData([
            { time: b_point_timestamp / 1000, value: points.B.price },
            { time: c_point_timestamp / 1000, value: points.C.price },
          ]);
          patternShapesRef.current.push(series);
        } catch (e) {}
      }

      if (hasC && hasD) {
        try {
          const series = chartRef.current.addLineSeries({
            color: hexToRgba(baseColor, lineAlpha),
            lineWidth: mainLineWidth,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          series.setData([
            { time: c_point_timestamp / 1000, value: points.C.price },
            { time: d_point_timestamp / 1000, value: points.D.price },
          ]);
          patternShapesRef.current.push(series);
        } catch (e) {}
      }

    });
  }, [harmonicPatterns, selectedPattern, expandedPatternId, unselectedAlpha, globalPatternDisplay.showPatternShapes, globalPatternDisplay.monochromaticMode]);

  // Draw retrace lines with ratio labels
  // Pyharmonics provides: XAB (AB/XA), ABC (BC/AB), BCD (CD/BC), XAD (AD/XA)
  useEffect(() => {
    if (!chartRef.current || harmonicPatterns.length === 0) return;

    // Clear previous retrace lines
    retraceLinesRef.current.forEach((series) => {
      try {
        chartRef.current.removeSeries(series);
      } catch (e) {}
    });
    retraceLinesRef.current = [];

    if (!globalPatternDisplay.showRetraceLines) return;

    harmonicPatterns.forEach((pattern) => {
      const { ta_object_json: taData, x_point_timestamp, a_point_timestamp, b_point_timestamp, c_point_timestamp, d_point_timestamp } = pattern;
      
      if (!taData || !taData.points || !taData.retraces) return;

      const points = taData.points;
      const retraces = taData.retraces;
      const isBullish = taData.is_bullish;
      // Use gray in monochromatic mode, otherwise dark green/dark red
      const baseColor = globalPatternDisplay.monochromaticMode 
        ? '#666666' 
        : (isBullish ? '#1a6b1a' : '#8b1a1a');
      const isSelected = selectedPattern?.id === pattern.id || expandedPatternId === pattern.id;
      const alpha = isSelected ? 0.8 : unselectedAlpha * 0.6;
      const labelAlpha = isSelected ? 1 : unselectedAlpha;

      // Helper to format ratio value
      const formatRatio = (value) => {
        if (typeof value !== 'number') return '';
        return value.toFixed(3);
      };

      // Helper to create retrace line with label at center
      const createRetraceLine = (startTime, startPrice, endTime, endPrice, label, isDashed = true) => {
        try {
          // Calculate midpoint time and price for label placement
          const midTime = (startTime + endTime) / 2 / 1000;
          const midPrice = (startPrice + endPrice) / 2;
          
          // Create main dashed line
          const series = chartRef.current.addLineSeries({
            color: hexToRgba(baseColor, alpha),
            lineWidth: 1,
            lineStyle: isDashed ? 2 : 0, // 2 = dashed
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          
          // Set line data with midpoint for marker
          series.setData([
            { time: startTime / 1000, value: startPrice },
            { time: midTime, value: midPrice },
            { time: endTime / 1000, value: endPrice },
          ]);
          
          // Add label marker at midpoint
          series.setMarkers([{
            time: midTime,
            position: 'inBar',
            color: hexToRgba(baseColor, labelAlpha),
            shape: 'text',
            text: label,
          }]);
          
          retraceLinesRef.current.push(series);
        } catch (e) {}
      };

      // XAB retrace - line from X to B with XAB ratio label
      if (points.X && points.B && x_point_timestamp && b_point_timestamp && retraces.XAB !== undefined) {
        createRetraceLine(
          x_point_timestamp, points.X.price,
          b_point_timestamp, points.B.price,
          formatRatio(retraces.XAB)
        );
      }

      // ABC retrace - line from A to C with ABC ratio label
      if (points.A && points.C && a_point_timestamp && c_point_timestamp && retraces.ABC !== undefined) {
        createRetraceLine(
          a_point_timestamp, points.A.price,
          c_point_timestamp, points.C.price,
          formatRatio(retraces.ABC)
        );
      }

      // BCD retrace - line from B to D with BCD ratio label
      if (points.B && points.D && b_point_timestamp && d_point_timestamp && retraces.BCD !== undefined) {
        createRetraceLine(
          b_point_timestamp, points.B.price,
          d_point_timestamp, points.D.price,
          formatRatio(retraces.BCD)
        );
      }

      // XAD/XABCD retrace - line from X to D with ratio label
      // Use XABCD if available, fallback to XAD
      const xdRatio = retraces.XABCD ?? retraces.XAD;
      if (points.X && points.D && x_point_timestamp && d_point_timestamp && xdRatio !== undefined) {
        createRetraceLine(
          x_point_timestamp, points.X.price,
          d_point_timestamp, points.D.price,
          formatRatio(xdRatio)
        );
      }
    });
  }, [harmonicPatterns, selectedPattern, expandedPatternId, unselectedAlpha, globalPatternDisplay.showRetraceLines, globalPatternDisplay.monochromaticMode]);

  // Refs for fibonacci lines (price lines for full width, series for fromFirstPoint)
  const fibLinesRef = useRef([]);
  const fibSeriesRef = useRef([]);

  // Helper to get the first point timestamp for a pattern (X for XABCD, A for ABCD/ABC, etc.)
  const getFirstPointTimestamp = useCallback((pattern) => {
    // If X point exists, it's the first point
    if (pattern.x_point_timestamp) return pattern.x_point_timestamp;
    // Otherwise A is the first point
    if (pattern.a_point_timestamp) return pattern.a_point_timestamp;
    return null;
  }, []);

  // Draw Fibonacci levels for ALL patterns that have display options enabled
  // Also draws shared lines from patterns of other intervals (from sharedPatternData cache)
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    const useFromFirstPoint = globalPatternDisplay.lineDisplayStyle === 'fromFirstPoint';

    // Clear previous fib price lines
    fibLinesRef.current.forEach((line) => {
      try {
        candlestickSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    fibLinesRef.current = [];

    // Clear previous fib series
    fibSeriesRef.current.forEach((series) => {
      try {
        chartRef.current.removeSeries(series);
      } catch (e) {}
    });
    fibSeriesRef.current = [];

    // Helper to create a fib line (either as price line or series based on mode)
    const createFibLine = (price, color, lineWidth, lineStyle, firstPointTimestamp, showLabel, title) => {
      if (useFromFirstPoint && firstPointTimestamp) {
        // Use line series starting from first point
        try {
          const series = chartRef.current.addLineSeries({
            color: color,
            lineWidth: lineWidth,
            lineStyle: lineStyle,
            crosshairMarkerVisible: false,
            lastValueVisible: showLabel, // Show label on price scale
            priceLineVisible: false,
            title: showLabel ? title : '',
          });
          // Line from first point to far future (year 2100)
          const farFutureTime = 4102444800; // Jan 1, 2100
          series.setData([
            { time: firstPointTimestamp / 1000, value: price },
            { time: farFutureTime, value: price },
          ]);
          fibSeriesRef.current.push(series);
        } catch (e) {}
      } else {
        // Use price line (full width)
        try {
          const line = candlestickSeriesRef.current.createPriceLine({
            price: price,
            color: color,
            lineWidth: lineWidth,
            lineStyle: lineStyle,
            axisLabelVisible: showLabel, // Show label on price scale
            title: showLabel ? title : '',
          });
          fibLinesRef.current.push(line);
        } catch (e) {}
      }
    };

    // Helper to process a pattern's fib levels
    const processPattern = (pattern, isFromCurrentInterval) => {
      const options = getPatternOptions(pattern.id);
      const { ta_object_json: taData } = pattern;
      const patternInterval = pattern.interval;
      const patternType = taData?.pattern_type || 'Pattern';
      
      if (!taData || !taData.fibonacci_levels) return;
      
      const fibLevels = taData.fibonacci_levels;
      const isCurrentSelected = selectedPattern?.id === pattern.id;
      const hiddenLines = options.hiddenLines || { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] };
      const sharedIntervals = options.sharedIntervals || { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] };
      const firstPointTimestamp = getFirstPointTimestamp(pattern);

      // Check if lines should be shown:
      // - From current interval: based on display options (showInternalFibo, etc.)
      // - From other intervals: based on sharedIntervals containing currentInterval
      const shouldShowInternalFibo = isFromCurrentInterval 
        ? options.showInternalFibo 
        : (options.showInternalFibo && sharedIntervals.internalFibo?.includes(currentInterval));
      
      const shouldShowExternalFibo = isFromCurrentInterval 
        ? options.showExternalFibo 
        : (options.showExternalFibo && sharedIntervals.externalFibo?.includes(currentInterval));
      
      const shouldShowFiboFE = isFromCurrentInterval 
        ? options.showFiboFE 
        : (options.showFiboFE && sharedIntervals.fiboFE?.includes(currentInterval));
      
      const shouldShowTPPRZSL = isFromCurrentInterval 
        ? options.showTPPRZSL 
        : (options.showTPPRZSL && sharedIntervals.tpPrzSl?.includes(currentInterval));

      // Shared lines from other intervals are drawn with lower opacity
      const isShared = !isFromCurrentInterval;
      const lineAlpha = isCurrentSelected ? 1 : (isShared ? 0.4 : 0.6);
      // Always show labels for shared lines (they need identification), otherwise follow global setting
      const showLabel = isCurrentSelected || globalPatternDisplay.showUnselectedLabels || isShared;

      // Helper to create label with pattern info for shared lines
      const makeLabel = (categoryName, levelText) => {
        if (isShared) {
          return `${categoryName} • ${patternType} • ${patternInterval} • ${levelText}`;
        }
        return levelText;
      };

      // Internal Fibonacci Retracements
      if (shouldShowInternalFibo && fibLevels.retracement) {
        Object.entries(fibLevels.retracement).forEach(([level, price]) => {
          if (hiddenLines.internalFibo?.includes(level)) return;
          const levelText = `${(parseFloat(level) * 100).toFixed(1)}%`;
          const label = makeLabel('Int', levelText);
          createFibLine(
            price,
            hexToRgba('#ffcc00', lineAlpha),
            isCurrentSelected ? 2 : 1,
            isShared ? 2 : 1, // Dashed for shared lines
            firstPointTimestamp,
            showLabel,
            label
          );
        });
      }

      // External Fibonacci Extensions
      if (shouldShowExternalFibo && fibLevels.extension) {
        Object.entries(fibLevels.extension).forEach(([level, price]) => {
          if (hiddenLines.externalFibo?.includes(level)) return;
          const levelText = `${(parseFloat(level) * 100).toFixed(1)}%`;
          const label = makeLabel('Ext', levelText);
          createFibLine(
            price,
            hexToRgba('#9945ff', lineAlpha),
            isCurrentSelected ? 2 : 1,
            isShared ? 2 : 1, // Dashed for shared lines
            firstPointTimestamp,
            showLabel,
            label
          );
        });
      }

      // Fibonacci FE Extensions
      // By default, only draw FE(ABC) and FE(BCD) - other FE types are hidden by default
      // User can toggle visibility via eye icon in UI
      const DEFAULT_VISIBLE_FE_LEGS = ['ABC', 'BCD'];
      if (shouldShowFiboFE && fibLevels.fe_extensions) {
        Object.entries(fibLevels.fe_extensions).forEach(([name, data]) => {
          // Check if explicitly hidden by user (individual line)
          if (hiddenLines.fiboFE?.includes(name)) return;
          
          const leg = data.leg || name.split('_')[1] || 'OTHER';
          const isDefaultLeg = DEFAULT_VISIBLE_FE_LEGS.includes(leg);
          
          if (isDefaultLeg) {
            // Default legs (ABC, BCD): visible unless _disable_<leg> is in hiddenLines
            const disableKey = `_disable_${leg}`;
            if (hiddenLines.fiboFE?.includes(disableKey)) return; // User disabled this group
          } else {
            // Non-default legs (XA, BC, AB, AC): hidden unless _enable_<leg> is in hiddenLines
            const enableKey = `_enable_${leg}`;
            if (!hiddenLines.fiboFE?.includes(enableKey)) return; // Not enabled by user
          }
          
          const label = makeLabel('FE', name);
          createFibLine(
            data.price,
            hexToRgba('#00f0ff', lineAlpha),
            isCurrentSelected ? 2 : 1,
            isShared ? 2 : 1, // Dashed for shared lines
            firstPointTimestamp,
            showLabel,
            label
          );
        });
      }

      // TP/PRZ/SL levels
      if (shouldShowTPPRZSL && fibLevels.all_targets) {
        Object.entries(fibLevels.all_targets).forEach(([name, data]) => {
          if (hiddenLines.tpPrzSl?.includes(name)) return;
          
          let color = '#00ff88';
          if (name.includes('SL') || name.includes('stop')) color = '#ff3366';
          else if (name.includes('PRZ')) color = '#ffcc00';
          else if (name.includes('TP')) color = '#00f0ff';

          const label = makeLabel('TP/SL', name);
          createFibLine(
            data.price,
            hexToRgba(color, lineAlpha),
            isCurrentSelected ? 2 : 1,
            isShared ? 2 : 0, // Dashed for shared lines
            firstPointTimestamp,
            showLabel,
            label
          );
        });
      }
    };

    // Process patterns from current interval
    harmonicPatterns.forEach((pattern) => {
      const isFromCurrentInterval = pattern.interval === currentInterval;
      processPattern(pattern, isFromCurrentInterval);
    });

    // Process shared patterns from other intervals (from cache)
    // Only process patterns that are NOT in harmonicPatterns (to avoid duplicates)
    const harmonicPatternIds = new Set(harmonicPatterns.map(p => p.id));
    Object.entries(sharedPatternData).forEach(([patternId, pattern]) => {
      if (harmonicPatternIds.has(patternId)) return; // Skip if already processed
      
      // Check if this pattern has any lines shared to the current interval
      const options = patternDisplayOptions[patternId];
      if (!options?.sharedIntervals) return;
      
      const hasSharedLines = 
        (options.showInternalFibo && options.sharedIntervals.internalFibo?.includes(currentInterval)) ||
        (options.showExternalFibo && options.sharedIntervals.externalFibo?.includes(currentInterval)) ||
        (options.showFiboFE && options.sharedIntervals.fiboFE?.includes(currentInterval)) ||
        (options.showTPPRZSL && options.sharedIntervals.tpPrzSl?.includes(currentInterval));
      
      if (hasSharedLines) {
        processPattern(pattern, false); // false = not from current interval
      }
    });
  }, [harmonicPatterns, patternDisplayOptions, selectedPattern, getPatternOptions, globalPatternDisplay.lineDisplayStyle, globalPatternDisplay.showUnselectedLabels, getFirstPointTimestamp, currentInterval, sharedPatternData]);

  // Handle pattern click
  const handleChartClick = useCallback((param) => {
    if (!param.point || harmonicPatterns.length === 0) return;

    const clickTime = param.time;
    
    // Find pattern near click time
    const clickedPattern = harmonicPatterns.find((pattern) => {
      const dTime = pattern.d_point_timestamp / 1000;
      return Math.abs(clickTime - dTime) < 3600 * 24; // Within 1 day
    });

    if (clickedPattern) {
      dispatch(setSelectedPattern(clickedPattern));
    }
  }, [dispatch, harmonicPatterns]);

  // Handle hover for tooltip + crosshair sync
  const handleCrosshairMove = useCallback((param) => {
    syncCrosshair(chartRef.current, param.time);

    if (!param.point || harmonicPatterns.length === 0) {
      dispatch(hideTooltip());
      dispatch(setHoveredPattern(null));
      return;
    }

    const hoverTime = param.time;
    
    // Find pattern near hover
    const hoveredPattern = harmonicPatterns.find((pattern) => {
      const { d_point_timestamp, x_point_timestamp } = pattern;
      const dTime = d_point_timestamp / 1000;
      const xTime = x_point_timestamp / 1000;
      return hoverTime >= xTime && hoverTime <= dTime + 3600;
    });

    if (hoveredPattern) {
      dispatch(setHoveredPattern(hoveredPattern));
      dispatch(showTooltip({
        position: { x: param.point.x, y: param.point.y },
        content: {
          patternType: hoveredPattern.ta_object_json.pattern_type,
          isBullish: hoveredPattern.ta_object_json.is_bullish,
          isFormed: hoveredPattern.ta_object_json.is_formed,
        },
      }));
    } else {
      dispatch(hideTooltip());
      dispatch(setHoveredPattern(null));
    }
  }, [dispatch, harmonicPatterns, syncCrosshair]);

  // Subscribe to chart events
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.subscribeClick(handleChartClick);
    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick);
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [handleChartClick, handleCrosshairMove]);

  // Set up time scale synchronization for main chart
  useEffect(() => {
    if (!chartRef.current) return;

    const handleVisibleTimeRangeChange = (range) => {
      if (range) {
        syncTimeRange(chartRef.current, range);
      }
    };

    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    };
  }, [syncTimeRange]);

  return (
    <div className="trading-chart-wrapper">
      <div ref={chartContainerRef} className="trading-chart" />
      
      {/* RSI Chart */}
      {indicators.rsi && klines.length > 0 && (
        <RSIIndicator 
          klines={klines} 
          onChartReady={registerIndicatorChart}
          onChartDestroy={unregisterIndicatorChart}
          syncTimeRange={syncTimeRange}
          syncCrosshair={syncCrosshair}
        />
      )}
      
      {/* MACD Chart */}
      {indicators.macd && klines.length > 0 && (
        <MACDIndicator 
          klines={klines}
          onChartReady={registerIndicatorChart}
          onChartDestroy={unregisterIndicatorChart}
          syncTimeRange={syncTimeRange}
          syncCrosshair={syncCrosshair}
        />
      )}
      
      {/* OBV Chart */}
      {indicators.obv && klines.length > 0 && (
        <OBVIndicator 
          klines={klines}
          onChartReady={registerIndicatorChart}
          onChartDestroy={unregisterIndicatorChart}
          syncTimeRange={syncTimeRange}
          syncCrosshair={syncCrosshair}
        />
      )}
    </div>
  );
});

// RSI Indicator Component
const RSIIndicator = ({ klines, onChartReady, onChartDestroy, syncTimeRange, syncCrosshair }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 100,
      layout: { background: { type: 'solid', color: '#060810' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: '#21262d', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { visible: false, borderColor: '#21262d' },
      handleScroll: { vertTouchDrag: false },
    });
    chartRef.current = chart;

    const rsiData = calculateRSI(klines);
    const series = chart.addLineSeries({
      color: '#9945ff',
      lineWidth: 2,
      priceScaleId: 'right',
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    });
    series.setData(rsiData);

    series.createPriceLine({ price: 70, color: '#ff3366', lineWidth: 1, lineStyle: 2 });
    series.createPriceLine({ price: 30, color: '#00ff88', lineWidth: 1, lineStyle: 2 });

    onChartReady?.(chart, series);

    const handleTimeRangeChange = (range) => {
      if (range) syncTimeRange?.(chart, range);
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeRangeChange);

    const handleCrosshair = (param) => {
      syncCrosshair?.(chart, param.time);
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeRangeChange);
      chart.unsubscribeCrosshairMove(handleCrosshair);
      onChartDestroy?.(chart);
      chart.remove();
    };
  }, [klines, onChartReady, onChartDestroy, syncTimeRange, syncCrosshair]);

  return (
    <div className="indicator-chart">
      <span className="indicator-label">RSI(14)</span>
      <div ref={containerRef} />
    </div>
  );
};

// MACD Indicator Component
const MACDIndicator = ({ klines, onChartReady, onChartDestroy, syncTimeRange, syncCrosshair }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 100,
      layout: { background: { type: 'solid', color: '#060810' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: '#21262d', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { visible: false, borderColor: '#21262d' },
      handleScroll: { vertTouchDrag: false },
    });
    chartRef.current = chart;

    const { macdLine, signalLine, histogram } = calculateMACD(klines);

    const macdSeries = chart.addLineSeries({ color: '#00f0ff', lineWidth: 2 });
    macdSeries.setData(macdLine);

    const signalSeries = chart.addLineSeries({ color: '#ff9933', lineWidth: 2 });
    signalSeries.setData(signalLine);

    const histSeries = chart.addHistogramSeries({ color: '#00ff88' });
    histSeries.setData(histogram.map(h => ({
      ...h,
      color: h.value >= 0 ? '#00ff88' : '#ff3366'
    })));

    onChartReady?.(chart, macdSeries);

    const handleTimeRangeChange = (range) => {
      if (range) syncTimeRange?.(chart, range);
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeRangeChange);

    const handleCrosshair = (param) => {
      syncCrosshair?.(chart, param.time);
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeRangeChange);
      chart.unsubscribeCrosshairMove(handleCrosshair);
      onChartDestroy?.(chart);
      chart.remove();
    };
  }, [klines, onChartReady, onChartDestroy, syncTimeRange, syncCrosshair]);

  return (
    <div className="indicator-chart">
      <span className="indicator-label">MACD(12,26,9)</span>
      <div ref={containerRef} />
    </div>
  );
};

// OBV Indicator Component
const OBVIndicator = ({ klines, onChartReady, onChartDestroy, syncTimeRange, syncCrosshair }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 80,
      layout: { background: { type: 'solid', color: '#060810' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: '#21262d', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { visible: false, borderColor: '#21262d' },
      handleScroll: { vertTouchDrag: false },
    });
    chartRef.current = chart;

    const obvData = calculateOBV(klines);
    const series = chart.addLineSeries({ color: '#ffcc00', lineWidth: 2 });
    series.setData(obvData);

    onChartReady?.(chart, series);

    const handleTimeRangeChange = (range) => {
      if (range) syncTimeRange?.(chart, range);
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeRangeChange);

    const handleCrosshair = (param) => {
      syncCrosshair?.(chart, param.time);
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeRangeChange);
      chart.unsubscribeCrosshairMove(handleCrosshair);
      onChartDestroy?.(chart);
      chart.remove();
    };
  }, [klines, onChartReady, onChartDestroy, syncTimeRange, syncCrosshair]);

  return (
    <div className="indicator-chart">
      <span className="indicator-label">OBV</span>
      <div ref={containerRef} />
    </div>
  );
};

export default TradingViewChart;

