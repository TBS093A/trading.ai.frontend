import React, { useMemo, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setSelectedPattern, 
  toggleExpandedPattern,
  setUnselectedAlpha,
  toggleAutoCenterOnSelect,
  togglePatternDisplayOption,
  toggleFibLineVisibility,
  toggleShowPointLevelLines,
  setLineDisplayStyle,
  toggleShowPatternShapes,
  toggleShowRetraceLines,
  toggleMonochromaticMode,
  toggleShowUnselectedLabels,
} from '../../store/slices/analysisSlice';
import { togglePatternsPanel } from '../../store/slices/uiSlice';
import './PatternsPanel.css';

const PatternsPanel = ({ isOpen, onCenterPattern }) => {
  const dispatch = useDispatch();
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const { 
    harmonicPatterns, 
    selectedPattern, 
    expandedPatternId,
    unselectedAlpha,
    autoCenterOnSelect,
    patternDisplayOptions,
    globalPatternDisplay,
  } = useSelector((state) => state.analysis);

  // Helper to get display options for a pattern
  const getPatternOptions = useCallback((patternId) => {
    return patternDisplayOptions[patternId] || {
      showInternalFibo: false,
      showExternalFibo: false,
      showFiboFE: false,
      showTPPRZSL: false,
      hiddenLines: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
    };
  }, [patternDisplayOptions]);

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
                            </div>
                          )}

                          {patternOptions.showFiboFE && fibLevels.fe_extensions && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-fe">Fibo FE</div>
                              <div className="fib-grid">
                                {Object.entries(fibLevels.fe_extensions).map(([name, data]) => {
                                  const visible = isLineVisible(pattern.id, 'fiboFE', name);
                                  return (
                                    <button
                                      key={name}
                                      className={`fib-item clickable ${visible ? 'visible' : 'hidden'}`}
                                      onClick={(e) => handleFibLineClick(e, pattern.id, 'fiboFE', name)}
                                      title={visible ? 'Click to hide' : 'Click to show'}
                                    >
                                      <span className="fib-lvl">{name}</span>
                                      <span className="fib-prc">{data.price?.toFixed(6)}</span>
                                    </button>
                                  );
                                })}
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
    </aside>
  );
};

export default PatternsPanel;

