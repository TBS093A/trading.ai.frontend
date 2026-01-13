import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedExchange } from '../../store/slices/exchangesSlice';
import { fetchAssetsByExchange, setSelectedAsset, setSearchTerm, clearAssets } from '../../store/slices/assetsSlice';
import { clearChart } from '../../store/slices/chartSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';
import SyncSection from './SyncSection';
import api from '../../services/api';
import './Sidebar.css';

const Sidebar = ({ isOpen }) => {
  const dispatch = useDispatch();
  const { list: exchanges, selectedExchange, loading: exchangesLoading } = useSelector((state) => state.exchanges);
  const { filteredList: assets, selectedAsset, searchTerm, loading: assetsLoading } = useSelector((state) => state.assets);

  // Collapsible sections state
  const [assetsExpanded, setAssetsExpanded] = useState(true);
  const [patternsExpanded, setPatternsExpanded] = useState(true);

  // Assets with patterns state
  const [assetsWithPatterns, setAssetsWithPatterns] = useState([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  // Fetch assets when exchange changes
  useEffect(() => {
    if (selectedExchange) {
      dispatch(fetchAssetsByExchange(selectedExchange.id));
      
      // Also fetch assets with patterns for this exchange
      setPatternsLoading(true);
      api.getAssetsWithPatterns(selectedExchange.id)
        .then((response) => {
          setAssetsWithPatterns(response.data.assets || []);
        })
        .catch((error) => {
          console.error('Failed to fetch assets with patterns:', error);
          setAssetsWithPatterns([]);
        })
        .finally(() => {
          setPatternsLoading(false);
        });
    }
  }, [dispatch, selectedExchange]);

  // Filter assets with patterns by search term
  const filteredAssetsWithPatterns = useMemo(() => {
    if (!searchTerm.trim()) {
      return assetsWithPatterns;
    }
    const search = searchTerm.toLowerCase();
    return assetsWithPatterns.filter(
      (asset) =>
        asset.asset.toLowerCase().includes(search) ||
        asset.quote.toLowerCase().includes(search) ||
        `${asset.asset}/${asset.quote}`.toLowerCase().includes(search)
    );
  }, [assetsWithPatterns, searchTerm]);

  const handleExchangeChange = useCallback((e) => {
    const exchangeId = parseInt(e.target.value);
    const exchange = exchanges.find((ex) => ex.id === exchangeId);
    if (exchange) {
      dispatch(setSelectedExchange(exchange));
      dispatch(clearAssets());
      dispatch(clearChart());
      dispatch(clearAnalysis());
      setAssetsWithPatterns([]);
    }
  }, [dispatch, exchanges]);

  const handleAssetSelect = useCallback((asset) => {
    dispatch(setSelectedAsset(asset));
  }, [dispatch]);

  const handleSearchChange = useCallback((e) => {
    dispatch(setSearchTerm(e.target.value));
  }, [dispatch]);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <>
          {/* Header */}
          <div className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">◈</span>
              <span className="logo-text">TRADING AI</span>
            </div>
            <button className="sidebar-toggle" onClick={() => dispatch(toggleSidebar())}>
              ◀
            </button>
          </div>
          {/* Sync Section - Collapsible */}
          <SyncSection />

          {/* Exchange Selector */}
          <div className="sidebar-section">
            <label className="section-label">
              <span className="section-icon">⬡</span>
              Exchange
            </label>
            <select
              className="input select exchange-select"
              value={selectedExchange?.id || ''}
              onChange={handleExchangeChange}
              disabled={exchangesLoading}
            >
              {exchanges.map((exchange) => (
                <option key={exchange.id} value={exchange.id}>
                  {exchange.display_name || exchange.name}
                </option>
              ))}
            </select>
          </div>

          {/* Asset Search */}
          <div className="sidebar-section">
            <label className="section-label">
              <span className="section-icon">◎</span>
              Search Asset
            </label>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input search-input"
                placeholder="Search by symbol..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
              {searchTerm && (
                <button
                  className="search-clear-btn"
                  onClick={() => dispatch(setSearchTerm(''))}
                >
                  ×
                </button>
              )}
              <span className="search-icon">⌕</span>
            </div>
          </div>

          {/* Assets List - Collapsible */}
          <div className="sidebar-section asset-list-section">
            <button
              className={`section-label collapsible ${assetsExpanded ? 'expanded' : ''}`}
              onClick={() => setAssetsExpanded(!assetsExpanded)}
            >
              <span className="section-icon">⬢</span>
              <span className="section-title">Assets</span>
              <span className="count-badge">{assets.length}</span>
              <span className="collapse-arrow">{assetsExpanded ? '▼' : '▶'}</span>
            </button>
            
            {assetsExpanded && (
              <div className="asset-list">
                {assetsLoading ? (
                  <div className="loader">
                    <div className="loader-spinner"></div>
                  </div>
                ) : assets.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">∅</span>
                    <span>No assets found</span>
                  </div>
                ) : (
                  assets.map((asset) => (
                    <button
                      key={asset.id}
                      className={`asset-item ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                      onClick={() => handleAssetSelect(asset)}
                    >
                      <span className="asset-symbol">{asset.asset}</span>
                      <span className="asset-quote">/{asset.quote}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Harmonic Patterns in Assets - Collapsible */}
          <div className="sidebar-section asset-list-section patterns-section">
            <button
              className={`section-label collapsible ${patternsExpanded ? 'expanded' : ''}`}
              onClick={() => setPatternsExpanded(!patternsExpanded)}
            >
              <span className="section-icon">◇</span>
              <span className="section-title">Harmonic Patterns</span>
              <span className="count-badge patterns">{filteredAssetsWithPatterns.length}</span>
              <span className="collapse-arrow">{patternsExpanded ? '▼' : '▶'}</span>
            </button>
            
            {patternsExpanded && (
              <div className="asset-list patterns-list">
                {patternsLoading ? (
                  <div className="loader">
                    <div className="loader-spinner"></div>
                  </div>
                ) : filteredAssetsWithPatterns.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">◇</span>
                    <span>No patterns found</span>
                  </div>
                ) : (
                  filteredAssetsWithPatterns.map((asset) => (
                    <button
                      key={asset.id}
                      className={`asset-item pattern-item ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                      onClick={() => handleAssetSelect(asset)}
                    >
                      <div className="pattern-item-main">
                        <span className="asset-symbol">{asset.asset}</span>
                        <span className="asset-quote">/{asset.quote}</span>
                      </div>
                      <div className="pattern-item-meta">
                        <span className="pattern-date" title="Latest Pattern">
                          {asset.latest_pattern_date || '—'}
                        </span>
                        <span className="pattern-count" title="Patterns Count">
                          {asset.patterns_count}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="sidebar-footer">
            <div className="stat-item">
              <span className="stat-label">Exchange</span>
              <span className="stat-value">{selectedExchange?.name || '-'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Assets</span>
              <span className="stat-value">{assets.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">With Patterns</span>
              <span className="stat-value patterns">{filteredAssetsWithPatterns.length}</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export default Sidebar;
