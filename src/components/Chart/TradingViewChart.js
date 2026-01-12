import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { setSelectedPattern, setHoveredPattern } from '../../store/slices/analysisSlice';
import { setRightPanelOpen, showTooltip, hideTooltip } from '../../store/slices/uiSlice';
import { calculateRSI, calculateMACD, calculateOBV } from '../../utils/indicators';
import './TradingViewChart.css';

const TradingViewChart = () => {
  const dispatch = useDispatch();
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const rsiChartRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const macdChartRef = useRef(null);
  const macdLineRef = useRef(null);
  const macdSignalRef = useRef(null);
  const macdHistRef = useRef(null);
  const obvChartRef = useRef(null);
  const obvSeriesRef = useRef(null);
  const patternLinesRef = useRef([]);
  const patternMarkersRef = useRef([]);

  const { klines } = useSelector((state) => state.chart);
  const { harmonicPatterns, selectedPattern, panelOptions, indicators } = useSelector((state) => state.analysis);

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
      color: parseFloat(k.close) >= parseFloat(k.open) 
        ? 'rgba(0, 255, 136, 0.5)' 
        : 'rgba(255, 51, 102, 0.5)',
    }));
  }, []);

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

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3366',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff3366',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3366',
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

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || klines.length === 0) return;

    const candlestickData = convertKlinesToCandlestickData(klines);
    const volumeData = convertKlinesToVolumeData(klines);

    candlestickSeriesRef.current.setData(candlestickData);
    if (volumeSeriesRef.current && indicators.volume) {
      volumeSeriesRef.current.setData(volumeData);
    }

    chartRef.current?.timeScale().fitContent();
  }, [klines, convertKlinesToCandlestickData, convertKlinesToVolumeData, indicators.volume]);

  // Draw harmonic patterns
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || harmonicPatterns.length === 0) return;

    // Clear previous pattern lines
    patternLinesRef.current.forEach((line) => {
      try {
        candlestickSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    patternLinesRef.current = [];

    // Create timestamp map
    const timestampMap = createTimestampMap(klines);

    // Draw patterns
    harmonicPatterns.forEach((pattern, patternIndex) => {
      const { ta_object_json: taData, x_point_timestamp, a_point_timestamp, b_point_timestamp, c_point_timestamp, d_point_timestamp } = pattern;
      
      if (!taData || !taData.points) return;

      const points = taData.points;
      const isBullish = taData.is_bullish;
      const patternColor = isBullish ? '#00ff88' : '#ff3366';

      // Get price levels from points
      const pricePoints = [];
      ['X', 'A', 'B', 'C', 'D'].forEach((pointName) => {
        if (points[pointName]) {
          pricePoints.push({
            name: pointName,
            price: points[pointName].price,
            time: points[pointName].index,
          });
        }
      });

      // Add price lines for pattern points
      pricePoints.forEach((point) => {
        try {
          const line = candlestickSeriesRef.current.createPriceLine({
            price: point.price,
            color: patternColor,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: false,
            title: `${taData.pattern_type} - ${point.name}`,
          });
          patternLinesRef.current.push(line);
        } catch (e) {
          console.warn('Failed to create price line:', e);
        }
      });

      // Add markers for pattern points
      const markers = [];
      if (x_point_timestamp && points.X) {
        markers.push({
          time: x_point_timestamp / 1000,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: patternColor,
          shape: 'circle',
          text: 'X',
        });
      }
      if (a_point_timestamp && points.A) {
        markers.push({
          time: a_point_timestamp / 1000,
          position: isBullish ? 'aboveBar' : 'belowBar',
          color: patternColor,
          shape: 'circle',
          text: 'A',
        });
      }
      if (b_point_timestamp && points.B) {
        markers.push({
          time: b_point_timestamp / 1000,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: patternColor,
          shape: 'circle',
          text: 'B',
        });
      }
      if (c_point_timestamp && points.C) {
        markers.push({
          time: c_point_timestamp / 1000,
          position: isBullish ? 'aboveBar' : 'belowBar',
          color: patternColor,
          shape: 'circle',
          text: 'C',
        });
      }
      if (d_point_timestamp && points.D) {
        markers.push({
          time: d_point_timestamp / 1000,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: patternColor,
          shape: 'circle',
          text: 'D',
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
  }, [harmonicPatterns, klines, createTimestampMap]);

  // Draw Fibonacci levels for selected pattern
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !selectedPattern) return;

    const { ta_object_json: taData } = selectedPattern;
    if (!taData || !taData.fibonacci_levels) return;

    const fibLevels = taData.fibonacci_levels;
    const isBullish = taData.is_bullish;

    // Internal Fibonacci Retracements
    if (panelOptions.showInternalFibo && fibLevels.retracement) {
      Object.entries(fibLevels.retracement).forEach(([level, price]) => {
        try {
          const line = candlestickSeriesRef.current.createPriceLine({
            price: price,
            color: '#ffcc00',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: `Fib ${(parseFloat(level) * 100).toFixed(1)}%`,
          });
          patternLinesRef.current.push(line);
        } catch (e) {}
      });
    }

    // External Fibonacci Extensions
    if (panelOptions.showExternalFibo && fibLevels.extension) {
      Object.entries(fibLevels.extension).forEach(([level, price]) => {
        try {
          const line = candlestickSeriesRef.current.createPriceLine({
            price: price,
            color: '#9945ff',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: `Ext ${(parseFloat(level) * 100).toFixed(1)}%`,
          });
          patternLinesRef.current.push(line);
        } catch (e) {}
      });
    }

    // Fibonacci FE Extensions
    if (panelOptions.showFiboFE && fibLevels.fe_extensions) {
      Object.entries(fibLevels.fe_extensions).forEach(([name, data]) => {
        try {
          const line = candlestickSeriesRef.current.createPriceLine({
            price: data.price,
            color: '#00f0ff',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: name,
          });
          patternLinesRef.current.push(line);
        } catch (e) {}
      });
    }

    // TP/PRZ/SL levels
    if (panelOptions.showTPPRZSL && fibLevels.all_targets) {
      Object.entries(fibLevels.all_targets).forEach(([name, data]) => {
        let color = '#00ff88';
        if (name.includes('SL') || name.includes('stop')) color = '#ff3366';
        else if (name.includes('PRZ')) color = '#ffcc00';
        else if (name.includes('TP')) color = '#00f0ff';

        try {
          const line = candlestickSeriesRef.current.createPriceLine({
            price: data.price,
            color: color,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: name,
          });
          patternLinesRef.current.push(line);
        } catch (e) {}
      });
    }
  }, [selectedPattern, panelOptions]);

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
      dispatch(setRightPanelOpen(true));
    }
  }, [dispatch, harmonicPatterns]);

  // Handle hover for tooltip
  const handleCrosshairMove = useCallback((param) => {
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
  }, [dispatch, harmonicPatterns]);

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

  return (
    <div className="trading-chart-wrapper">
      <div ref={chartContainerRef} className="trading-chart" />
      
      {/* RSI Chart */}
      {indicators.rsi && klines.length > 0 && (
        <RSIIndicator klines={klines} />
      )}
      
      {/* MACD Chart */}
      {indicators.macd && klines.length > 0 && (
        <MACDIndicator klines={klines} />
      )}
      
      {/* OBV Chart */}
      {indicators.obv && klines.length > 0 && (
        <OBVIndicator klines={klines} />
      )}
    </div>
  );
};

// RSI Indicator Component
const RSIIndicator = ({ klines }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 100,
      layout: { background: { type: 'solid', color: '#060810' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: '#21262d' },
      timeScale: { visible: false },
    });
    chartRef.current = chart;

    const rsiData = calculateRSI(klines);
    const series = chart.addLineSeries({
      color: '#9945ff',
      lineWidth: 2,
    });
    series.setData(rsiData);

    // Add overbought/oversold lines
    series.createPriceLine({ price: 70, color: '#ff3366', lineWidth: 1, lineStyle: 2 });
    series.createPriceLine({ price: 30, color: '#00ff88', lineWidth: 1, lineStyle: 2 });

    return () => chart.remove();
  }, [klines]);

  return (
    <div className="indicator-chart">
      <span className="indicator-label">RSI(14)</span>
      <div ref={containerRef} />
    </div>
  );
};

// MACD Indicator Component
const MACDIndicator = ({ klines }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 100,
      layout: { background: { type: 'solid', color: '#060810' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: '#21262d' },
      timeScale: { visible: false },
    });

    const { macdLine, signalLine, histogram } = calculateMACD(klines);

    // MACD Line
    const macdSeries = chart.addLineSeries({ color: '#00f0ff', lineWidth: 2 });
    macdSeries.setData(macdLine);

    // Signal Line
    const signalSeries = chart.addLineSeries({ color: '#ff9933', lineWidth: 2 });
    signalSeries.setData(signalLine);

    // Histogram
    const histSeries = chart.addHistogramSeries({
      color: '#00ff88',
    });
    histSeries.setData(histogram.map(h => ({
      ...h,
      color: h.value >= 0 ? '#00ff88' : '#ff3366'
    })));

    return () => chart.remove();
  }, [klines]);

  return (
    <div className="indicator-chart">
      <span className="indicator-label">MACD(12,26,9)</span>
      <div ref={containerRef} />
    </div>
  );
};

// OBV Indicator Component
const OBVIndicator = ({ klines }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 80,
      layout: { background: { type: 'solid', color: '#060810' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: '#21262d' },
      timeScale: { visible: false },
    });

    const obvData = calculateOBV(klines);
    const series = chart.addLineSeries({ color: '#ffcc00', lineWidth: 2 });
    series.setData(obvData);

    return () => chart.remove();
  }, [klines]);

  return (
    <div className="indicator-chart">
      <span className="indicator-label">OBV</span>
      <div ref={containerRef} />
    </div>
  );
};

export default TradingViewChart;

