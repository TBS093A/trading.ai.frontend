import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Dashboard from './components/Dashboard/Dashboard';
import Sidebar from './components/Sidebar/Sidebar';
import PatternsPanel from './components/PatternsPanel/PatternsPanel';
import PatternTooltip from './components/PatternTooltip/PatternTooltip';
import { fetchExchanges } from './store/slices/exchangesSlice';
import { togglePatternsPanel } from './store/slices/uiSlice';
import './styles/global.css';

function App() {
  const dispatch = useDispatch();
  const dashboardRef = useRef(null);
  const { sidebarOpen, patternsPanelOpen } = useSelector((state) => state.ui);
  const { harmonicPatterns } = useSelector((state) => state.analysis);

  useEffect(() => {
    dispatch(fetchExchanges());
  }, [dispatch]);

  // Callback to center chart on a pattern
  const handleCenterPattern = useCallback((pattern) => {
    dashboardRef.current?.centerOnPattern(pattern);
  }, []);

  // Show patterns panel only when there are patterns
  const showPatternsPanel = harmonicPatterns && harmonicPatterns.length > 0;

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''} ${showPatternsPanel && patternsPanelOpen ? 'patterns-panel-open' : ''}`}>
        <Dashboard ref={dashboardRef} />
      </main>
      {showPatternsPanel && (
        <PatternsPanel 
          isOpen={patternsPanelOpen} 
          onCenterPattern={handleCenterPattern}
        />
      )}
      {/* Floating toggle button when patterns exist but panel is hidden */}
      {showPatternsPanel && !patternsPanelOpen && (
        <button 
          className="patterns-panel-toggle"
          onClick={() => dispatch(togglePatternsPanel())}
          title="Show Patterns Panel"
        >
          <span className="toggle-icon">⬡</span>
          <span className="toggle-count">{harmonicPatterns.length}</span>
        </button>
      )}
      <PatternTooltip />
    </div>
  );
}

export default App;

