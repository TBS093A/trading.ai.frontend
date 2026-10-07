import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSidebarPanel } from '../../store/slices/uiSlice';
import { selectIsAdmin } from '../../store/slices/authSlice';
import MarketsPanel from './MarketsPanel';
import SavedAnalysisSection from './SavedAnalysisSection';
import SyncSection from './SyncSection';
import './Sidebar.css';

const PANEL_TITLES = {
  markets: 'Markets',
  saved: 'Saved Analyses',
  sync: 'Synchronization',
};

const Sidebar = () => {
  const dispatch = useDispatch();
  const sidebarPanel = useSelector((state) => state.ui.sidebarPanel);
  const isAdmin = useSelector(selectIsAdmin);

  // Sync panel is admin-only; a stale persisted value for a non-admin shows nothing
  const panel = sidebarPanel === 'sync' && !isAdmin ? null : sidebarPanel;

  return (
    <aside className={`sidebar ${panel ? 'open' : ''}`}>
      {panel && (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">{PANEL_TITLES[panel]}</span>
            <button
              className="sidebar-toggle"
              onClick={() => dispatch(setSidebarPanel(null))}
              title="Collapse panel"
              aria-label="Collapse panel"
            >
              ◀
            </button>
          </div>

          <div className="sidebar-body">
            {panel === 'markets' && <MarketsPanel />}
            {panel === 'saved' && <SavedAnalysisSection embedded />}
            {panel === 'sync' && <SyncSection embedded />}
          </div>
        </>
      )}
    </aside>
  );
};

export default Sidebar;
