import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  toggleSyncPanel,
  setActiveSection,
  syncExchanges,
  syncTechnicalAnalysis,
  syncBulkAssets,
  clearSyncError,
  removeTask,
} from '../../store/slices/syncSlice';
import './SyncPanel.css';

const SyncPanel = () => {
  const dispatch = useDispatch();
  const { isPanelOpen, activeSection, exchanges, technical, bulk, activeTasks } = useSelector(
    (state) => state.sync
  );
  const { assets } = useSelector((state) => state.assets);

  // Form states
  const [exchangesParams, setExchangesParams] = useState({
    testMode: false,
  });

  const [technicalParams, setTechnicalParams] = useState({
    limit: 50,
    offset: 0,
    testMode: false,
  });

  const [bulkParams, setBulkParams] = useState({
    assetIds: '',
    testMode: false,
  });

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
    const assetIds = bulkParams.assetIds
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id) && id > 0);

    if (assetIds.length === 0) {
      alert('Wprowadź przynajmniej jedno poprawne ID assetu');
      return;
    }

    dispatch(syncBulkAssets({ assetIds, testMode: bulkParams.testMode }));
  };

  // Get task status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS':
        return '✓';
      case 'FAILURE':
        return '✗';
      case 'PENDING':
      case 'STARTED':
        return '⟳';
      default:
        return '•';
    }
  };

  // Get task status class
  const getStatusClass = (status) => {
    switch (status) {
      case 'SUCCESS':
        return 'status-success';
      case 'FAILURE':
        return 'status-error';
      case 'PENDING':
      case 'STARTED':
        return 'status-pending';
      default:
        return '';
    }
  };

  const activeTasksList = Object.entries(activeTasks);

  return (
    <div className={`sync-panel ${isPanelOpen ? 'open' : ''}`}>
      {/* Toggle button */}
      <button
        className="sync-toggle-btn"
        onClick={() => dispatch(toggleSyncPanel())}
        title="Synchronizacja"
      >
        <span className="sync-icon">⟳</span>
        {activeTasksList.some(([_, task]) => task.status === 'PENDING' || task.status === 'STARTED') && (
          <span className="sync-badge pulse" />
        )}
      </button>

      {/* Panel content */}
      {isPanelOpen && (
        <div className="sync-panel-content">
          <div className="sync-header">
            <h3>
              <span className="header-icon">⟳</span>
              Synchronizacja
            </h3>
            <button className="close-btn" onClick={() => dispatch(toggleSyncPanel())}>
              ×
            </button>
          </div>

          {/* Active tasks */}
          {activeTasksList.length > 0 && (
            <div className="active-tasks">
              <h4>Aktywne zadania</h4>
              <div className="tasks-list">
                {activeTasksList.map(([taskId, task]) => (
                  <div key={taskId} className={`task-item ${getStatusClass(task.status)}`}>
                    <span className="task-status-icon">{getStatusIcon(task.status)}</span>
                    <div className="task-info">
                      <span className="task-type">
                        {task.type === 'exchanges' && 'Giełdy'}
                        {task.type === 'technical' && 'Analiza Tech.'}
                        {task.type === 'bulk' && 'Bulk Assets'}
                      </span>
                      <span className="task-id">{taskId.slice(0, 8)}...</span>
                    </div>
                    <button
                      className="task-remove-btn"
                      onClick={() => dispatch(removeTask(taskId))}
                      title="Usuń z listy"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync sections */}
          <div className="sync-sections">
            {/* Exchanges Sync */}
            <div className="sync-section">
              <button
                className={`section-header ${activeSection === 'exchanges' ? 'active' : ''}`}
                onClick={() => dispatch(setActiveSection('exchanges'))}
              >
                <span className="section-icon">⇋</span>
                <span className="section-title">Synchronizacja Giełd</span>
                <span className="expand-icon">{activeSection === 'exchanges' ? '▼' : '▶'}</span>
              </button>

              {activeSection === 'exchanges' && (
                <div className="section-content">
                  <p className="section-description">
                    Synchronizuje listę giełd z zewnętrznych API (Binance, etc.)
                  </p>

                  <div className="param-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={exchangesParams.testMode}
                        onChange={(e) =>
                          setExchangesParams({ ...exchangesParams, testMode: e.target.checked })
                        }
                      />
                      <span className="checkbox-text">Test Mode (bez zapisu do bazy)</span>
                    </label>
                  </div>

                  {exchanges.error && (
                    <div className="error-message">
                      <span>{exchanges.error}</span>
                      <button onClick={() => dispatch(clearSyncError('exchanges'))}>×</button>
                    </div>
                  )}

                  {exchanges.lastTask && (
                    <div className="last-task-info">
                      <span className="label">Ostatni task:</span>
                      <span className="task-id">{exchanges.lastTask.task_id?.slice(0, 12)}...</span>
                    </div>
                  )}

                  <button
                    className="sync-btn"
                    onClick={handleSyncExchanges}
                    disabled={exchanges.loading}
                  >
                    {exchanges.loading ? (
                      <>
                        <span className="spinner" />
                        Synchronizuję...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">⟳</span>
                        Synchronizuj Giełdy
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Technical Analysis Sync */}
            <div className="sync-section">
              <button
                className={`section-header ${activeSection === 'technical' ? 'active' : ''}`}
                onClick={() => dispatch(setActiveSection('technical'))}
              >
                <span className="section-icon">📊</span>
                <span className="section-title">Analiza Techniczna</span>
                <span className="expand-icon">{activeSection === 'technical' ? '▼' : '▶'}</span>
              </button>

              {activeSection === 'technical' && (
                <div className="section-content">
                  <p className="section-description">
                    Uruchamia analizę techniczną (harmonic patterns) dla assetów
                  </p>

                  <div className="param-group">
                    <label className="param-label">
                      Limit
                      <input
                        type="number"
                        className="param-input"
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
                    <span className="param-hint">1-1000</span>
                  </div>

                  <div className="param-group">
                    <label className="param-label">
                      Offset
                      <input
                        type="number"
                        className="param-input"
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
                    <span className="param-hint">≥ 0</span>
                  </div>

                  <div className="param-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={technicalParams.testMode}
                        onChange={(e) =>
                          setTechnicalParams({ ...technicalParams, testMode: e.target.checked })
                        }
                      />
                      <span className="checkbox-text">Test Mode (bez zapisu do bazy)</span>
                    </label>
                  </div>

                  {technical.error && (
                    <div className="error-message">
                      <span>{technical.error}</span>
                      <button onClick={() => dispatch(clearSyncError('technical'))}>×</button>
                    </div>
                  )}

                  {technical.lastTask && (
                    <div className="last-task-info">
                      <span className="label">Ostatni task:</span>
                      <span className="task-id">{technical.lastTask.task_id?.slice(0, 12)}...</span>
                    </div>
                  )}

                  <button
                    className="sync-btn"
                    onClick={handleSyncTechnical}
                    disabled={technical.loading}
                  >
                    {technical.loading ? (
                      <>
                        <span className="spinner" />
                        Analizuję...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">📊</span>
                        Uruchom Analizę
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Bulk Assets Sync */}
            <div className="sync-section">
              <button
                className={`section-header ${activeSection === 'bulk' ? 'active' : ''}`}
                onClick={() => dispatch(setActiveSection('bulk'))}
              >
                <span className="section-icon">📦</span>
                <span className="section-title">Bulk Assets (Custom)</span>
                <span className="expand-icon">{activeSection === 'bulk' ? '▼' : '▶'}</span>
              </button>

              {activeSection === 'bulk' && (
                <div className="section-content">
                  <p className="section-description">
                    Uruchamia analizę techniczną dla wybranych assetów (bulk)
                  </p>

                  <div className="param-group">
                    <label className="param-label">
                      Asset IDs
                      <input
                        type="text"
                        className="param-input full-width"
                        value={bulkParams.assetIds}
                        onChange={(e) => setBulkParams({ ...bulkParams, assetIds: e.target.value })}
                        placeholder="np. 1, 2, 3"
                      />
                    </label>
                    <span className="param-hint">ID oddzielone przecinkami</span>
                  </div>

                  {/* Quick select from loaded assets */}
                  {assets && assets.length > 0 && (
                    <div className="quick-select">
                      <span className="quick-select-label">Szybki wybór:</span>
                      <div className="quick-select-chips">
                        {assets.slice(0, 10).map((asset) => (
                          <button
                            key={asset.id}
                            className={`chip ${bulkParams.assetIds.includes(asset.id.toString()) ? 'selected' : ''}`}
                            onClick={() => {
                              const currentIds = bulkParams.assetIds
                                .split(',')
                                .map((id) => id.trim())
                                .filter((id) => id);
                              const assetIdStr = asset.id.toString();

                              if (currentIds.includes(assetIdStr)) {
                                const newIds = currentIds.filter((id) => id !== assetIdStr);
                                setBulkParams({ ...bulkParams, assetIds: newIds.join(', ') });
                              } else {
                                setBulkParams({
                                  ...bulkParams,
                                  assetIds: [...currentIds, assetIdStr].join(', '),
                                });
                              }
                            }}
                          >
                            {asset.asset}/{asset.quote}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="param-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={bulkParams.testMode}
                        onChange={(e) =>
                          setBulkParams({ ...bulkParams, testMode: e.target.checked })
                        }
                      />
                      <span className="checkbox-text">Test Mode (bez zapisu do bazy)</span>
                    </label>
                  </div>

                  {bulk.error && (
                    <div className="error-message">
                      <span>{bulk.error}</span>
                      <button onClick={() => dispatch(clearSyncError('bulk'))}>×</button>
                    </div>
                  )}

                  {bulk.lastTask && (
                    <div className="last-task-info">
                      <span className="label">Ostatni task:</span>
                      <span className="task-id">{bulk.lastTask.task_id?.slice(0, 12)}...</span>
                      <span className="task-count">({bulk.lastTask.details?.assets_count} assets)</span>
                    </div>
                  )}

                  <button
                    className="sync-btn accent"
                    onClick={handleSyncBulk}
                    disabled={bulk.loading || !bulkParams.assetIds.trim()}
                  >
                    {bulk.loading ? (
                      <>
                        <span className="spinner" />
                        Przetwarzam...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">📦</span>
                        Synchronizuj Wybrane
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncPanel;

