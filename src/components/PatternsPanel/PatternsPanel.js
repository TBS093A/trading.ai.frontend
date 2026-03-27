import React, { useMemo, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setSelectedPattern, 
  toggleExpandedPattern,
  setUnselectedAlpha,
  toggleAutoCenterOnSelect,
  togglePatternDisplayOption,
  toggleFibLineVisibility,
  toggleSharedInterval,
  toggleShowPointLevelLines,
  setLineDisplayStyle,
  toggleShowPatternShapes,
  toggleShowRetraceLines,
  toggleMonochromaticMode,
  toggleShowUnselectedLabels,
} from '../../store/slices/analysisSlice';
import { togglePatternsPanel } from '../../store/slices/uiSlice';
import './PatternsPanel.css';
import { getPatternInfo } from './patternInfoDescriptions';

// FE Group descriptions for info tooltips
const FE_GROUP_INFO = {
  'XA': {
    title: 'FE(XA)',
    levels: '1.272, 1.618',
    patterns: 'Butterfly, Crab, Deep Crab (tylko XABCD)',
    description: 'Gdzie rynek przestrzeli impuls (sprawdza poziom pkt D). Jeśli wygląda na to, że D > X, to można sprawdzić poziom D właśnie FE(XA). Niedostępne dla ABCD.',
  },
  'BC': {
    title: 'FE(BC)',
    levels: '1.13, 1.272, 1.618, 2.0',
    patterns: 'Shark, Deep Shark, 5-0, ABCD',
    description: 'Emocjonalne wykończenie ruchu - stop hunt, panic moves. To FE szuka D-ekstremum. Kluczowe dla szukania punktu wejścia.',
  },
  'AB': {
    title: 'FE(AB)',
    levels: '1.0, 1.272, 1.618',
    patterns: 'Bat, Gartley, ABCD',
    description: 'Sprawdza czy korekta jest geometrycznie zdrowa / symetria rynku. 1.0 = AB=CD, 1.272/1.618 = rozszerzone ABCD.',
  },
  'AC': {
    title: 'FE(AC)',
    levels: '1.272, 1.618',
    patterns: 'Bat, ABCD',
    description: 'Sprawdza drugą falę impulsu (CD) wewnątrz struktury - tzn. sprawdza poziom pkt D względem całego ruchu A→C.',
  },
  'ABC': {
    title: 'FE(ABC)',
    levels: '1.272, 1.618',
    patterns: 'ABCD, Bat, Gartley',
    description: 'Sprawdza kontynuację impulsu (czy po korekcie BC rynek ma jeszcze siłę, aby pociągnąć impuls AB dalej?). Ma rolę prognostyczną - dobre pod TP.',
  },
  'BCD': {
    title: 'FE(BCD)',
    levels: '1.272, 1.618',
    patterns: 'ABCD, wszystkie XABCD',
    description: 'Sprawdza domknięcie korekty (weryfikuje pkt D). KLUCZOWE dla ABCD! 1.618 = korekta pędząca. Sprawdza symetrię BC/CD.',
  },
};

const PatternsPanel = ({ isOpen, onCenterPattern }) => {
  const dispatch = useDispatch();
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  // State for collapsed FE groups - only ABC and BCD expanded by default
  const [collapsedFEGroups, setCollapsedFEGroups] = useState({
    'XA': true,
    'BC': true,
    'AB': true,
    'AC': true,
    'ABC': false,
    'BCD': false,
  });
  // State for info tooltip visibility
  const [activeInfoTooltip, setActiveInfoTooltip] = useState(null);
  /**
   * Per-pattern, per-category: stored true = collapsed, false = expanded.
   * Absent key = collapsed (default).
   */
  const [collapsedConfluenceCats, setCollapsedConfluenceCats] = useState({});
  /** Per-pattern: true = pattern info body expanded */
  const [expandedPatternInfoById, setExpandedPatternInfoById] = useState({});
  const { 
    harmonicPatterns, 
    selectedPattern, 
    expandedPatternId,
    unselectedAlpha,
    autoCenterOnSelect,
    patternDisplayOptions,
    globalPatternDisplay,
    sharedPatternData,
  } = useSelector((state) => state.analysis);
  const { interval: currentInterval, availableIntervals } = useSelector((state) => state.chart);

  // Compute list of all shared lines for display
  const sharedLinesList = useMemo(() => {
    const list = [];
    
    Object.entries(patternDisplayOptions).forEach(([patternId, options]) => {
      if (!options?.sharedIntervals) return;
      
      // Get pattern data from harmonicPatterns or sharedPatternData
      const pattern = harmonicPatterns.find(p => p.id === patternId) || sharedPatternData[patternId];
      if (!pattern) return;
      
      const patternType = pattern.ta_object_json?.pattern_type || 'Unknown';
      const patternInterval = pattern.interval;
      const isBullish = pattern.ta_object_json?.is_bullish;
      
      const categories = [
        { key: 'internalFibo', label: 'Internal Fibo', enabled: options.showInternalFibo },
        { key: 'externalFibo', label: 'External Fibo', enabled: options.showExternalFibo },
        { key: 'fiboFE', label: 'Fibo FE', enabled: options.showFiboFE },
        { key: 'tpPrzSl', label: 'TP/PRZ/SL', enabled: options.showTPPRZSL },
      ];
      
      categories.forEach(({ key, label, enabled }) => {
        const sharedTo = options.sharedIntervals[key] || [];
        if (enabled && sharedTo.length > 0) {
          list.push({
            patternId,
            patternType,
            patternInterval,
            isBullish,
            category: label,
            sharedTo,
          });
        }
      });
    });
    
    return list;
  }, [patternDisplayOptions, harmonicPatterns, sharedPatternData]);

  // Helper to get display options for a pattern
  const getPatternOptions = useCallback((patternId) => {
    return patternDisplayOptions[patternId] || {
      showInternalFibo: false,
      showExternalFibo: false,
      showFiboFE: false,
      showTPPRZSL: false,
      hiddenLines: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
      sharedIntervals: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
    };
  }, [patternDisplayOptions]);

  // Check if an interval is shared for a category
  const isIntervalShared = useCallback((patternId, category, interval) => {
    const options = getPatternOptions(patternId);
    const sharedIntervals = options.sharedIntervals?.[category] || [];
    return sharedIntervals.includes(interval);
  }, [getPatternOptions]);

  // Handle clicking on an interval to toggle sharing
  const handleSharedIntervalClick = useCallback((e, patternId, category, interval, pattern) => {
    e.stopPropagation();
    // Pass pattern data so it can be cached for rendering on other intervals
    dispatch(toggleSharedInterval({ patternId, category, interval, patternData: pattern }));
  }, [dispatch]);

  // Get intervals to show (excluding current interval of the pattern)
  const getOtherIntervals = useCallback((patternInterval) => {
    return availableIntervals.filter(int => int !== patternInterval);
  }, [availableIntervals]);

  // Check if a specific fib line is visible (not hidden)
  const isLineVisible = useCallback((patternId, category, lineKey) => {
    const options = getPatternOptions(patternId);
    const hiddenLines = options.hiddenLines?.[category] || [];
    return !hiddenLines.includes(lineKey);
  }, [getPatternOptions]);

  // Handle clicking on a fib line to toggle visibility
  const handleFibLineClick = useCallback((e, patternId, category, lineKey) => {
    e.stopPropagation();
    dispatch(toggleFibLineVisibility({ patternId, category, lineKey }));
  }, [dispatch]);

  // Check if pattern has any display options enabled
  const hasActiveDisplayOptions = useCallback((patternId) => {
    const options = getPatternOptions(patternId);
    return options.showInternalFibo || options.showExternalFibo || options.showFiboFE || options.showTPPRZSL;
  }, [getPatternOptions]);

  // Group patterns by interval and sort by D point timestamp (newest first)
  const groupedPatterns = useMemo(() => {
    if (!harmonicPatterns || harmonicPatterns.length === 0) return {};

    const groups = {};
    
    harmonicPatterns.forEach((pattern) => {
      const interval = pattern.interval || 'Unknown';
      if (!groups[interval]) {
        groups[interval] = [];
      }
      groups[interval].push(pattern);
    });

    // Sort each group by D point timestamp (newest first)
    Object.keys(groups).forEach((interval) => {
      groups[interval].sort((a, b) => {
        const aTime = a.ta_object_json?.points?.D?.timestamp || a.d_point_timestamp || 0;
        const bTime = b.ta_object_json?.points?.D?.timestamp || b.d_point_timestamp || 0;
        return bTime - aTime;
      });
    });

    // Sort interval keys (1m, 15m, 1h, 4h, 1d, etc.)
    const intervalOrder = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
    const sortedGroups = {};
    
    Object.keys(groups)
      .sort((a, b) => {
        const aIndex = intervalOrder.indexOf(a);
        const bIndex = intervalOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
      .forEach((key) => {
        sortedGroups[key] = groups[key];
      });

    return sortedGroups;
  }, [harmonicPatterns]);

  const totalPatterns = useMemo(() => {
    return harmonicPatterns?.length || 0;
  }, [harmonicPatterns]);

  // Handle clicking on pattern item (expands and optionally centers)
  const handlePatternClick = useCallback((pattern) => {
    dispatch(setSelectedPattern(pattern));
    dispatch(toggleExpandedPattern(pattern.id));
    
    // Center chart on pattern only if autoCenterOnSelect is enabled
    if (autoCenterOnSelect && onCenterPattern) {
      onCenterPattern(pattern);
    }
  }, [dispatch, onCenterPattern, autoCenterOnSelect]);

  // Handle clicking only the expand arrow (just toggles expand)
  const handleExpandClick = useCallback((e, patternId) => {
    e.stopPropagation();
    dispatch(toggleExpandedPattern(patternId));
  }, [dispatch]);

  const toggleConfluenceCategory = useCallback((e, patternId, categoryTitle) => {
    e.stopPropagation();
    e.preventDefault();
    setCollapsedConfluenceCats((prev) => {
      const byPattern = prev[patternId] || {};
      const currentlyCollapsed = byPattern[categoryTitle] !== false;
      const nextCollapsed = !currentlyCollapsed;
      return {
        ...prev,
        [patternId]: { ...byPattern, [categoryTitle]: nextCollapsed },
      };
    });
  }, []);

  const togglePatternInfo = useCallback((e, patternId) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedPatternInfoById((prev) => ({
      ...prev,
      [patternId]: !prev[patternId],
    }));
  }, []);

  const handleAlphaChange = useCallback((e) => {
    dispatch(setUnselectedAlpha(parseFloat(e.target.value)));
  }, [dispatch]);

  const handleAutoCenterToggle = useCallback(() => {
    dispatch(toggleAutoCenterOnSelect());
  }, [dispatch]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayOptions = [
    { key: 'showInternalFibo', label: 'Internal Fibo', icon: '◐' },
    { key: 'showExternalFibo', label: 'External Fibo', icon: '◑' },
    { key: 'showFiboFE', label: 'Fibo FE', icon: '◒' },
    { key: 'showTPPRZSL', label: 'TP/PRZ/SL', icon: '◓' },
  ];

  if (!isOpen) return null;

  return (
    <aside className={`patterns-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="patterns-panel-header">
        <div className="header-title">
          <span className="header-icon">⬡</span>
          <h3>Harmonic Patterns</h3>
          <span className="patterns-count">{totalPatterns}</span>
        </div>
        <button 
          className="collapse-btn" 
          onClick={() => dispatch(togglePatternsPanel())}
          title="Hide Panel"
        >
          ⟫
        </button>
      </div>

      {/* Display Settings - Collapsible */}
      <div className={`display-settings-container ${isSettingsExpanded ? 'expanded' : 'collapsed'}`}>
        <button 
          className="settings-header"
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
        >
          <div className="settings-header-title">
            <span className="settings-header-icon">⚙</span>
            <span>Harmonic Patterns Display Settings</span>
          </div>
          <span className={`settings-expand-icon ${isSettingsExpanded ? 'expanded' : ''}`}>▾</span>
        </button>
        
        {isSettingsExpanded && (
      <div className="display-settings">
        <div className="settings-section">
          <label className="settings-label">
            <span className="settings-icon">◔</span>
            Unselected Opacity
            <span className="settings-value">{Math.round(unselectedAlpha * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={unselectedAlpha}
            onChange={handleAlphaChange}
            className="settings-slider"
          />
        </div>
        
        {/* Auto-center checkbox */}
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={autoCenterOnSelect}
            onChange={handleAutoCenterToggle}
            className="settings-checkbox"
          />
          <span className="checkbox-custom"></span>
          <span className="checkbox-text">Center chart on click</span>
        </label>

        {/* Pattern Shapes checkbox */}
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={globalPatternDisplay.showPatternShapes}
            onChange={() => dispatch(toggleShowPatternShapes())}
            className="settings-checkbox"
          />
          <span className="checkbox-custom"></span>
          <span className="checkbox-text">Show pattern shapes</span>
        </label>

        {/* Retrace Lines checkbox */}
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={globalPatternDisplay.showRetraceLines}
            onChange={() => dispatch(toggleShowRetraceLines())}
            className="settings-checkbox"
          />
          <span className="checkbox-custom"></span>
          <span className="checkbox-text">Show retrace lines</span>
        </label>

            {/* Point Level Lines checkbox */}
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={globalPatternDisplay.showPointLevelLines}
            onChange={() => dispatch(toggleShowPointLevelLines())}
            className="settings-checkbox"
          />
          <span className="checkbox-custom"></span>
          <span className="checkbox-text">Show point level lines</span>
        </label>

            {/* Line display style - applies to all pattern lines */}
            <div className="settings-section line-style-section">
              <div className="settings-section-title">Line Display Style</div>
              <div className="settings-radio-group">
            <label className="settings-radio-label">
              <input
                type="radio"
                    name="lineDisplayStyle"
                    checked={globalPatternDisplay.lineDisplayStyle === 'fromFirstPoint'}
                    onChange={() => dispatch(setLineDisplayStyle('fromFirstPoint'))}
                className="settings-radio"
              />
              <span className="radio-custom"></span>
                  <span className="radio-text">From first point to scale</span>
            </label>
            <label className="settings-radio-label">
              <input
                type="radio"
                    name="lineDisplayStyle"
                    checked={globalPatternDisplay.lineDisplayStyle === 'fullWidth'}
                    onChange={() => dispatch(setLineDisplayStyle('fullWidth'))}
                className="settings-radio"
              />
              <span className="radio-custom"></span>
                  <span className="radio-text">Full width</span>
                </label>
              </div>
              
              {/* Show labels for unselected patterns */}
              <label className="settings-checkbox-label sub-option">
                <input
                  type="checkbox"
                  checked={globalPatternDisplay.showUnselectedLabels}
                  onChange={() => dispatch(toggleShowUnselectedLabels())}
                  className="settings-checkbox"
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-text">Show labels for all patterns</span>
              </label>
            </div>

            {/* Monochromatic Mode checkbox */}
            <label className="settings-checkbox-label monochromatic">
              <input
                type="checkbox"
                checked={globalPatternDisplay.monochromaticMode}
                onChange={() => dispatch(toggleMonochromaticMode())}
                className="settings-checkbox"
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">Monochromatic mode</span>
            </label>
          </div>
        )}
      </div>

      {/* Patterns List */}
      <div className={`patterns-list ${globalPatternDisplay.monochromaticMode ? 'monochromatic' : ''}`}>
        {Object.keys(groupedPatterns).length === 0 ? (
          <div className="no-patterns">
            <span className="no-patterns-icon">◇</span>
            <p>No harmonic patterns found</p>
          </div>
        ) : (
          Object.entries(groupedPatterns).map(([interval, patterns]) => (
            <div key={interval} className="interval-group">
              <div className="interval-header">
                <span className="interval-badge">{interval}</span>
                <span className="interval-count">{patterns.length} patterns</span>
              </div>
              
              <div className="interval-patterns">
                {patterns.map((pattern) => {
                  const taData = pattern.ta_object_json || {};
                  const points = taData.points || {};
                  const fibLevels = taData.fibonacci_levels || {};
                  const isExpanded = expandedPatternId === pattern.id;
                  const isSelected = selectedPattern?.id === pattern.id;
                  const dTimestamp = points.D?.timestamp || pattern.d_point_timestamp;
                  const patternOptions = getPatternOptions(pattern.id);
                  const hasActiveOptions = hasActiveDisplayOptions(pattern.id);

                  return (
                    <div 
                      key={pattern.id} 
                      className={`pattern-item ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''} ${hasActiveOptions ? 'has-active-options' : ''}`}
                    >
                      {/* Pattern Header (clickable) */}
                      <div className="pattern-header">
                        <button 
                          className="pattern-header-main"
                          onClick={() => handlePatternClick(pattern)}
                        >
                          <div className="pattern-main">
                            <span className={`pattern-direction ${taData.is_bullish ? 'bullish' : 'bearish'}`}>
                              {taData.is_bullish ? '▲' : '▼'}
                            </span>
                            <span className="pattern-name">{taData.pattern_type || 'Unknown'}</span>
                            <span className={`pattern-status ${taData.is_formed ? 'formed' : 'forming'}`}>
                              {taData.is_formed ? '●' : '○'}
                            </span>
                          </div>
                          {/* Active display options icons */}
                          <div className="pattern-indicators">
                            {patternOptions.showInternalFibo && <span className="indicator-icon fib-int" title="Internal Fibo">◐</span>}
                            {patternOptions.showExternalFibo && <span className="indicator-icon fib-ext" title="External Fibo">◑</span>}
                            {patternOptions.showFiboFE && <span className="indicator-icon fib-fe" title="Fibo FE">◒</span>}
                            {patternOptions.showTPPRZSL && <span className="indicator-icon fib-tp" title="TP/PRZ/SL">◓</span>}
                          </div>
                          <span className="pattern-date">{formatTimestamp(dTimestamp)}</span>
                        </button>
                        <button 
                          className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                          onClick={(e) => handleExpandClick(e, pattern.id)}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <span className="expand-icon">▾</span>
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="pattern-details">
                          {/* Pattern guide (hardcoded descriptions by family) */}
                          {(() => {
                            const info = getPatternInfo(taData.pattern_type);
                            const infoExpanded = !!expandedPatternInfoById[pattern.id];
                            return (
                              <div className="pattern-info-callout" role="note" lang="en">
                                <button
                                  type="button"
                                  className={`pattern-info-callout-toggle ${infoExpanded ? 'expanded' : ''}`}
                                  onClick={(e) => togglePatternInfo(e, pattern.id)}
                                  aria-expanded={infoExpanded}
                                >
                                  <span className="pattern-info-chevron" aria-hidden>
                                    {infoExpanded ? '▾' : '▸'}
                                  </span>
                                  <span className="pattern-info-icon" aria-hidden="true">ⓘ</span>
                                  <span className="pattern-info-callout-title">
                                    {info.displayName}
                                    <span className="pattern-info-structure">· {info.structure}</span>
                                  </span>
                                </button>
                                {infoExpanded && (
                                  <div className="pattern-info-body">
                                    <p className="pattern-info-lead">Purpose</p>
                                    <p className="pattern-info-text">{info.purpose}</p>
                                    <p className="pattern-info-lead">What it anticipates</p>
                                    <p className="pattern-info-text">{info.prediction}</p>
                                    <p className="pattern-info-lead">Transactional vs analytical</p>
                                    <p className="pattern-info-text">{info.usage}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Detection Strategy Info */}
                          <div className="details-section strategy-section">
                            <div className="details-title">Detection Strategy</div>
                            <div className="strategy-row">
                              <div className="strategy-item" title="Fibonacci tolerance strategy - deviation from ideal pattern">
                                <span className="strategy-label">Fib Tolerance</span>
                                <span className="strategy-value">
                                  {taData.fib_tolerance_strategy || 'N/A'}
                                  {taData.fib_tolerance !== undefined && (
                                    <span className="strategy-detail">({(taData.fib_tolerance * 100).toFixed(1)}%)</span>
                                  )}
                                </span>
                              </div>
                              <div className="strategy-item" title="Peak spacing strategy - candle range for pattern detection">
                                <span className="strategy-label">Peak Spacing</span>
                                <span className="strategy-value">
                                  {taData.peak_spacing_strategy || 'N/A'}
                                  {taData.peak_spacing !== undefined && (
                                    <span className="strategy-detail">({taData.peak_spacing} candles)</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Points */}
                          <div className="details-section">
                            <div className="details-title">Points</div>
                            <div className="points-row">
                              {['X', 'A', 'B', 'C', 'D'].map((pointName) => {
                                const point = points[pointName];
                                if (!point) return null;
                                return (
                                  <div key={pointName} className="point-mini">
                                    <span className="point-label">{pointName}</span>
                                    <span className="point-value">{point.price?.toFixed(6)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Retraces (Fibonacci ratios) */}
                          {taData.retraces && (
                            <div className="details-section">
                              <div className="details-title">Retraces</div>
                              <div className="retraces-row">
                                {['XAB', 'ABC', 'BCD', 'XABCD'].map((key) => {
                                  const value = taData.retraces[key];
                                  if (value === undefined) return null;
                                  return (
                                    <div key={key} className="retrace-mini">
                                      <span className="retrace-key">{key}</span>
                                      <span className="retrace-val">{value.toFixed(3)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Confluences — filtered by pattern direction (bullish vs bearish) */}
                          {(() => {
                            const conf = pattern.confluences_json;
                            const cList = conf?.confluences || [];
                            const cTypes = new Set(cList.map(c => c.type));
                            const patternDirection =
                              taData.is_bullish === true
                                ? 'bullish'
                                : taData.is_bullish === false
                                  ? 'bearish'
                                  : 'both';

                            const matchesDirection = (direction) => {
                              if (patternDirection === 'both') return true;
                              if (!direction || direction === 'both') return true;
                              return direction === patternDirection;
                            };

                            const CATEGORIES = [
                              {
                                title: '1. RSI / Stochastic Divergence at D',
                                items: [
                                  { label: 'RSI Oversold', types: ['rsi_oversold'], direction: 'bullish' },
                                  { label: 'RSI Overbought', types: ['rsi_overbought'], direction: 'bearish' },
                                  { label: 'RSI Bullish Divergence', types: ['rsi_bullish_divergence'], direction: 'bullish' },
                                  { label: 'RSI Bearish Divergence', types: ['rsi_bearish_divergence'], direction: 'bearish' },
                                  { label: 'Stochastic Oversold', types: ['stochastic_oversold'], direction: 'bullish' },
                                  { label: 'Stochastic Overbought', types: ['stochastic_overbought'], direction: 'bearish' },
                                ],
                              },
                              {
                                title: '2. Candlestick Pattern at D',
                                items: [
                                  { label: 'Bullish Engulfing', types: ['bullish_engulfing'], direction: 'bullish' },
                                  { label: 'Bearish Engulfing', types: ['bearish_engulfing'], direction: 'bearish' },
                                  { label: 'Bullish Pin Bar', types: ['bullish_pin_bar'], direction: 'bullish' },
                                  { label: 'Bearish Pin Bar', types: ['bearish_pin_bar'], direction: 'bearish' },
                                  { label: 'Hammer', types: ['hammer'], direction: 'bullish' },
                                  { label: 'Shooting Star', types: ['shooting_star'], direction: 'bearish' },
                                  { label: 'Morning Star', types: ['morning_star'], direction: 'bullish' },
                                  { label: 'Evening Star', types: ['evening_star'], direction: 'bearish' },
                                  { label: 'Doji', types: ['doji'], direction: 'both' },
                                ],
                              },
                              {
                                title: '3. Fibonacci Cluster',
                                items: [
                                  { label: 'Fib Cluster (same TF)', types: ['fib_cluster'], direction: 'both' },
                                  { label: 'Higher TF Fib', types: ['higher_tf_fib'], direction: 'both' },
                                ],
                              },
                              {
                                title: '4. Support / Resistance from Higher TF',
                                items: [
                                  { label: 'Higher TF Support Zone', types: ['higher_tf_support_zone'], direction: 'bullish' },
                                  { label: 'Higher TF Resistance Zone', types: ['higher_tf_resistance_zone'], direction: 'bearish' },
                                  { label: 'Higher TF Support Trendline', types: ['higher_tf_support_trendline'], direction: 'bullish' },
                                  { label: 'Higher TF Resistance Trendline', types: ['higher_tf_resistance_trendline'], direction: 'bearish' },
                                  { label: 'Support Zone (same TF)', types: ['support_zone'], direction: 'bullish' },
                                  { label: 'Resistance Zone (same TF)', types: ['resistance_zone'], direction: 'bearish' },
                                  { label: 'Support Trendline (same TF)', types: ['support_trendline'], direction: 'bullish' },
                                  { label: 'Resistance Trendline (same TF)', types: ['resistance_trendline'], direction: 'bearish' },
                                  { label: 'Pivot Point', types: ['pivot_point'], direction: 'both' },
                                  { label: 'Round Level', types: ['round_level'], direction: 'both' },
                                ],
                              },
                              {
                                title: '5. Volume Confirmation',
                                items: [
                                  { label: 'Volume Spike', types: ['volume_spike'], direction: 'both' },
                                  { label: 'Volume Dry-up', types: ['volume_dryup'], direction: 'both' },
                                  { label: 'Volume Profile (POC/VAH/VAL)', types: ['volume_profile'], direction: 'both' },
                                  { label: 'MACD Bullish Crossover', types: ['macd_bullish_crossover'], direction: 'bullish' },
                                  { label: 'MACD Bearish Crossover', types: ['macd_bearish_crossover'], direction: 'bearish' },
                                  { label: 'MACD Histogram Reversal', types: ['macd_histogram_reversal'], direction: 'both' },
                                  { label: 'MACD Bullish Divergence', types: ['macd_bullish_divergence'], direction: 'bullish' },
                                  { label: 'MACD Bearish Divergence', types: ['macd_bearish_divergence'], direction: 'bearish' },
                                  { label: 'OBV Bullish Divergence', types: ['obv_bullish_divergence'], direction: 'bullish' },
                                  { label: 'OBV Bearish Divergence', types: ['obv_bearish_divergence'], direction: 'bearish' },
                                ],
                              },
                            ];

                            const getMatchedConfluence = (types) => {
                              return cList.find(c => types.includes(c.type));
                            };

                            const totalScore = conf?.total_score || 0;

                            return (
                              <div className="details-section confluences-section">
                                <div className="details-title">
                                  Confluences
                                  {totalScore > 0 && (
                                    <span className="confluence-score">{totalScore} found</span>
                                  )}
                                </div>
                                <div className="confluences-list">
                                  {CATEGORIES.map((cat) => {
                                    const itemsVisible = cat.items.filter((item) => matchesDirection(item.direction));
                                    if (itemsVisible.length === 0) return null;

                                    const catHits = itemsVisible.filter((item) =>
                                      item.types.some((t) => cTypes.has(t)),
                                    ).length;
                                    const confByPattern = collapsedConfluenceCats[pattern.id] || {};
                                    const isCatCollapsed = confByPattern[cat.title] !== false;

                                    return (
                                      <div key={cat.title} className="confluence-category">
                                        <button
                                          type="button"
                                          className={`confluence-cat-title ${catHits > 0 ? 'has-hits' : ''} ${isCatCollapsed ? 'collapsed' : ''}`}
                                          onClick={(e) => toggleConfluenceCategory(e, pattern.id, cat.title)}
                                          aria-expanded={!isCatCollapsed}
                                        >
                                          <span className="confluence-cat-chevron" aria-hidden>
                                            {isCatCollapsed ? '▸' : '▾'}
                                          </span>
                                          <span className="confluence-cat-title-text">{cat.title}</span>
                                          {catHits > 0 && (
                                            <span className="cat-hits">
                                              {catHits}/{itemsVisible.length}
                                            </span>
                                          )}
                                        </button>
                                        {!isCatCollapsed && (
                                          <div className="confluence-items">
                                            {itemsVisible.map((item) => {
                                              const match = getMatchedConfluence(item.types);
                                              const active = !!match;
                                              return (
                                                <div
                                                  key={item.label}
                                                  className={`confluence-item ${active ? 'active' : 'inactive'}`}
                                                  title={active ? `Confidence: ${(match.confidence * 100).toFixed(0)}%` : 'Not detected'}
                                                >
                                                  <span className={`confluence-dot ${active ? 'hit' : 'miss'}`}>
                                                    {active ? '●' : '○'}
                                                  </span>
                                                  <span className="confluence-label">{item.label}</span>
                                                  {active && (
                                                    <span className="confluence-conf">
                                                      {(match.confidence * 100).toFixed(0)}%
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Display Options */}
                          <div className="details-section">
                            <div className="details-title">Display on Chart</div>
                            <div className="display-options-row">
                              {displayOptions.map(({ key, label, icon }) => {
                                const hasData = key === 'showInternalFibo' ? fibLevels.retracement :
                                               key === 'showExternalFibo' ? fibLevels.extension :
                                               key === 'showFiboFE' ? fibLevels.fe_extensions :
                                               fibLevels.all_targets;
                                return (
                                  <button
                                    key={key}
                                    className={`display-option ${patternOptions[key] ? 'active' : ''} ${!hasData ? 'disabled' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (hasData) dispatch(togglePatternDisplayOption({ patternId: pattern.id, option: key }));
                                    }}
                                    disabled={!hasData}
                                    title={label}
                                  >
                                    <span className="option-icon">{icon}</span>
                                    <span className="option-text">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Fibonacci Levels (when enabled) - clickable to toggle visibility */}
                          {patternOptions.showInternalFibo && fibLevels.retracement && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-retracement">Internal Fibo</div>
                              <div className="fib-grid">
                                {Object.entries(fibLevels.retracement).map(([level, price]) => {
                                  const visible = isLineVisible(pattern.id, 'internalFibo', level);
                                  return (
                                    <button
                                      key={level}
                                      className={`fib-item clickable ${visible ? 'visible' : 'hidden'}`}
                                      onClick={(e) => handleFibLineClick(e, pattern.id, 'internalFibo', level)}
                                      title={visible ? 'Click to hide' : 'Click to show'}
                                    >
                                    <span className="fib-lvl">{(parseFloat(level) * 100).toFixed(1)}%</span>
                                    <span className="fib-prc">{price.toFixed(6)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="shared-intervals">
                                <span className="shared-label">Shared on:</span>
                                <div className="interval-buttons">
                                  {getOtherIntervals(pattern.interval).map((int) => (
                                    <button
                                      key={int}
                                      className={`interval-btn ${isIntervalShared(pattern.id, 'internalFibo', int) ? 'active' : ''}`}
                                      onClick={(e) => handleSharedIntervalClick(e, pattern.id, 'internalFibo', int, pattern)}
                                      title={`Share on ${int} chart`}
                                    >
                                      {int}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {patternOptions.showExternalFibo && fibLevels.extension && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-extension">External Fibo</div>
                              <div className="fib-grid">
                                {Object.entries(fibLevels.extension).map(([level, price]) => {
                                  const visible = isLineVisible(pattern.id, 'externalFibo', level);
                                  return (
                                    <button
                                      key={level}
                                      className={`fib-item clickable ${visible ? 'visible' : 'hidden'}`}
                                      onClick={(e) => handleFibLineClick(e, pattern.id, 'externalFibo', level)}
                                      title={visible ? 'Click to hide' : 'Click to show'}
                                    >
                                    <span className="fib-lvl">{(parseFloat(level) * 100).toFixed(1)}%</span>
                                    <span className="fib-prc">{price.toFixed(6)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="shared-intervals">
                                <span className="shared-label">Shared on:</span>
                                <div className="interval-buttons">
                                  {getOtherIntervals(pattern.interval).map((int) => (
                                    <button
                                      key={int}
                                      className={`interval-btn ${isIntervalShared(pattern.id, 'externalFibo', int) ? 'active' : ''}`}
                                      onClick={(e) => handleSharedIntervalClick(e, pattern.id, 'externalFibo', int, pattern)}
                                      title={`Share on ${int} chart`}
                                    >
                                      {int}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {patternOptions.showFiboFE && fibLevels.fe_extensions && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-fe">Fibo FE</div>
                              {/* Group FE levels by leg */}
                              {(() => {
                                const feGroups = {};
                                // Define leg order
                                const legOrder = ['XA', 'BC', 'AB', 'AC', 'ABC', 'BCD'];
                                
                                // Group by leg
                                Object.entries(fibLevels.fe_extensions).forEach(([name, data]) => {
                                  const leg = data.leg || name.split('_')[1] || 'OTHER';
                                  if (!feGroups[leg]) feGroups[leg] = [];
                                  feGroups[leg].push({ name, ...data });
                                });
                                
                                // Default visible FE legs (ABC and BCD)
                                const DEFAULT_VISIBLE_FE_LEGS = ['ABC', 'BCD'];
                                
                                return legOrder.filter(leg => feGroups[leg]).map((leg) => {
                                  const isCollapsed = collapsedFEGroups[leg];
                                  const info = FE_GROUP_INFO[leg];
                                  const isInfoActive = activeInfoTooltip === `${pattern.id}-${leg}`;
                                  
                                  // Check if this FE leg is shown on chart
                                  const isDefaultLeg = DEFAULT_VISIBLE_FE_LEGS.includes(leg);
                                  const enableKey = `_enable_${leg}`;
                                  const disableKey = `_disable_${leg}`;
                                  const options = getPatternOptions(pattern.id);
                                  const hiddenFE = options.hiddenLines?.fiboFE || [];
                                  
                                  // For default legs: visible if disableKey is NOT in hiddenLines
                                  // For non-default legs: visible only if enableKey IS in hiddenLines
                                  const isGroupEnabled = isDefaultLeg 
                                    ? !hiddenFE.includes(disableKey)
                                    : hiddenFE.includes(enableKey);
                                  
                                  const handleToggleGroupEnabled = (e) => {
                                    e.stopPropagation();
                                    // Toggle the appropriate key in hiddenLines
                                    const toggleKey = isDefaultLeg ? disableKey : enableKey;
                                    dispatch(toggleFibLineVisibility({ 
                                      patternId: pattern.id, 
                                      category: 'fiboFE', 
                                      lineKey: toggleKey 
                                    }));
                                  };
                                  
                                  return (
                                    <div key={leg} className={`fe-leg-group ${isCollapsed ? 'collapsed' : ''} ${!isGroupEnabled ? 'disabled-group' : ''}`}>
                                      <div className="fe-leg-header">
                                        <button 
                                          className="fe-leg-toggle"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCollapsedFEGroups(prev => ({ ...prev, [leg]: !prev[leg] }));
                                          }}
                                          title={isCollapsed ? 'Rozwiń' : 'Zwiń'}
                                        >
                                          <span className={`toggle-arrow ${isCollapsed ? '' : 'expanded'}`}>▶</span>
                                        </button>
                                        <span className="fe-leg-name">FE({leg})</span>
                                        <span className="fe-leg-levels">{info?.levels}</span>
                                        {/* Eye toggle for all FE groups */}
                                        <button 
                                          className={`fe-chart-toggle ${isGroupEnabled ? 'active' : ''}`}
                                          onClick={handleToggleGroupEnabled}
                                          title={isGroupEnabled ? 'Ukryj na wykresie' : 'Pokaż na wykresie'}
                                        >
                                          {isGroupEnabled ? '👁' : '👁‍🗨'}
                                        </button>
                                        <button 
                                          className={`fe-info-btn ${isInfoActive ? 'active' : ''}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveInfoTooltip(isInfoActive ? null : `${pattern.id}-${leg}`);
                                          }}
                                          title="Pokaż opis"
                                        >
                                          ⓘ
                                        </button>
                                      </div>
                                      
                                      {isInfoActive && info && (
                                        <div className="fe-info-tooltip">
                                          <div className="fe-info-patterns">
                                            <strong>Patterny:</strong> {info.patterns}
                                          </div>
                                          <div className="fe-info-desc">{info.description}</div>
                                        </div>
                                      )}
                                      
                                      {!isCollapsed && (
                                        <div className="fib-grid">
                                          {feGroups[leg].map(({ name, price, level }) => {
                                            const visible = isLineVisible(pattern.id, 'fiboFE', name);
                                            return (
                                              <button
                                                key={name}
                                                className={`fib-item clickable ${visible ? 'visible' : 'hidden'}`}
                                                onClick={(e) => handleFibLineClick(e, pattern.id, 'fiboFE', name)}
                                                title={visible ? 'Click to hide' : 'Click to show'}
                                              >
                                                <span className="fib-lvl">{(level * 100).toFixed(1)}%</span>
                                                <span className="fib-prc">{price?.toFixed(6)}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                              <div className="shared-intervals">
                                <span className="shared-label">Shared on:</span>
                                <div className="interval-buttons">
                                  {getOtherIntervals(pattern.interval).map((int) => (
                                    <button
                                      key={int}
                                      className={`interval-btn ${isIntervalShared(pattern.id, 'fiboFE', int) ? 'active' : ''}`}
                                      onClick={(e) => handleSharedIntervalClick(e, pattern.id, 'fiboFE', int, pattern)}
                                      title={`Share on ${int} chart`}
                                    >
                                      {int}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {patternOptions.showTPPRZSL && fibLevels.all_targets && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-targets">TP / PRZ / SL</div>
                              <div className="fib-grid targets">
                                {Object.entries(fibLevels.all_targets).map(([name, data]) => {
                                  let type = 'tp';
                                  if (name.includes('SL') || name.includes('stop')) type = 'sl';
                                  else if (name.includes('PRZ')) type = 'prz';
                                  const visible = isLineVisible(pattern.id, 'tpPrzSl', name);
                                  return (
                                    <button
                                      key={name}
                                      className={`fib-item clickable target-${type} ${visible ? 'visible' : 'hidden'}`}
                                      onClick={(e) => handleFibLineClick(e, pattern.id, 'tpPrzSl', name)}
                                      title={visible ? 'Click to hide' : 'Click to show'}
                                    >
                                      <span className="fib-lvl">{name}</span>
                                      <span className="fib-prc">{data.price?.toFixed(6)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="shared-intervals">
                                <span className="shared-label">Shared on:</span>
                                <div className="interval-buttons">
                                  {getOtherIntervals(pattern.interval).map((int) => (
                                    <button
                                      key={int}
                                      className={`interval-btn ${isIntervalShared(pattern.id, 'tpPrzSl', int) ? 'active' : ''}`}
                                      onClick={(e) => handleSharedIntervalClick(e, pattern.id, 'tpPrzSl', int, pattern)}
                                      title={`Share on ${int} chart`}
                                    >
                                      {int}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Completion Zone */}
                          <div className="details-section">
                            <div className="details-title">Completion Zone</div>
                            <div className="completion-row">
                              <div className="completion-item max">
                                <span>Max</span>
                                <span>{taData.completion_max_price?.toFixed(6)}</span>
                              </div>
                              <div className="completion-item min">
                                <span>Min</span>
                                <span>{taData.completion_min_price?.toFixed(6)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Shared Lines Info Section */}
      {sharedLinesList.length > 0 && (
        <div className="shared-lines-section">
          <div className="shared-lines-header">
            <span className="shared-lines-icon">⬡</span>
            <span className="shared-lines-title">Shared Lines</span>
            <span className="shared-lines-count">{sharedLinesList.length}</span>
          </div>
          <div className="shared-lines-list">
            {sharedLinesList.map((item, index) => (
              <div key={`${item.patternId}-${item.category}-${index}`} className="shared-line-item">
                <div className="shared-line-info">
                  <span className={`shared-line-direction ${item.isBullish ? 'bullish' : 'bearish'}`}>
                    {item.isBullish ? '▲' : '▼'}
                  </span>
                  <span className="shared-line-pattern">{item.patternType}</span>
                  <span className="shared-line-interval">{item.patternInterval}</span>
                </div>
                <div className="shared-line-category">{item.category}</div>
                <div className="shared-line-targets">
                  <span className="shared-to-label">→</span>
                  {item.sharedTo.map((int) => (
                    <span 
                      key={int} 
                      className={`shared-to-interval ${int === currentInterval ? 'current' : ''}`}
                    >
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default PatternsPanel;

