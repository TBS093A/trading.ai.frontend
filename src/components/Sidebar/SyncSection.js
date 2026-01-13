import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setActiveSection,
  syncExchanges,
  syncTechnicalAnalysis,
  syncBulkAssets,
  clearSyncError,
  removeTask,
} from '../../store/slices/syncSlice';
import api from '../../services/api';
import './SyncSection.css';

const SyncSection = () => {
  const dispatch = useDispatch();
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeSection, exchanges: exchangesSync, technical, bulk, activeTasks } = useSelector(
    (state) => state.sync
  );
  const { list: exchangesList } = useSelector((state) => state.exchanges);

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
        `${asset.asset}/${asset.quote}`.toLowerCase().includes(search)
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
        <span className="toggle-text">Synchronizacja</span>
        {hasActiveTasks && <span className="active-badge pulse" />}
        <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="sync-dropdown-content">
          {/* Active tasks mini list */}
          {activeTasksList.length > 0 && (
            <div className="tasks-mini">
              {activeTasksList.slice(0, 3).map(([taskId, task]) => (
                <div key={taskId} className={`task-mini-item ${getStatusClass(task.status)}`}>
                  <span className="task-icon">{getStatusIcon(task.status)}</span>
                  <span className="task-name">
                    {task.type === 'exchanges' && 'Giełdy'}
                    {task.type === 'technical' && 'Analiza'}
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
              <span className="item-title">Giełdy</span>
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
                  disabled={exchangesSync.loading}
                >
                  {exchangesSync.loading ? '⟳ Synchronizuję...' : '⟳ Synchronizuj'}
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
              <span className="item-title">Analiza Techniczna</span>
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
                  disabled={technical.loading}
                >
                  {technical.loading ? '⟳ Analizuję...' : '📊 Uruchom Analizę'}
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
                    Giełda
                  </label>
                  <select
                    className="bulk-exchange-select"
                    value={bulkExchangeId}
                    onChange={(e) => setBulkExchangeId(e.target.value)}
                  >
                    <option value="">-- Wybierz giełdę --</option>
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
                      Szukaj assetu
                    </label>
                    <div className="bulk-search-wrapper">
                      <input
                        type="text"
                        className="bulk-search-input"
                        placeholder="np. BTC, ETH, USDT..."
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
                  <div className="info-msg">Wybierz giełdę aby zobaczyć assety</div>
                ) : bulkAssetsLoading ? (
                  <div className="info-msg">
                    <span className="loading-spinner">⟳</span> Ładowanie assetów...
                  </div>
                ) : bulkAssets.length === 0 ? (
                  <div className="info-msg">Brak assetów dla wybranej giełdy</div>
                ) : (
                  <>
                    <div className="bulk-header">
                      <span className="selected-count">
                        Wybrano: {selectedAssetIds.size}
                        {bulkSearchTerm && ` (widoczne: ${filteredBulkAssets.length}/${bulkAssets.length})`}
                        {!bulkSearchTerm && ` / ${bulkAssets.length}`}
                      </span>
                      <button className="select-all-btn" onClick={toggleSelectAll}>
                        {allFilteredSelected ? 'Odznacz widoczne' : 'Zaznacz widoczne'}
                      </button>
                    </div>

                    <div className="asset-checkboxes">
                      {filteredBulkAssets.length === 0 ? (
                        <div className="no-results">Brak wyników dla "{bulkSearchTerm}"</div>
                      ) : (
                        filteredBulkAssets.map((asset) => (
                          <label key={asset.id} className="asset-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.has(asset.id)}
                              onChange={() => toggleAssetSelection(asset.id)}
                            />
                            <span className="asset-name">
                              {asset.asset}<span className="quote">/{asset.quote}</span>
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
                      disabled={bulk.loading || selectedAssetIds.size === 0}
                    >
                      {bulk.loading
                        ? '⟳ Przetwarzam...'
                        : `📦 Synchronizuj (${selectedAssetIds.size})`}
                    </button>
                  </>
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

