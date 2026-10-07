import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectingRange, startManual, stopManual } from '../../store/slices/harmonicsSlice';
import './HarmonicsToolbar.css';

// Header buttons for the on-demand harmonics tools; the tools themselves live on the chart
const HarmonicsToolbar = () => {
  const dispatch = useDispatch();
  const { selectingRange, manual } = useSelector((state) => state.harmonics);

  return (
    <div className="harmonics-toolbar">
      <span className="controls-label">Harmonics</span>
      <div className="controls-buttons">
        <button
          className={`indicator-btn ${selectingRange ? 'active' : ''}`}
          onClick={() => dispatch(setSelectingRange(!selectingRange))}
          title="Drag across the chart to search that range for harmonic patterns (click = visible range)"
          aria-pressed={selectingRange}
        >
          <span className="indicator-icon">⌖</span>
          <span className="indicator-label">SCAN</span>
        </button>
        <button
          className={`indicator-btn ${manual.active ? 'active' : ''}`}
          onClick={() => dispatch(manual.active ? stopManual() : startManual())}
          title="Click X, A, B, C, D on the chart to check your own pattern"
          aria-pressed={manual.active}
        >
          <span className="indicator-icon">✎</span>
          <span className="indicator-label">XABCD</span>
        </button>
      </div>
    </div>
  );
};

export default HarmonicsToolbar;
