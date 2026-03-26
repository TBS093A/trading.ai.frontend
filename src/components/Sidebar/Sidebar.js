import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssetsByExchange, setSelectedAsset, setSearchTerm } from '../../store/slices/assetsSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';
import UserSection from './UserSection';
import api from '../../services/api';
import './Sidebar.css';

const COUNTRY_LABELS = {
  US: 'United States',
  JP: 'Japan',
  CN: 'China',
  DE: 'Germany',
  GB: 'United Kingdom',
  PL: 'Poland',
  RU: 'Russia',
  IL: 'Israel',
  FR: 'France',
  CH: 'Switzerland',
  EU: 'European Union',
  CRYPTO: 'Crypto',
};

function groupAssets(assetList) {
  const groups = {};
  for (const asset of assetList) {
    const country = asset.country || 'OTHER';
    const kind = asset.kind || 'OTHER';
    if (!groups[country]) groups[country] = {};
    if (!groups[country][kind]) groups[country][kind] = [];
    groups[country][kind].push(asset);
  }
  return groups;
}

function countGroupAssets(groups) {
  let total = 0;
  for (const kinds of Object.values(groups)) {
    for (const arr of Object.values(kinds)) {
      total += arr.length;
    }
  }
  return total;
}

const AssetItem = ({ asset, isSelected, onClick, hasPatterns, className = '' }) => (
  <button
    className={`asset-item ${isSelected ? 'selected' : ''} ${className}`}
    onClick={onClick}
  >
    <span className="asset-symbol">
      {hasPatterns && <span className="pattern-dot" title="Has harmonic patterns" />}
      {asset.asset}<span className="asset-quote">/{asset.quote}</span>
    </span>
    {asset.full_name && (
      <span className="asset-full-name-sub">{asset.full_name}</span>
    )}
  </button>
);

const Sidebar = ({ isOpen }) => {
  const dispatch = useDispatch();
  const { selectedExchange } = useSelector((state) => state.exchanges);
  const { filteredList: assets, selectedAsset, searchTerm, loading: assetsLoading } = useSelector((state) => state.assets);
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'administrator';

  const [assetsExpanded, setAssetsExpanded] = useState(true);
  const [patternsExpanded, setPatternsExpanded] = useState(true);

  const [assetsWithPatterns, setAssetsWithPatterns] = useState([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  const [deletingAssetId, setDeletingAssetId] = useState(null);
  const [deleteConfirmAssetId, setDeleteConfirmAssetId] = useState(null);

  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [expandedKinds, setExpandedKinds] = useState(new Set());

  useEffect(() => {
    if (selectedExchange) {
      dispatch(fetchAssetsByExchange(selectedExchange.id));

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

  const filteredAssetsWithPatterns = useMemo(() => {
    if (!searchTerm.trim()) {
      return assetsWithPatterns;
    }
    const search = searchTerm.toLowerCase();
    return assetsWithPatterns.filter(
      (asset) =>
        asset.asset.toLowerCase().includes(search) ||
        asset.quote.toLowerCase().includes(search) ||
        `${asset.asset}/${asset.quote}`.toLowerCase().includes(search) ||
        (asset.full_name && asset.full_name.toLowerCase().includes(search))
    );
  }, [assetsWithPatterns, searchTerm]);

  const groupedAssets = useMemo(() => groupAssets(assets), [assets]);
  const groupedPatterns = useMemo(() => groupAssets(filteredAssetsWithPatterns), [filteredAssetsWithPatterns]);
  const patternAssetIds = useMemo(() => new Set(assetsWithPatterns.map((a) => a.id)), [assetsWithPatterns]);

  const isSearching = searchTerm.trim().length > 0;

  const toggleCountry = useCallback((key) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleKind = useCallback((key) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const isCountryOpen = useCallback((country, prefix) => {
    if (isSearching) return true;
    return expandedCountries.has(`${prefix}:${country}`);
  }, [isSearching, expandedCountries]);

  const isKindOpen = useCallback((country, kind, prefix) => {
    if (isSearching) return true;
    return expandedKinds.has(`${prefix}:${country}:${kind}`);
  }, [isSearching, expandedKinds]);

  const handleAssetSelect = useCallback((asset) => {
    dispatch(setSelectedAsset(asset));
  }, [dispatch]);

  const handleSearchChange = useCallback((e) => {
    dispatch(setSearchTerm(e.target.value));
  }, [dispatch]);

  const refreshAssetsWithPatterns = useCallback(() => {
    if (selectedExchange) {
      setPatternsLoading(true);
      api.getAssetsWithPatterns(selectedExchange.id)
        .then((response) => {
          setAssetsWithPatterns(response.data.assets || []);
        })
        .catch((error) => {
          console.error('Failed to fetch assets with patterns:', error);
        })
        .finally(() => {
          setPatternsLoading(false);
        });
    }
  }, [selectedExchange]);

  const handleDeletePatterns = useCallback(async (assetId, e) => {
    e.stopPropagation();

    if (deleteConfirmAssetId !== assetId) {
      setDeleteConfirmAssetId(assetId);
      return;
    }

    setDeletingAssetId(assetId);
    setDeleteConfirmAssetId(null);

    try {
      const response = await api.deleteAllPatternsForAsset(assetId);
      console.log('Delete response:', response.data);
      refreshAssetsWithPatterns();
      if (selectedAsset?.id === assetId) {
        dispatch(clearAnalysis());
      }
    } catch (error) {
      console.error('Failed to delete patterns:', error);
      alert(error.response?.data?.detail || 'Nie udało się usunąć wzorców');
    } finally {
      setDeletingAssetId(null);
    }
  }, [deleteConfirmAssetId, refreshAssetsWithPatterns, selectedAsset, dispatch]);

  const handleCancelDeleteConfirm = useCallback(() => {
    setDeleteConfirmAssetId(null);
  }, []);

  const renderGroupedList = (groups, prefix) => {
    const countries = Object.keys(groups).sort();
    return countries.map((country) => {
      const kinds = groups[country];
      const countryKey = `${prefix}:${country}`;
      const countryOpen = isCountryOpen(country, prefix);
      const countryLabel = COUNTRY_LABELS[country] || country;
      const countryCount = Object.values(kinds).reduce((s, arr) => s + arr.length, 0);
      const countryPatternCount = Object.values(kinds).reduce(
        (s, arr) => s + arr.filter((a) => patternAssetIds.has(a.id)).length, 0
      );

      return (
        <div key={countryKey} className="group-country">
          <button className={`group-header country-header ${countryOpen ? 'open' : ''}`} onClick={() => toggleCountry(countryKey)}>
            <span className="group-arrow">{countryOpen ? '▼' : '▶'}</span>
            <span className="group-label">{countryLabel}</span>
            {countryPatternCount > 0 && (
              <span className="group-pattern-count" title="Assets with harmonic patterns">{countryPatternCount}</span>
            )}
            <span className="group-count">{countryCount}</span>
          </button>
          {countryOpen && Object.keys(kinds).sort().map((kind) => {
            const kindKey = `${prefix}:${country}:${kind}`;
            const kindOpen = isKindOpen(country, kind, prefix);
            const kindAssets = kinds[kind];
            const kindPatternCount = kindAssets.filter((a) => patternAssetIds.has(a.id)).length;

            return (
              <div key={kindKey} className="group-kind">
                <button className={`group-header kind-header ${kindOpen ? 'open' : ''}`} onClick={() => toggleKind(kindKey)}>
                  <span className="group-arrow">{kindOpen ? '▼' : '▶'}</span>
                  <span className="group-label">{kind}</span>
                  {kindPatternCount > 0 && (
                    <span className="group-pattern-count" title="Assets with harmonic patterns">{kindPatternCount}</span>
                  )}
                  <span className="group-count">{kindAssets.length}</span>
                </button>
                {kindOpen && kindAssets.map((asset) => (
                  <AssetItem
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAsset?.id === asset.id}
                    onClick={() => handleAssetSelect(asset)}
                    hasPatterns={patternAssetIds.has(asset.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <>
          <div className="sidebar-header">
            <div className="logo">
              <span className="logo-text">00x097 TRADE</span>
            </div>
            <button className="sidebar-toggle" onClick={() => dispatch(toggleSidebar())}>
              ◀
            </button>
          </div>

          <UserSection />

          <div className="sidebar-section">
            <label className="section-label">
              <span className="section-icon">◎</span>
              Search Asset
            </label>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input search-input"
                placeholder="Search by ticker or name..."
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

          {/* Assets List */}
          <div className={`sidebar-section asset-list-section ${assetsExpanded ? 'section-expanded' : 'section-collapsed'}`}>
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
              <div className="asset-list grouped-asset-list">
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
                  renderGroupedList(groupedAssets, 'a')
                )}
              </div>
            )}
          </div>

          {/* Harmonic Patterns */}
          <div className={`sidebar-section asset-list-section patterns-section ${patternsExpanded ? 'section-expanded' : 'section-collapsed'}`}>
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
              <div className="asset-list patterns-list grouped-asset-list" onClick={handleCancelDeleteConfirm}>
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
                  filteredAssetsWithPatterns.map((asset) => {
                    const isDeleting = deletingAssetId === asset.id;
                    const isConfirming = deleteConfirmAssetId === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className={`asset-item pattern-item ${selectedAsset?.id === asset.id ? 'selected' : ''} ${isConfirming ? 'confirm-delete' : ''}`}
                      >
                        <button
                          className="pattern-item-content"
                          onClick={() => handleAssetSelect(asset)}
                        >
                          <div className="pattern-item-main">
                            <span className="asset-symbol">{asset.asset}<span className="asset-quote">/{asset.quote}</span></span>
                            {asset.full_name && (
                              <span className="asset-full-name-sub">{asset.full_name}</span>
                            )}
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
                        {isAdmin && (
                          <button
                            className={`pattern-delete-btn ${isConfirming ? 'confirming' : ''}`}
                            onClick={(e) => handleDeletePatterns(asset.id, e)}
                            disabled={isDeleting}
                            title={isConfirming ? 'Kliknij ponownie aby potwierdzić' : 'Usuń wszystkie wzorce'}
                          >
                            {isDeleting ? '⟳' : isConfirming ? '⚠' : '✕'}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

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
