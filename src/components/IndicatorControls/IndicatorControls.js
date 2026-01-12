import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleIndicator } from '../../store/slices/analysisSlice';
import './IndicatorControls.css';

const IndicatorControls = () => {
  const dispatch = useDispatch();
  const { indicators } = useSelector((state) => state.analysis);

  const indicatorList = [
    { key: 'volume', label: 'VOL', icon: '▮' },
    { key: 'rsi', label: 'RSI', icon: '∿' },
    { key: 'macd', label: 'MACD', icon: '⇌' },
    { key: 'obv', label: 'OBV', icon: '⬆' },
  ];

  return (
    <div className="indicator-controls">
      <span className="controls-label">Indicators</span>
      <div className="controls-buttons">
        {indicatorList.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`indicator-btn ${indicators[key] ? 'active' : ''}`}
            onClick={() => dispatch(toggleIndicator(key))}
            title={label}
          >
            <span className="indicator-icon">{icon}</span>
            <span className="indicator-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default IndicatorControls;

