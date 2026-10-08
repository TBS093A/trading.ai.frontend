import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Dashboard from './components/Dashboard/Dashboard';
import NavRail from './components/Sidebar/NavRail';
import Sidebar from './components/Sidebar/Sidebar';
import AccountModal from './components/Sidebar/AccountModal';
import StatsView from './components/Stats/StatsView';
import PatternsPanel from './components/PatternsPanel/PatternsPanel';
import Login from './components/Login/Login';
import { fetchExchanges } from './store/slices/exchangesSlice';
import { togglePatternsPanel } from './store/slices/uiSlice';
import { 
  verifySession, 
  resetAuth,
  selectIsAuthenticated, 
  selectSessionVerified 
} from './store/slices/authSlice';
import './styles/global.css';

function App() {
  const dispatch = useDispatch();
  const dashboardRef = useRef(null);
  const { patternsPanelOpen, mainView } = useSelector((state) => state.ui);
  const { harmonicPatterns } = useSelector((state) => state.analysis);
  
  // Auth state
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const sessionVerified = useSelector(selectSessionVerified);

  // Verify session on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      dispatch(verifySession());
    }
  }, [dispatch]);

  // Listen for unauthorized events from API interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch(resetAuth());
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [dispatch]);

  // Fetch exchanges only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchExchanges());
    }
  }, [dispatch, isAuthenticated]);

  // Callback to center chart on a pattern
  const handleCenterPattern = useCallback((pattern) => {
    dashboardRef.current?.centerOnPattern(pattern);
  }, []);

  // Show patterns panel only when there are patterns
  const showPatternsPanel = harmonicPatterns && harmonicPatterns.length > 0;

  // Show loading spinner while verifying session
  if (!sessionVerified && localStorage.getItem('authToken')) {
    return (
      <div className="app">
        <div className="auth-loading">
          <div className="loader-spinner"></div>
          <span>Weryfikacja sesji...</span>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show main dashboard
  return (
    <div className="app">
      <NavRail />
      <Sidebar />
      <main className="main-content">
        {/* Dashboard stays mounted under the stats view so the chart keeps its data and viewport */}
        <div className={`main-view ${mainView === 'chart' ? '' : 'hidden'}`}>
          <Dashboard ref={dashboardRef} />
        </div>
        {mainView === 'stats' && <StatsView />}

        {/* Toggle button to open patterns panel when closed (and patterns exist) */}
        {mainView === 'chart' && showPatternsPanel && !patternsPanelOpen && (
          <button 
            className="patterns-panel-toggle"
            onClick={() => dispatch(togglePatternsPanel())}
            title="Show Patterns Panel"
          >
            <span className="toggle-icon">⬡</span>
            <span className="toggle-count">{harmonicPatterns.length}</span>
          </button>
        )}
      </main>
      {mainView === 'chart' && showPatternsPanel && (
        <PatternsPanel 
          isOpen={patternsPanelOpen} 
          onCenterPattern={handleCenterPattern}
        />
      )}
      <AccountModal />
    </div>
  );
}

export default App;

