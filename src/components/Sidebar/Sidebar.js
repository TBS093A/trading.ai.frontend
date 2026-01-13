import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedExchange } from '../../store/slices/exchangesSlice';
import { fetchAssetsByExchange, setSelectedAsset, setSearchTerm, clearAssets } from '../../store/slices/assetsSlice';
import { clearChart } from '../../store/slices/chartSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';
import SyncSection from './SyncSection';
import './Sidebar.css';

const Sidebar = ({ isOpen }) => {
  const dispatch = useDispatch();
  const { list: exchanges, selectedExchange, loading: exchangesLoading } = useSelector((state) => state.exchanges);
  const { filteredList: assets, selectedAsset, searchTerm, loading: assetsLoading } = useSelector((state) => state.assets);

  // Fetch assets when exchange changes
  useEffect(() => {
    if (selectedExchange) {
      dispatch(fetchAssetsByExchange(selectedExchange.id));
    }
  }, [dispatch, selectedExchange]);

  const handleExchangeChange = useCallback((e) => {
    const exchangeId = parseInt(e.target.value);
    const exchange = exchanges.find((ex) => ex.id === exchangeId);
    if (exchange) {
      dispatch(setSelectedExchange(exchange));
      dispatch(clearAssets());
      dispatch(clearChart());
      dispatch(clearAnalysis());
    }
  }, [dispatch, exchanges]);

  const handleAssetSelect = useCallback((asset) => {
    dispatch(setSelectedAsset(asset));
  }, [dispatch]);

  const handleSearchChange = useCallback((e) => {
    dispatch(setSearchTerm(e.target.value));
  }, [dispatch]);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">TRADING AI</span>
        </div>
        <button className="sidebar-toggle" onClick={() => dispatch(toggleSidebar())}>
          {isOpen ? '◀' : '▶'}
        </button>
      </div>

      {isOpen && (
        <>
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
              <span className="search-icon">⌕</span>
            </div>
          </div>

          {/* Asset List */}
          <div className="sidebar-section asset-list-section">
            <label className="section-label">
              <span className="section-icon">⬢</span>
              Assets
              <span className="count-badge">{assets.length}</span>
            </label>
            
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
          </div>
        </>
      )}
    </aside>
  );
};

export default Sidebar;

