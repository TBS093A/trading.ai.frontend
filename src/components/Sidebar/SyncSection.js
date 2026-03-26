import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setActiveSection,
  syncExchanges,
  syncTechnicalAnalysis,
  syncBulkAssets,
  clearSyncError,
  removeTask,
} from '../../store/slices/syncSlice';
import { selectIsAdmin } from '../../store/slices/authSlice';
import api from '../../services/api';
import './SyncSection.css';

const SyncSection = () => {
  const dispatch = useDispatch();
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeSection, exchanges: exchangesSync, technical, bulk, activeTasks } = useSelector(
    (state) => state.sync
  );
  const { list: exchangesList } = useSelector((state) => state.exchanges);
  const isAdmin = useSelector(selectIsAdmin);

  // Form states
  const [exchangesParams, setExchangesParams] = useState({ testMode: false });
  const [technicalParams, setTechnicalParams] = useState({
    limit: 50,
    offset: 0,
    testMode: false,
  });
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
  const [bulkTestMode, setBulkTestMode] = useState(false);

  // Bulk sync specific states
  const [bulkExchangeId, setBulkExchangeId] = useState('');
  const [bulkAssets, setBulkAssets] = useState([]);
  const [bulkAssetsLoading, setBulkAssetsLoading] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState('');

  // Tasks & Health states
  const [serverTasks, setServerTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [taskDetails, setTaskDetails] = useState({});

  // Fetch server tasks
  const fetchServerTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const response = await api.getAllSyncTasks();
      setServerTasks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch server tasks:', error);
      setServerTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Fetch task details
  const fetchTaskDetails = useCallback(async (taskId) => {
    try {
      const response = await api.getSyncTaskStatus(taskId);
      setTaskDetails((prev) => ({ ...prev, [taskId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch task details:', error);
    }
  }, []);

  // Cancel task
  const handleCancelTask = useCallback(async (taskId) => {
    try {
      await api.cancelSyncTask(taskId);
      fetchServerTasks(); // Refresh task list
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  }, [fetchServerTasks]);

  // Fetch health check
  const fetchHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    try {
      const response = await api.getSyncHealth();
      setHealthData(response.data);
    } catch (error) {
      console.error('Failed to fetch health check:', error);
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch assets when bulk exchange changes
  useEffect(() => {
    if (bulkExchangeId) {
      setBulkAssetsLoading(true);
      setSelectedAssetIds(new Set());
      api.getAssetsByExchange(bulkExchangeId)
        .then((response) => {
          setBulkAssets(response.data.assets || []);
        })
        .catch((error) => {
          console.error('Failed to fetch assets for bulk sync:', error);
          setBulkAssets([]);
        })
        .finally(() => {
          setBulkAssetsLoading(false);
        });
    } else {
      setBulkAssets([]);
      setSelectedAssetIds(new Set());
    }
  }, [bulkExchangeId]);

  // Auto-fetch tasks when tasks section is active
  useEffect(() => {
    if (activeSection === 'tasks') {
      fetchServerTasks();
    }
  }, [activeSection, fetchServerTasks]);

  // Auto-fetch health when health section is active
  useEffect(() => {
    if (activeSection === 'health') {
      fetchHealthCheck();
    }
  }, [activeSection, fetchHealthCheck]);

  // Filter assets based on search term
  const filteredBulkAssets = useMemo(() => {
    if (!bulkSearchTerm.trim()) {
      return bulkAssets;
    }
    const search = bulkSearchTerm.toLowerCase();
    return bulkAssets.filter(
      (asset) =>
        asset.asset.toLowerCase().includes(search) ||
        asset.quote.toLowerCase().includes(search) ||
        `${asset.asset}/${asset.quote}`.toLowerCase().includes(search) ||
        (asset.full_name && asset.full_name.toLowerCase().includes(search))
    );
  }, [bulkAssets, bulkSearchTerm]);

  // Handle sync exchanges
  const handleSyncExchanges = () => {
    dispatch(syncExchanges({ testMode: exchangesParams.testMode }));
  };

  // Handle sync technical analysis
  const handleSyncTechnical = () => {
    dispatch(
      syncTechnicalAnalysis({
        limit: technicalParams.limit,
        offset: technicalParams.offset,
        testMode: technicalParams.testMode,
      })
    );
  };

  // Handle sync bulk assets
  const handleSyncBulk = () => {
    const assetIds = Array.from(selectedAssetIds);
    if (assetIds.length === 0) {
      return;
    }
    dispatch(syncBulkAssets({ assetIds, testMode: bulkTestMode }));
  };

  // Toggle asset selection
  const toggleAssetSelection = (assetId) => {
    const newSet = new Set(selectedAssetIds);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedAssetIds(newSet);
  };

  // Select/deselect all (works on filtered list)
  const toggleSelectAll = () => {
    const filteredIds = new Set(filteredBulkAssets.map((a) => a.id));
    const allFilteredSelected = filteredBulkAssets.every((a) => selectedAssetIds.has(a.id));
    
    if (allFilteredSelected) {
      // Deselect all filtered
      const newSet = new Set(selectedAssetIds);
      filteredIds.forEach((id) => newSet.delete(id));
      setSelectedAssetIds(newSet);
    } else {
      // Select all filtered
      const newSet = new Set(selectedAssetIds);
      filteredIds.forEach((id) => newSet.add(id));
      setSelectedAssetIds(newSet);
    }
  };

  // Check if all filtered are selected
  const allFilteredSelected = filteredBulkAssets.length > 0 && 
    filteredBulkAssets.every((a) => selectedAssetIds.has(a.id));

  // Get task status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return '✓';
      case 'FAILURE': return '✗';
      case 'PENDING':
      case 'STARTED': return '⟳';
      default: return '•';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'SUCCESS': return 'status-success';
      case 'FAILURE': return 'status-error';
      case 'PENDING':
      case 'STARTED': return 'status-pending';
      default: return '';
    }
  };

  const activeTasksList = Object.entries(activeTasks);
  const hasActiveTasks = activeTasksList.some(
    ([_, task]) => task.status === 'PENDING' || task.status === 'STARTED'
  );

  return (
    <div className="sync-section-wrapper">
      {/* Main dropdown toggle */}
      <button
        className={`sync-dropdown-toggle ${isExpanded ? 'expanded' : ''} ${hasActiveTasks ? 'has-tasks' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="toggle-icon">⟳</span>
        <span className="toggle-text">Synchronization</span>
        {!isAdmin && <span className="admin-lock-icon" title="Wymaga uprawnień administratora">🔒</span>}
        {hasActiveTasks && <span className="active-badge pulse" />}
        <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="sync-dropdown-content">
          {/* Admin restriction notice */}
          {!isAdmin && (
            <div className="admin-notice">
              <span className="notice-icon">🔒</span>
              <span className="notice-text">Operacje synchronizacji są dostępne tylko dla administratorów</span>
            </div>
          )}

          {/* Active tasks mini list */}
          {activeTasksList.length > 0 && (
            <div className="tasks-mini">
              {activeTasksList.slice(0, 3).map(([taskId, task]) => (
                <div key={taskId} className={`task-mini-item ${getStatusClass(task.status)}`}>
                  <span className="task-icon">{getStatusIcon(task.status)}</span>
                  <span className="task-name">
                    {task.type === 'exchanges' && 'Exchanges'}
                    {task.type === 'technical' && 'Analysis'}
                    {task.type === 'bulk' && 'Bulk'}
                  </span>
                  <button
                    className="task-dismiss"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(removeTask(taskId));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sync Exchanges */}
          <div className="sync-item">
            <button
              className={`sync-item-header ${activeSection === 'exchanges' ? 'active' : ''}`}
              onClick={() => dispatch(setActiveSection(activeSection === 'exchanges' ? null : 'exchanges'))}
            >
              <span className="item-icon">⇋</span>
              <span className="item-title">Exchanges</span>
              <span className="item-arrow">{activeSection === 'exchanges' ? '−' : '+'}</span>
            </button>

            {activeSection === 'exchanges' && (
              <div className="sync-item-content">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={exchangesParams.testMode}
                    onChange={(e) => setExchangesParams({ testMode: e.target.checked })}
                  />
                  <span>Test Mode</span>
                </label>

                {exchangesSync.error && (
                  <div className="error-msg">
                    {exchangesSync.error}
                    <button onClick={() => dispatch(clearSyncError('exchanges'))}>×</button>
                  </div>
                )}

                <button
                  className="sync-action-btn"
                  onClick={handleSyncExchanges}
                  disabled={exchangesSync.loading || !isAdmin}
                  title={!isAdmin ? 'Wymaga uprawnień administratora' : ''}
                >
                  {exchangesSync.loading ? '⟳ Syncing...' : '⟳ Sync'}
                </button>
              </div>
            )}
          </div>

          {/* Sync Technical Analysis */}
          <div className="sync-item">
            <button
              className={`sync-item-header ${activeSection === 'technical' ? 'active' : ''}`}
              onClick={() => dispatch(setActiveSection(activeSection === 'technical' ? null : 'technical'))}
            >
              <span className="item-icon">📊</span>
              <span className="item-title">Technical Analysis</span>
              <span className="item-arrow">{activeSection === 'technical' ? '−' : '+'}</span>
            </button>

            {activeSection === 'technical' && (
              <div className="sync-item-content">
                <div className="param-row">
                  <label>
                    Limit:
                    <input
                      type="number"
                      value={technicalParams.limit}
                      onChange={(e) =>
                        setTechnicalParams({
                          ...technicalParams,
                          limit: Math.min(1000, Math.max(1, parseInt(e.target.value) || 50)),
                        })
                      }
                      min={1}
                      max={1000}
                    />
                  </label>
                  <label>
                    Offset:
                    <input
                      type="number"
                      value={technicalParams.offset}
                      onChange={(e) =>
                        setTechnicalParams({
                          ...technicalParams,
                          offset: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      min={0}
                    />
                  </label>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={technicalParams.testMode}
                    onChange={(e) =>
                      setTechnicalParams({ ...technicalParams, testMode: e.target.checked })
                    }
                  />
                  <span>Test Mode</span>
                </label>

                {technical.error && (
                  <div className="error-msg">
                    {technical.error}
                    <button onClick={() => dispatch(clearSyncError('technical'))}>×</button>
                  </div>
                )}

                <button
                  className="sync-action-btn"
                  onClick={handleSyncTechnical}
                  disabled={technical.loading || !isAdmin}
                  title={!isAdmin ? 'Wymaga uprawnień administratora' : ''}
                >
                  {technical.loading ? '⟳ Analyzing...' : '📊 Run Analysis'}
                </button>
              </div>
            )}
          </div>

          {/* Bulk Assets Sync */}
          <div className="sync-item">
            <button
              className={`sync-item-header ${activeSection === 'bulk' ? 'active' : ''}`}
              onClick={() => dispatch(setActiveSection(activeSection === 'bulk' ? null : 'bulk'))}
            >
              <span className="item-icon">📦</span>
              <span className="item-title">Bulk Sync</span>
              <span className="item-arrow">{activeSection === 'bulk' ? '−' : '+'}</span>
            </button>

            {activeSection === 'bulk' && (
              <div className="sync-item-content">
                {/* Exchange selector for bulk */}
                <div className="bulk-filter-group">
                  <label className="filter-label">
                    <span className="filter-icon">⬡</span>
                    Exchange
                  </label>
                  <select
                    className="bulk-exchange-select"
                    value={bulkExchangeId}
                    onChange={(e) => setBulkExchangeId(e.target.value)}
                  >
                    <option value="">-- Select exchange --</option>
                    {exchangesList.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.display_name || ex.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search bar for assets */}
                {bulkExchangeId && (
                  <div className="bulk-filter-group">
                    <label className="filter-label">
                      <span className="filter-icon">⌕</span>
                      Search asset
                    </label>
                    <div className="bulk-search-wrapper">
                      <input
                        type="text"
                        className="bulk-search-input"
                        placeholder="e.g. BTC, ETH, USDT..."
                        value={bulkSearchTerm}
                        onChange={(e) => setBulkSearchTerm(e.target.value)}
                      />
                      {bulkSearchTerm && (
                        <button
                          className="bulk-search-clear"
                          onClick={() => setBulkSearchTerm('')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!bulkExchangeId ? (
                  <div className="info-msg">Select exchange to see assets</div>
                ) : bulkAssetsLoading ? (
                  <div className="info-msg">
                    <span className="loading-spinner">⟳</span> Loading assets...
                  </div>
                ) : bulkAssets.length === 0 ? (
                  <div className="info-msg">No assets for selected exchange</div>
                ) : (
                  <>
                    <div className="bulk-header">
                      <span className="selected-count">
                        Selected: {selectedAssetIds.size}
                        {bulkSearchTerm && ` (visible: ${filteredBulkAssets.length}/${bulkAssets.length})`}
                        {!bulkSearchTerm && ` / ${bulkAssets.length}`}
                      </span>
                      <button className="select-all-btn" onClick={toggleSelectAll}>
                        {allFilteredSelected ? 'Deselect visible' : 'Select visible'}
                      </button>
                    </div>

                    <div className="asset-checkboxes">
                      {filteredBulkAssets.length === 0 ? (
                        <div className="no-results">No results for "{bulkSearchTerm}"</div>
                      ) : (
                        filteredBulkAssets.map((asset) => (
                          <label key={asset.id} className="asset-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.has(asset.id)}
                              onChange={() => toggleAssetSelection(asset.id)}
                            />
                            <span className="asset-name">
                              {asset.full_name ? (
                                <>{asset.full_name} <span className="ticker-hint">({asset.asset})</span><span className="quote">/{asset.quote}</span></>
                              ) : (
                                <>{asset.asset}<span className="quote">/{asset.quote}</span></>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={bulkTestMode}
                        onChange={(e) => setBulkTestMode(e.target.checked)}
                      />
                      <span>Test Mode</span>
                    </label>

                    {bulk.error && (
                      <div className="error-msg">
                        {bulk.error}
                        <button onClick={() => dispatch(clearSyncError('bulk'))}>×</button>
                      </div>
                    )}

                    {bulk.lastTask && (
                      <div className="last-task">
                        Last: {bulk.lastTask.task_id?.slice(0, 8)}... ({bulk.lastTask.details?.assets_count} assets)
                      </div>
                    )}

                    <button
                      className="sync-action-btn accent"
                      onClick={handleSyncBulk}
                      disabled={bulk.loading || selectedAssetIds.size === 0 || !isAdmin}
                      title={!isAdmin ? 'Wymaga uprawnień administratora' : ''}
                    >
                      {bulk.loading
                        ? '⟳ Processing...'
                        : `📦 Sync (${selectedAssetIds.size})`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tasks List */}
          <div className="sync-item">
            <button
              className={`sync-item-header ${activeSection === 'tasks' ? 'active' : ''}`}
              onClick={() => dispatch(setActiveSection(activeSection === 'tasks' ? null : 'tasks'))}
            >
              <span className="item-icon">📋</span>
              <span className="item-title">Tasks</span>
              {serverTasks.length > 0 && (
                <span className="task-count-badge">{serverTasks.length}</span>
              )}
              <span className="item-arrow">{activeSection === 'tasks' ? '−' : '+'}</span>
            </button>

            {activeSection === 'tasks' && (
              <div className="sync-item-content">
                <div className="tasks-header">
                  <span className="tasks-title">Server Tasks</span>
                  <button
                    className="refresh-btn"
                    onClick={fetchServerTasks}
                    disabled={tasksLoading}
                    title="Refresh tasks"
                  >
                    <span className={tasksLoading ? 'loading-spinner' : ''}>⟳</span>
                  </button>
                </div>

                {tasksLoading && serverTasks.length === 0 ? (
                  <div className="info-msg">
                    <span className="loading-spinner">⟳</span> Loading tasks...
                  </div>
                ) : serverTasks.length === 0 ? (
                  <div className="info-msg">No active tasks</div>
                ) : (
                  <div className="tasks-list">
                    {serverTasks.map((task) => (
                      <div key={task.task_id} className="task-item">
                        <div
                          className="task-item-header"
                          onClick={() => {
                            if (expandedTaskId === task.task_id) {
                              setExpandedTaskId(null);
                            } else {
                              setExpandedTaskId(task.task_id);
                              fetchTaskDetails(task.task_id);
                            }
                          }}
                        >
                          <span className={`task-status-dot ${getStatusClass(task.status)}`} />
                          <span className="task-name-label">
                            {task.task_name?.split('.').pop() || 'Unknown'}
                          </span>
                          <span className={`task-status-label ${getStatusClass(task.status)}`}>
                            {task.status}
                          </span>
                          <span className="task-expand-arrow">
                            {expandedTaskId === task.task_id ? '▼' : '▶'}
                          </span>
                        </div>

                        {expandedTaskId === task.task_id && (
                          <div className="task-item-details">
                            <div className="task-detail-row">
                              <span className="detail-label">Task ID:</span>
                              <span className="detail-value mono">{task.task_id.slice(0, 12)}...</span>
                            </div>
                            {task.worker && (
                              <div className="task-detail-row">
                                <span className="detail-label">Worker:</span>
                                <span className="detail-value">{task.worker}</span>
                              </div>
                            )}
                            {taskDetails[task.task_id]?.result && (
                              <div className="task-detail-row">
                                <span className="detail-label">Result:</span>
                                <span className="detail-value">
                                  {JSON.stringify(taskDetails[task.task_id].result).slice(0, 50)}...
                                </span>
                              </div>
                            )}
                            {(task.status === 'RUNNING' || task.status === 'PENDING') && isAdmin && (
                              <button
                                className="cancel-task-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelTask(task.task_id);
                                }}
                              >
                                ✕ Cancel Task
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Health Check */}
          <div className="sync-item">
            <button
              className={`sync-item-header ${activeSection === 'health' ? 'active' : ''}`}
              onClick={() => dispatch(setActiveSection(activeSection === 'health' ? null : 'health'))}
            >
              <span className="item-icon">💓</span>
              <span className="item-title">Health Check</span>
              {healthData && (
                <span className={`health-indicator ${healthData.overall_healthy ? 'healthy' : 'unhealthy'}`}>
                  {healthData.overall_healthy ? '●' : '○'}
                </span>
              )}
              <span className="item-arrow">{activeSection === 'health' ? '−' : '+'}</span>
            </button>

            {activeSection === 'health' && (
              <div className="sync-item-content">
                <div className="tasks-header">
                  <span className="tasks-title">System Health</span>
                  <button
                    className="refresh-btn"
                    onClick={fetchHealthCheck}
                    disabled={healthLoading}
                    title="Refresh health check"
                  >
                    <span className={healthLoading ? 'loading-spinner' : ''}>⟳</span>
                  </button>
                </div>

                {healthLoading && !healthData ? (
                  <div className="info-msg">
                    <span className="loading-spinner">⟳</span> Checking health...
                  </div>
                ) : !healthData ? (
                  <div className="info-msg">Click refresh to check health</div>
                ) : (
                  <div className="health-list">
                    <div className={`health-overall ${healthData.overall_healthy ? 'healthy' : 'unhealthy'}`}>
                      <span className="health-overall-icon">
                        {healthData.overall_healthy ? '✓' : '✗'}
                      </span>
                      <span className="health-overall-text">
                        {healthData.overall_healthy ? 'All Systems Operational' : 'Issues Detected'}
                      </span>
                    </div>

                    {healthData.components && Object.entries(healthData.components).map(([name, component]) => (
                      <div 
                        key={name} 
                        className={`health-component ${component.healthy ? 'healthy' : 'unhealthy'}`}
                      >
                        <div className="health-component-header">
                          <span className={`health-dot ${component.healthy ? 'healthy' : 'unhealthy'}`} />
                          <span className="health-component-name">{name}</span>
                          <span className={`health-component-status ${component.healthy ? 'healthy' : 'unhealthy'}`}>
                            {component.healthy ? 'OK' : 'Error'}
                          </span>
                        </div>
                        <div className="health-component-message">
                          {component.message}
                        </div>
                        {component.error && (
                          <div className="health-component-error">
                            {component.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncSection;

