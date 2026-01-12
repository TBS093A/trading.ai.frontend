import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  clearSelectedPattern, 
  togglePanelOption 
} from '../../store/slices/analysisSlice';
import { setRightPanelOpen } from '../../store/slices/uiSlice';
import './RightPanel.css';

const RightPanel = ({ isOpen }) => {
  const dispatch = useDispatch();
  const { selectedPattern, panelOptions } = useSelector((state) => state.analysis);

  if (!selectedPattern) return null;

  const { ta_object_json: taData } = selectedPattern;
  const points = taData?.points || {};
  const fibLevels = taData?.fibonacci_levels || {};

  const handleClose = () => {
    dispatch(clearSelectedPattern());
    dispatch(setRightPanelOpen(false));
  };

  const displayOptions = [
    { key: 'showInternalFibo', label: 'Internal Fibo Retracements', icon: '◐', count: Object.keys(fibLevels.retracement || {}).length },
    { key: 'showExternalFibo', label: 'External Fibo Extensions', icon: '◑', count: Object.keys(fibLevels.extension || {}).length },
    { key: 'showFiboFE', label: 'Fibonacci FE', icon: '◒', count: Object.keys(fibLevels.fe_extensions || {}).length },
    { key: 'showTPPRZSL', label: 'TP / PRZ / SL Levels', icon: '◓', count: Object.keys(fibLevels.all_targets || {}).length },
  ];

  return (
    <aside className={`right-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="panel-header">
        <div className="pattern-badge">
          <span className={`badge ${taData.is_bullish ? 'bullish' : 'bearish'}`}>
            {taData.is_bullish ? '▲' : '▼'}
          </span>
          <div className="pattern-info">
            <h3 className="pattern-type">{taData.pattern_type}</h3>
            <span className="pattern-status">
              {taData.is_formed ? 'Formed' : 'Forming'}
            </span>
          </div>
        </div>
        <button className="close-btn" onClick={handleClose}>✕</button>
      </div>

      {/* Pattern Points */}
      <section className="panel-section">
        <h4 className="section-title">
          <span className="section-icon">◈</span>
          Pattern Points
        </h4>
        <div className="points-grid">
          {['X', 'A', 'B', 'C', 'D'].map((pointName) => {
            const point = points[pointName];
            if (!point) return null;
            return (
              <div key={pointName} className="point-item">
                <span className="point-name">{pointName}</span>
                <span className="point-price">
                  {point.price?.toFixed(8)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Retraces */}
      {taData.retraces && (
        <section className="panel-section">
          <h4 className="section-title">
            <span className="section-icon">⬡</span>
            Pattern Retraces
          </h4>
          <div className="retraces-list">
            {Object.entries(taData.retraces).map(([key, value]) => (
              <div key={key} className="retrace-item">
                <span className="retrace-name">{key}</span>
                <span className="retrace-value">
                  {(value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Display Options */}
      <section className="panel-section">
        <h4 className="section-title">
          <span className="section-icon">⬢</span>
          Display Options
        </h4>
        <div className="options-list">
          {displayOptions.map(({ key, label, icon, count }) => (
            <button
              key={key}
              className={`option-btn ${panelOptions[key] ? 'active' : ''}`}
              onClick={() => dispatch(togglePanelOption(key))}
            >
              <span className="option-icon">{icon}</span>
              <span className="option-label">{label}</span>
              {count > 0 && <span className="option-count">{count}</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Fibonacci Levels Display */}
      {panelOptions.showInternalFibo && fibLevels.retracement && (
        <section className="panel-section fib-section">
          <h4 className="section-title fib-title retracement">
            Internal Fibo Retracements
          </h4>
          <div className="fib-levels-list">
            {Object.entries(fibLevels.retracement).map(([level, price]) => (
              <div key={level} className="fib-level-item">
                <span className="fib-level">{(parseFloat(level) * 100).toFixed(1)}%</span>
                <span className="fib-price">{price.toFixed(8)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {panelOptions.showExternalFibo && fibLevels.extension && (
        <section className="panel-section fib-section">
          <h4 className="section-title fib-title extension">
            External Fibo Extensions
          </h4>
          <div className="fib-levels-list">
            {Object.entries(fibLevels.extension).map(([level, price]) => (
              <div key={level} className="fib-level-item">
                <span className="fib-level">{(parseFloat(level) * 100).toFixed(1)}%</span>
                <span className="fib-price">{price.toFixed(8)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {panelOptions.showFiboFE && fibLevels.fe_extensions && (
        <section className="panel-section fib-section">
          <h4 className="section-title fib-title fe">
            Fibonacci FE
          </h4>
          <div className="fib-levels-list">
            {Object.entries(fibLevels.fe_extensions).map(([name, data]) => (
              <div key={name} className="fib-level-item">
                <span className="fib-level">{name}</span>
                <span className="fib-price">{data.price?.toFixed(8)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {panelOptions.showTPPRZSL && fibLevels.all_targets && (
        <section className="panel-section fib-section">
          <h4 className="section-title fib-title targets">
            TP / PRZ / SL Levels
          </h4>
          <div className="fib-levels-list">
            {Object.entries(fibLevels.all_targets).map(([name, data]) => {
              let className = 'tp';
              if (name.includes('SL') || name.includes('stop')) className = 'sl';
              else if (name.includes('PRZ')) className = 'prz';
              
              return (
                <div key={name} className={`fib-level-item target ${className}`}>
                  <span className="fib-level">{name}</span>
                  <span className="fib-price">{data.price?.toFixed(8)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completion Zone */}
      <section className="panel-section">
        <h4 className="section-title">
          <span className="section-icon">◎</span>
          Completion Zone
        </h4>
        <div className="completion-zone">
          <div className="completion-item">
            <span className="completion-label">Max Price</span>
            <span className="completion-value max">
              {taData.completion_max_price?.toFixed(8)}
            </span>
          </div>
          <div className="completion-item">
            <span className="completion-label">Min Price</span>
            <span className="completion-value min">
              {taData.completion_min_price?.toFixed(8)}
            </span>
          </div>
        </div>
      </section>

      {/* Meta Info */}
      <section className="panel-section meta-section">
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">Tolerance</span>
            <span className="meta-value">{taData.fib_tolerance_strategy}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Peak Spacing</span>
            <span className="meta-value">{taData.peak_spacing_strategy}</span>
          </div>
        </div>
      </section>
    </aside>
  );
};

export default RightPanel;

