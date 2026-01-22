import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  clearSelectedPattern, 
  togglePanelOption 
} from '../../store/slices/analysisSlice';
import { setRightPanelOpen } from '../../store/slices/uiSlice';
import './RightPanel.css';

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

const RightPanel = ({ isOpen }) => {
  const dispatch = useDispatch();
  const { selectedPattern, panelOptions } = useSelector((state) => state.analysis);
  
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
          {/* Group FE levels by leg */}
          {(() => {
            const feGroups = {};
            const legOrder = ['XA', 'BC', 'AB', 'AC', 'ABC', 'BCD'];
            
            Object.entries(fibLevels.fe_extensions).forEach(([name, data]) => {
              const leg = data.leg || name.split('_')[1] || 'OTHER';
              if (!feGroups[leg]) feGroups[leg] = [];
              feGroups[leg].push({ name, ...data });
            });
            
            // Default visible FE legs
            const DEFAULT_VISIBLE_FE_LEGS = ['ABC', 'BCD'];
            
            return legOrder.filter(leg => feGroups[leg]).map((leg) => {
              const isCollapsed = collapsedFEGroups[leg];
              const info = FE_GROUP_INFO[leg];
              const isInfoActive = activeInfoTooltip === leg;
              const isDefaultLeg = DEFAULT_VISIBLE_FE_LEGS.includes(leg);
              
              return (
                <div key={leg} className={`fe-leg-group ${isCollapsed ? 'collapsed' : ''} ${!isDefaultLeg ? 'secondary-group' : ''}`}>
                  <div className="fe-leg-header">
                    <button 
                      className="fe-leg-toggle"
                      onClick={() => setCollapsedFEGroups(prev => ({ ...prev, [leg]: !prev[leg] }))}
                      title={isCollapsed ? 'Rozwiń' : 'Zwiń'}
                    >
                      <span className={`toggle-arrow ${isCollapsed ? '' : 'expanded'}`}>▶</span>
                    </button>
                    <span className="fe-leg-name">FE({leg})</span>
                    <span className="fe-leg-levels">{info?.levels}</span>
                    {!isDefaultLeg && (
                      <span className="fe-secondary-badge" title="Nie wyświetlane domyślnie na wykresie">
                        opcjonalne
                      </span>
                    )}
                    {isDefaultLeg && (
                      <span className="fe-default-badge" title="Wyświetlane domyślnie na wykresie">
                        domyślne
                      </span>
                    )}
                    <button 
                      className={`fe-info-btn ${isInfoActive ? 'active' : ''}`}
                      onClick={() => setActiveInfoTooltip(isInfoActive ? null : leg)}
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
                    <div className="fib-levels-list">
                      {feGroups[leg].map(({ name, price, level }) => (
                        <div key={name} className="fib-level-item">
                          <span className="fib-level">{(level * 100).toFixed(1)}%</span>
                          <span className="fib-price">{price?.toFixed(8)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
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

