import React, { useEffect, useState } from 'react';
import StatsView from './StatsView';
import AlertsView from './AlertsView';
import TrackedAssetsView from './TrackedAssetsView';
import StrengthModelView from './StrengthModelView';
import BenchmarksView from './BenchmarksView';
import './AlertsViews.css';

/**
 * Dashboard groups opened from the nav rail. Each group has its own tabs and remembers
 * its last tab; a group with one view shows no tab bar.
 */
export const DASHBOARD_GROUPS = {
  stats: {
    title: 'Skuteczność formacji',
    tabs: [{ key: 'performance', label: 'Performance', Component: StatsView }],
  },
  model: {
    title: 'Model siły i benchmarki',
    tabs: [
      { key: 'model', label: 'Model siły', Component: StrengthModelView },
      { key: 'benchmarks', label: 'Benchmarki', Component: BenchmarksView },
    ],
  },
  alerts: {
    title: 'Alerty i śledzone assety',
    tabs: [
      { key: 'alerts', label: 'Alerts', Component: AlertsView },
      { key: 'tracked', label: 'Tracked assets', Component: TrackedAssetsView },
    ],
  },
};

const tabKey = (group) => `dashboards.${group}.tab`;

const loadTab = (group) => {
  const { tabs } = DASHBOARD_GROUPS[group];
  try {
    const stored = localStorage.getItem(tabKey(group));
    return tabs.some((t) => t.key === stored) ? stored : tabs[0].key;
  } catch {
    return tabs[0].key;
  }
};

const SetupsHub = ({ group = 'stats' }) => {
  const { tabs } = DASHBOARD_GROUPS[group] || DASHBOARD_GROUPS.stats;
  const [tab, setTab] = useState(() => loadTab(group));

  // Switching groups mounts a fresh hub (keyed by group), so this only follows tab clicks
  useEffect(() => {
    try { localStorage.setItem(tabKey(group), tab); } catch { /* not remembered */ }
  }, [group, tab]);

  const { Component } = tabs.find((t) => t.key === tab) || tabs[0];

  return (
    <div className="setups-hub">
      {tabs.length > 1 && (
        <nav className="hub-tabs" role="tablist">
          {tabs.map((t) => (
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
      )}
      <Component />
    </div>
  );
};

export default SetupsHub;
