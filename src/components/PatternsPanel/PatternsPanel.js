import React, { useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setSelectedPattern, 
  toggleExpandedPattern,
  setUnselectedAlpha,
  togglePanelOption 
} from '../../store/slices/analysisSlice';
import { togglePatternsPanel } from '../../store/slices/uiSlice';
import './PatternsPanel.css';

const PatternsPanel = ({ isOpen, onCenterPattern }) => {
  const dispatch = useDispatch();
  const { 
    harmonicPatterns, 
    selectedPattern, 
    expandedPatternId,
    unselectedAlpha,
    panelOptions 
  } = useSelector((state) => state.analysis);

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

  const handlePatternClick = useCallback((pattern) => {
    dispatch(setSelectedPattern(pattern));
    dispatch(toggleExpandedPattern(pattern.id));
    
    // Center chart on pattern
    if (onCenterPattern) {
      onCenterPattern(pattern);
    }
  }, [dispatch, onCenterPattern]);

  const handleAlphaChange = useCallback((e) => {
    dispatch(setUnselectedAlpha(parseFloat(e.target.value)));
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

      {/* Alpha Control */}
      <div className="alpha-control">
        <label className="alpha-label">
          <span className="alpha-icon">◔</span>
          Unselected Opacity
          <span className="alpha-value">{Math.round(unselectedAlpha * 100)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={unselectedAlpha}
          onChange={handleAlphaChange}
          className="alpha-slider"
        />
      </div>

      {/* Patterns List */}
      <div className="patterns-list">
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

                  return (
                    <div 
                      key={pattern.id} 
                      className={`pattern-item ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                    >
                      {/* Pattern Header (clickable) */}
                      <button 
                        className="pattern-header"
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
                        <div className="pattern-meta">
                          <span className="pattern-date">{formatTimestamp(dTimestamp)}</span>
                          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▾</span>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="pattern-details">
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

                          {/* Retraces */}
                          {taData.retraces && (
                            <div className="details-section">
                              <div className="details-title">Retraces</div>
                              <div className="retraces-row">
                                {Object.entries(taData.retraces).map(([key, value]) => (
                                  <div key={key} className="retrace-mini">
                                    <span className="retrace-key">{key}</span>
                                    <span className="retrace-val">{(value * 100).toFixed(1)}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Display Options */}
                          <div className="details-section">
                            <div className="details-title">Display</div>
                            <div className="display-options-row">
                              {displayOptions.map(({ key, label, icon }) => {
                                const hasData = key === 'showInternalFibo' ? fibLevels.retracement :
                                               key === 'showExternalFibo' ? fibLevels.extension :
                                               key === 'showFiboFE' ? fibLevels.fe_extensions :
                                               fibLevels.all_targets;
                                return (
                                  <button
                                    key={key}
                                    className={`display-option ${panelOptions[key] ? 'active' : ''} ${!hasData ? 'disabled' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (hasData) dispatch(togglePanelOption(key));
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

                          {/* Fibonacci Levels (when enabled) */}
                          {panelOptions.showInternalFibo && fibLevels.retracement && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-retracement">Internal Fibo</div>
                              <div className="fib-grid">
                                {Object.entries(fibLevels.retracement).slice(0, 6).map(([level, price]) => (
                                  <div key={level} className="fib-item">
                                    <span className="fib-lvl">{(parseFloat(level) * 100).toFixed(1)}%</span>
                                    <span className="fib-prc">{price.toFixed(6)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {panelOptions.showExternalFibo && fibLevels.extension && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-extension">External Fibo</div>
                              <div className="fib-grid">
                                {Object.entries(fibLevels.extension).slice(0, 6).map(([level, price]) => (
                                  <div key={level} className="fib-item">
                                    <span className="fib-lvl">{(parseFloat(level) * 100).toFixed(1)}%</span>
                                    <span className="fib-prc">{price.toFixed(6)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {panelOptions.showFiboFE && fibLevels.fe_extensions && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-fe">Fibo FE</div>
                              <div className="fib-grid">
                                {Object.entries(fibLevels.fe_extensions).slice(0, 6).map(([name, data]) => (
                                  <div key={name} className="fib-item">
                                    <span className="fib-lvl">{name}</span>
                                    <span className="fib-prc">{data.price?.toFixed(6)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {panelOptions.showTPPRZSL && fibLevels.all_targets && (
                            <div className="details-section fib-section">
                              <div className="details-title fib-targets">TP / PRZ / SL</div>
                              <div className="fib-grid targets">
                                {Object.entries(fibLevels.all_targets).slice(0, 8).map(([name, data]) => {
                                  let type = 'tp';
                                  if (name.includes('SL') || name.includes('stop')) type = 'sl';
                                  else if (name.includes('PRZ')) type = 'prz';
                                  return (
                                    <div key={name} className={`fib-item target-${type}`}>
                                      <span className="fib-lvl">{name}</span>
                                      <span className="fib-prc">{data.price?.toFixed(6)}</span>
                                    </div>
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

