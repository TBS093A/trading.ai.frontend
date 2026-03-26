import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TradingViewChart from '../Chart/TradingViewChart';
import IndicatorControls from '../IndicatorControls/IndicatorControls';
import SaveAnalysisModal from './SaveAnalysisModal';
import { fetchKlines, fetchPatternCounts, setInterval } from '../../store/slices/chartSlice';
import { fetchTechnicalAnalysis, clearAnalysis } from '../../store/slices/analysisSlice';
import { selectEditingAnalysisId } from '../../store/slices/savedAnalysisSlice';
import './Dashboard.css';

const Dashboard = forwardRef((props, ref) => {
  const chartRef = useRef(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  // Expose centerOnPattern method to parent
  useImperativeHandle(ref, () => ({
    centerOnPattern: (pattern) => {
      chartRef.current?.centerOnPattern(pattern);
    }
  }), []);
  const dispatch = useDispatch();
  const { selectedAsset } = useSelector((state) => state.assets);
  const { selectedExchange } = useSelector((state) => state.exchanges);
  const { klines, interval, availableIntervals, patternCounts, loading: chartLoading, asset, quote, full_name } = useSelector((state) => state.chart);
  const { loading: analysisLoading } = useSelector((state) => state.analysis);
  const editingAnalysisId = useSelector(selectEditingAnalysisId);
  const isEditMode = !!editingAnalysisId;

  // Fetch klines when asset or interval changes
  useEffect(() => {
    if (selectedAsset && interval) {
      dispatch(fetchKlines({ assetId: selectedAsset.id, interval, limit: 500 }));
    }
  }, [dispatch, selectedAsset, interval]);

  // Fetch pattern counts when asset changes
  useEffect(() => {
    if (selectedAsset) {
      dispatch(fetchPatternCounts(selectedAsset.id));
    }
  }, [dispatch, selectedAsset]);

  // Fetch technical analysis after klines are loaded
  useEffect(() => {
    if (selectedAsset && klines.length > 0 && interval) {
      const startTimestamp = klines[0]?.open_time;
      const endTimestamp = klines[klines.length - 1]?.open_time;
      
      dispatch(fetchTechnicalAnalysis({
        assetId: selectedAsset.id,
        interval,
        startTimestamp,
        endTimestamp,
      }));
    }
  }, [dispatch, selectedAsset, klines, interval]);

  const handleIntervalChange = useCallback((newInterval) => {
    dispatch(setInterval(newInterval));
    dispatch(clearAnalysis());
  }, [dispatch]);

  // Show welcome screen if no asset selected
  if (!selectedAsset) {
    return (
      <div className="dashboard">
        <div className="welcome-screen">
          <div className="welcome-content">
            <div className="welcome-icon">◈</div>
            <h1 className="welcome-title">00x097 Trade Dashboard</h1>
            <p className="welcome-subtitle">
              Select an asset from the sidebar to start analyzing harmonic patterns
            </p>
            <div className="welcome-features">
              <div className="feature">
                <span className="feature-icon">◎</span>
                <span>Harmonic Patterns Detection</span>
              </div>
              <div className="feature">
                <span className="feature-icon">⬡</span>
                <span>Fibonacci Retracements & Extensions</span>
              </div>
              <div className="feature">
                <span className="feature-icon">⬢</span>
                <span>Technical Indicators</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header Bar */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="asset-info-row">
            <h2 className="asset-name">
              {asset}<span className="quote-name">/{quote}</span>
            </h2>
            {full_name && (
              <span className="asset-full-name-label">{full_name}</span>
            )}
          </div>
          <span className="exchange-badge">{selectedExchange?.name}</span>
        </div>

        <div className="header-center">
          <div className="interval-selector">
            {availableIntervals.map((int) => {
              const counts = patternCounts[int];
              const total = counts ? counts.bullish + counts.bearish : 0;
              return (
                <button
                  key={int}
                  className={`interval-btn ${interval === int ? 'active' : ''}`}
                  onClick={() => handleIntervalChange(int)}
                >
                  <span className="interval-label">{int}</span>
                  {total > 0 && (
                    <span className="interval-pattern-count">
                      <span className="ipc-bullish">{counts.bullish}</span>
                      <span className="ipc-sep">:</span>
                      <span className="ipc-bearish">{counts.bearish}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="header-right">
          <IndicatorControls />
          <button
            className={`save-analysis-btn ${isEditMode ? 'edit-mode' : ''}`}
            onClick={() => setShowSaveModal(true)}
            title={isEditMode ? "Update current analysis" : "Save current analysis view"}
          >
            {isEditMode ? 'Update' : 'Save'}
          </button>
        </div>
      </header>

      {/* Save Analysis Modal */}
      <SaveAnalysisModal 
        isOpen={showSaveModal} 
        onClose={() => setShowSaveModal(false)} 
      />

      {/* Main Chart Area */}
      <div className="chart-container">
        {(chartLoading || analysisLoading) && (
          <div className="chart-loader">
            <div className="loader-spinner"></div>
            <span>{chartLoading ? 'Loading chart data...' : 'Loading analysis...'}</span>
          </div>
        )}
        
        <TradingViewChart ref={chartRef} />
      </div>
    </div>
  );
});

export default Dashboard;

