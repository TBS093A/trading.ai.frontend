import React, { useEffect, useState } from 'react';
import StatsView from './StatsView';
import AlertsView from './AlertsView';
import TrackedAssetsView from './TrackedAssetsView';
import './AlertsViews.css';

const TABS = [
  { key: 'performance', label: 'Performance', Component: StatsView },
  { key: 'alerts', label: 'Alerts', Component: AlertsView },
  { key: 'tracked', label: 'Tracked assets', Component: TrackedAssetsView },
];
const TAB_KEY = 'stats.tab';

const loadTab = () => {
  try {
    const stored = localStorage.getItem(TAB_KEY);
    return TABS.some((t) => t.key === stored) ? stored : 'performance';
  } catch {
    return 'performance';
  }
};

// Harmonic setups area: performance stats, alert settings/history, tracked assets
const SetupsHub = () => {
  const [tab, setTab] = useState(loadTab);

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* not remembered */ }
  }, [tab]);

  const { Component } = TABS.find((t) => t.key === tab);

  return (
    <div className="setups-hub">
      <nav className="hub-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`hub-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <Component />
    </div>
  );
};

export default SetupsHub;
