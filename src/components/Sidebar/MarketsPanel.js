import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssetsByExchange, setSelectedAsset, setSearchTerm, clearAssets } from '../../store/slices/assetsSlice';
import { setSelectedExchange } from '../../store/slices/exchangesSlice';
import { clearChart } from '../../store/slices/chartSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import api from '../../services/api';

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

const EXPANDED_GROUPS_KEY = 'ui.expandedGroups';

function loadExpandedGroups() {
  try {
    const stored = JSON.parse(localStorage.getItem(EXPANDED_GROUPS_KEY));
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function persistExpandedGroups(groups) {
  try {
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...groups]));
  } catch {
    // Storage unavailable - groups just won't be remembered
  }
}

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

const AssetItem = ({ asset, isSelected, onClick, hasPatterns }) => (
  <button
    className={`asset-item ${isSelected ? 'selected' : ''}`}
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

const MarketsPanel = () => {
  const dispatch = useDispatch();
  const { list: exchanges, selectedExchange, loading: exchangesLoading } = useSelector((state) => state.exchanges);
  const { filteredList: assets, selectedAsset, searchTerm, loading: assetsLoading } = useSelector((state) => state.assets);
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'administrator';

  const [mode, setMode] = useState('all'); // 'all' | 'patterns'

  const [assetsWithPatterns, setAssetsWithPatterns] = useState([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  const [deletingAssetId, setDeletingAssetId] = useState(null);
  const [deleteConfirmAssetId, setDeleteConfirmAssetId] = useState(null);

  const [expandedGroups, setExpandedGroups] = useState(loadExpandedGroups);

  const refreshAssetsWithPatterns = useCallback(() => {
    if (!selectedExchange) return;
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
  }, [selectedExchange]);

  useEffect(() => {
    if (selectedExchange) {
      dispatch(fetchAssetsByExchange(selectedExchange.id));
      refreshAssetsWithPatterns();
    }
  }, [dispatch, selectedExchange, refreshAssetsWithPatterns]);

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
  const patternAssetIds = useMemo(() => new Set(assetsWithPatterns.map((a) => a.id)), [assetsWithPatterns]);

  const isSearching = searchTerm.trim().length > 0;

  const toggleGroup = useCallback((key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      persistExpandedGroups(next);
      return next;
    });
  }, []);

  const isGroupOpen = useCallback(
    (key) => isSearching || expandedGroups.has(key),
    [isSearching, expandedGroups]
  );

  const handleExchangeChange = useCallback((e) => {
    const exchangeId = parseInt(e.target.value, 10);
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

  const handleDeletePatterns = useCallback(async (assetId, e) => {
    e.stopPropagation();

    if (deleteConfirmAssetId !== assetId) {
      setDeleteConfirmAssetId(assetId);
      return;
    }

    setDeletingAssetId(assetId);
    setDeleteConfirmAssetId(null);

    try {
      await api.deleteAllPatternsForAsset(assetId);
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

  const renderGroupedList = (groups) => {
    const countries = Object.keys(groups).sort();
    return countries.map((country) => {
      const kinds = groups[country];
      const countryKey = `c:${country}`;
      const countryOpen = isGroupOpen(countryKey);
      const countryLabel = COUNTRY_LABELS[country] || country;
      const countryCount = Object.values(kinds).reduce((s, arr) => s + arr.length, 0);
      const countryPatternCount = Object.values(kinds).reduce(
        (s, arr) => s + arr.filter((a) => patternAssetIds.has(a.id)).length, 0
      );

      return (
        <div key={countryKey} className="group-country">
          <button className={`group-header country-header ${countryOpen ? 'open' : ''}`} onClick={() => toggleGroup(countryKey)}>
            <span className="group-arrow">{countryOpen ? '▼' : '▶'}</span>
            <span className="group-label">{countryLabel}</span>
            {countryPatternCount > 0 && (
              <span className="group-pattern-count" title="Assets with harmonic patterns">{countryPatternCount}</span>
            )}
            <span className="group-count">{countryCount}</span>
          </button>
          {countryOpen && Object.keys(kinds).sort().map((kind) => {
            const kindKey = `k:${country}:${kind}`;
            const kindOpen = isGroupOpen(kindKey);
            const kindAssets = kinds[kind];
            const kindPatternCount = kindAssets.filter((a) => patternAssetIds.has(a.id)).length;

            return (
              <div key={kindKey} className="group-kind">
                <button className={`group-header kind-header ${kindOpen ? 'open' : ''}`} onClick={() => toggleGroup(kindKey)}>
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

  const renderPatternsList = () => filteredAssetsWithPatterns.map((asset) => {
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
  });

  const isPatternsMode = mode === 'patterns';
  const listLoading = isPatternsMode ? patternsLoading : assetsLoading;
  const listEmpty = isPatternsMode ? filteredAssetsWithPatterns.length === 0 : assets.length === 0;

  return (
    <>
      <div className="panel-controls">
        <select
          className="input exchange-select"
          value={selectedExchange?.id || ''}
          onChange={handleExchangeChange}
          disabled={exchangesLoading}
          aria-label="Exchange"
        >
          {exchanges.map((exchange) => (
            <option key={exchange.id} value={exchange.id}>
              {exchange.display_name || exchange.name}
            </option>
          ))}
        </select>

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
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          <span className="search-icon">⌕</span>
        </div>

        <div className="segmented" role="tablist">
          <button
            role="tab"
            aria-selected={!isPatternsMode}
            className={`segment ${!isPatternsMode ? 'active' : ''}`}
            onClick={() => setMode('all')}
          >
            All <span className="segment-count">{assets.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={isPatternsMode}
            className={`segment patterns ${isPatternsMode ? 'active' : ''}`}
            onClick={() => setMode('patterns')}
          >
            With patterns <span className="segment-count">{filteredAssetsWithPatterns.length}</span>
          </button>
        </div>
      </div>

      <div
        className={`asset-list ${isPatternsMode ? 'patterns-list' : ''}`}
        onClick={isPatternsMode ? () => setDeleteConfirmAssetId(null) : undefined}
      >
        {listLoading ? (
          <div className="loader">
            <div className="loader-spinner"></div>
          </div>
        ) : listEmpty ? (
          <div className="empty-state">
            <span className="empty-icon">{isPatternsMode ? '◇' : '∅'}</span>
            <span>{isPatternsMode ? 'No patterns found' : 'No assets found'}</span>
          </div>
        ) : isPatternsMode ? (
          renderPatternsList()
        ) : (
          renderGroupedList(groupedAssets)
        )}
      </div>
    </>
  );
};

export default MarketsPanel;
