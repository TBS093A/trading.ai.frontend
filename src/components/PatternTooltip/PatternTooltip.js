import React from 'react';
import { useSelector } from 'react-redux';
import './PatternTooltip.css';

const PatternTooltip = () => {
  const { tooltipPosition, tooltipContent } = useSelector((state) => state.ui);

  if (!tooltipPosition || !tooltipContent) return null;

  const { patternType, isBullish, isFormed } = tooltipContent;

  // Calculate safe position to keep tooltip visible
  const safeX = Math.min(tooltipPosition.x + 15, window.innerWidth - 220);
  const safeY = Math.min(tooltipPosition.y + 15, window.innerHeight - 100);

  return (
    <div
      className="pattern-tooltip fade-in"
      style={{
        left: `${safeX}px`,
        top: `${safeY}px`,
      }}
    >
      <div className="tooltip-header">
        <span className={`direction-icon ${isBullish ? 'bullish' : 'bearish'}`}>
          {isBullish ? '▲' : '▼'}
        </span>
        <span className="pattern-name">{patternType}</span>
      </div>
      <div className="tooltip-body">
        <div className="tooltip-row">
          <span className="tooltip-label">Direction</span>
          <span className={`tooltip-value ${isBullish ? 'bullish' : 'bearish'}`}>
            {isBullish ? 'BULLISH' : 'BEARISH'}
          </span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Status</span>
          <span className={`tooltip-value ${isFormed ? 'formed' : 'forming'}`}>
            {isFormed ? 'FORMED' : 'FORMING'}
          </span>
        </div>
      </div>
      <div className="tooltip-footer">
        Click to view details
      </div>
    </div>
  );
};

export default PatternTooltip;

