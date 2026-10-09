import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import Dashboard from './components/Dashboard/Dashboard';
import NavRail from './components/Sidebar/NavRail';
import Sidebar from './components/Sidebar/Sidebar';
import AccountModal from './components/Sidebar/AccountModal';
import SetupsHub from './components/Stats/SetupsHub';
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
import { parseDeepLink, applyDeepLink, clearDeepLinkFromUrl } from './utils/deepLink';
import './styles/global.css';

function App() {
  const dispatch = useDispatch();
  const store = useStore();
  const dashboardRef = useRef(null);
  // Link from an alert e-mail; applied once the user is signed in (also right after logging in)
  const deepLinkRef = useRef(parseDeepLink(window.location.search, store.getState().chart.availableIntervals));
  const { patternsPanelOpen, mainView } = useSelector((state) => state.ui);
  const { harmonicPatterns } = useSelector((state) => state.analysis);
  const activeSetupsCount = useSelector((state) => state.setups.active.list.length);
  
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

  useEffect(() => {
    if (!isAuthenticated || !deepLinkRef.current) return;
    const link = deepLinkRef.current;
    deepLinkRef.current = null;
    applyDeepLink(link, dispatch, store.getState).finally(clearDeepLinkFromUrl);
  }, [isAuthenticated, dispatch, store]);

  // Callback to center chart on a pattern
  const handleCenterPattern = useCallback((pattern) => {
    dashboardRef.current?.centerOnPattern(pattern);
  }, []);

  // Show patterns panel only when there are patterns
  // The panel also lists active setups, so show it when there are any even without patterns
  const showPatternsPanel = (harmonicPatterns && harmonicPatterns.length > 0) || activeSetupsCount > 0;

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
        {mainView !== 'chart' && <SetupsHub key={mainView} group={mainView} />}

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

