import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebarPanel, setAccountModalOpen, setMainView } from '../../store/slices/uiSlice';
import { selectUser, selectIsAdmin, selectAvatar } from '../../store/slices/authSlice';
import './NavRail.css';

// Dashboard groups (clicking the active one goes back to the chart)
const DASHBOARD_BUTTONS = [
  { view: 'stats', icon: '◔', label: 'Setup performance' },
  { view: 'model', icon: '▥', label: 'Strength model & benchmarks' },
  { view: 'trading', icon: '⇅', label: 'Paper trading' },
  { view: 'alerts', icon: '✉', label: 'Alerts & tracked assets' },
];

const RailButton = ({ icon, label, active, onClick, pulse }) => (
  <button
    className={`rail-btn ${active ? 'active' : ''}`}
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={active}
  >
    <span className="rail-icon">{icon}</span>
    {pulse && <span className="rail-pulse" />}
  </button>
);

const NavRail = () => {
  const dispatch = useDispatch();
  const sidebarPanel = useSelector((state) => state.ui.sidebarPanel);
  const mainView = useSelector((state) => state.ui.mainView);
  const user = useSelector(selectUser);
  const isAdmin = useSelector(selectIsAdmin);
  const avatar = useSelector(selectAvatar);
  const activeTasks = useSelector((state) => state.sync.activeTasks);

  const hasActiveTasks = Object.values(activeTasks).some(
    (task) => task.status === 'PENDING' || task.status === 'STARTED'
  );

  const toggle = (panel) => dispatch(toggleSidebarPanel(panel));

  return (
    <nav className="nav-rail">
      <div className="rail-logo" title="00x097 Trade">◈</div>

      <div className="rail-group">
        <RailButton
          icon="⬢"
          label="Markets"
          active={sidebarPanel === 'markets'}
          onClick={() => toggle('markets')}
        />
        <RailButton
          icon="☰"
          label="Saved analyses"
          active={sidebarPanel === 'saved'}
          onClick={() => toggle('saved')}
        />
        {isAdmin && (
          <RailButton
            icon="⇋"
            label="Synchronization"
            active={sidebarPanel === 'sync'}
            onClick={() => toggle('sync')}
            pulse={hasActiveTasks}
          />
        )}
        <div className="rail-divider" />
        {DASHBOARD_BUTTONS.map(({ view, icon, label }) => (
          <RailButton
            key={view}
            icon={icon}
            label={label}
            active={mainView === view}
            onClick={() => dispatch(setMainView(mainView === view ? 'chart' : view))}
          />
        ))}
      </div>

      <button
        className="rail-avatar"
        onClick={() => dispatch(setAccountModalOpen(true))}
        title={`${user?.username || 'Account'} – account settings`}
        aria-label="Account settings"
      >
        {avatar ? (
          <img src={`data:image/jpeg;base64,${avatar}`} alt="" />
        ) : (
          <span>{user?.username?.charAt(0).toUpperCase() || '?'}</span>
        )}
      </button>
    </nav>
  );
};

export default NavRail;
