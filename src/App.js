import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Dashboard from './components/Dashboard/Dashboard';
import Sidebar from './components/Sidebar/Sidebar';
import RightPanel from './components/RightPanel/RightPanel';
import PatternTooltip from './components/PatternTooltip/PatternTooltip';
import SyncPanel from './components/SyncPanel/SyncPanel';
import { fetchExchanges } from './store/slices/exchangesSlice';
import './styles/global.css';

function App() {
  const dispatch = useDispatch();
  const { sidebarOpen, rightPanelOpen } = useSelector((state) => state.ui);
  const { selectedPattern } = useSelector((state) => state.analysis);

  useEffect(() => {
    dispatch(fetchExchanges());
  }, [dispatch]);

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''} ${rightPanelOpen ? 'panel-open' : ''}`}>
        <Dashboard />
      </main>
      {selectedPattern && <RightPanel isOpen={rightPanelOpen} />}
      <PatternTooltip />
      <SyncPanel />
    </div>
  );
}

export default App;

