import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSavedAnalyses,
  fetchSavedAnalysis,
  deleteSavedAnalysis,
  clearError,
  clearSuccess,
  setSearchTerm,
  selectSavedAnalyses,
  selectTotalCount,
  selectSavedAnalysisLoading,
  selectSavedAnalysisDeleting,
  selectSavedAnalysisError,
  selectLastSuccess,
  selectLoadingAnalysisId,
  selectSearchTerm,
} from '../../store/slices/savedAnalysisSlice';
import { setSelectedAsset } from '../../store/slices/assetsSlice';
import { setInterval, triggerScaleReset } from '../../store/slices/chartSlice';
import {
  setPatternDisplayOption,
  setSelectedPattern,
  setExpandedPatternId,
  setUnselectedAlpha,
  setAutoCenterOnSelect,
  setLineDisplayStyle,
  toggleShowPointLevelLines,
  toggleShowPatternShapes,
  toggleShowRetraceLines,
  toggleMonochromaticMode,
  toggleShowUnselectedLabels,
  setIndicator,
} from '../../store/slices/analysisSlice';
import './SavedAnalysisSection.css';

const SavedAnalysisSection = ({ onClose }) => {
  const dispatch = useDispatch();
  const analyses = useSelector(selectSavedAnalyses);
  const totalCount = useSelector(selectTotalCount);
  const loading = useSelector(selectSavedAnalysisLoading);
  const deleting = useSelector(selectSavedAnalysisDeleting);
  const error = useSelector(selectSavedAnalysisError);
  const lastSuccess = useSelector(selectLastSuccess);
  const loadingAnalysisId = useSelector(selectLoadingAnalysisId);
  const searchTerm = useSelector(selectSearchTerm);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Pobierz listę analiz przy montowaniu (limit 1000)
  useEffect(() => {
    dispatch(fetchSavedAnalyses({ limit: 1000, offset: 0 }));
  }, [dispatch]);

  // Wyczyść komunikat sukcesu po 3 sekundach
  useEffect(() => {
    if (lastSuccess) {
      const timer = setTimeout(() => {
        dispatch(clearSuccess());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSuccess, dispatch]);

  // Filtruj analizy według search term
  const filteredAnalyses = useMemo(() => {
    if (!searchTerm.trim()) {
      return analyses;
    }
    const search = searchTerm.toLowerCase();
    return analyses.filter((analysis) =>
      analysis.name?.toLowerCase().includes(search) ||
      analysis.asset_name?.toLowerCase().includes(search) ||
      analysis.quote_name?.toLowerCase().includes(search) ||
      analysis.interval?.toLowerCase().includes(search) ||
      analysis.exchange_name?.toLowerCase().includes(search) ||
      `${analysis.asset_name}/${analysis.quote_name}`.toLowerCase().includes(search)
    );
  }, [analyses, searchTerm]);

  // Obsługa zmiany search term
  const handleSearchChange = useCallback((e) => {
    dispatch(setSearchTerm(e.target.value));
  }, [dispatch]);

  // Obsługa czyszczenia search term
  const handleClearSearch = useCallback(() => {
    dispatch(setSearchTerm(''));
  }, [dispatch]);

  // Obsługa kliknięcia w analizę - załaduj i przywróć stan
  const handleLoadAnalysis = useCallback(async (analysisId) => {
    try {
      const result = await dispatch(fetchSavedAnalysis(analysisId)).unwrap();
      const analysis = result.analysis;

      if (!analysis) return;

      // 1. Ustaw asset
      if (analysis.asset_id) {
        dispatch(setSelectedAsset({
          id: analysis.asset_id,
          asset_name: analysis.asset_name,
          quote_name: analysis.quote_name,
        }));
      }

      // 2. Ustaw interval
      if (analysis.interval) {
        dispatch(setInterval(analysis.interval));
      }

      // 3. Wymuś reset skali wykresu (po załadowaniu danych)
      // Małe opóźnienie żeby dane zdążyły się załadować
      setTimeout(() => {
        dispatch(triggerScaleReset());
      }, 500);

      // 4. Przywróć pattern display options
      if (analysis.pattern_display_options) {
        Object.entries(analysis.pattern_display_options).forEach(([patternId, options]) => {
          Object.entries(options).forEach(([option, value]) => {
            if (typeof value === 'boolean') {
              dispatch(setPatternDisplayOption({ patternId, option, value }));
            }
          });
        });
      }

      // 5. Przywróć globalne ustawienia patternów
      if (analysis.global_pattern_display) {
        const gpd = analysis.global_pattern_display;
        
        // Te ustawienia są toggle'ami, więc musimy sprawdzić stan
        // Na razie ustawiamy bezpośrednio przez dispatch z odpowiednimi akcjami
        if (gpd.lineDisplayStyle) {
          dispatch(setLineDisplayStyle(gpd.lineDisplayStyle));
        }
      }

      // 6. Przywróć indykatory
      if (analysis.indicators) {
        Object.entries(analysis.indicators).forEach(([indicator, value]) => {
          dispatch(setIndicator({ indicator, value }));
        });
      }

      // 7. Przywróć alpha i auto-center
      if (analysis.unselected_alpha !== undefined) {
        dispatch(setUnselectedAlpha(analysis.unselected_alpha));
      }
      if (analysis.auto_center_on_select !== undefined) {
        dispatch(setAutoCenterOnSelect(analysis.auto_center_on_select));
      }

      // Zamknij panel po załadowaniu
      if (onClose) {
        onClose();
      }

    } catch (err) {
      console.error('Failed to load analysis:', err);
    }
  }, [dispatch, onClose]);

  // Obsługa usuwania
  const handleDelete = useCallback((analysisId) => {
    if (confirmDeleteId === analysisId) {
      dispatch(deleteSavedAnalysis(analysisId));
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(analysisId);
    }
  }, [dispatch, confirmDeleteId]);

  // Anuluj potwierdzenie usunięcia po 3 sekundach
  useEffect(() => {
    if (confirmDeleteId) {
      const timer = setTimeout(() => {
        setConfirmDeleteId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId]);

  // Formatuj datę
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`saved-analysis-section ${isExpanded ? 'section-expanded' : 'section-collapsed'}`}>
      {/* Collapsible Header */}
      <button
        className={`section-label collapsible ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="section-icon">💾</span>
        <span className="section-title">Saved Analyses</span>
        <span className="count-badge">{filteredAnalyses.length}</span>
        <span className="collapse-arrow">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <>
          {/* Search Bar */}
          <div className="saved-analysis-search">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input search-input"
                placeholder="Search analyses..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
              {searchTerm && (
                <button
                  className="search-clear-btn"
                  onClick={handleClearSearch}
                >
                  ×
                </button>
              )}
              <span className="search-icon">⌕</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="saved-analysis-error">
              <span>{typeof error === 'string' ? error : 'Wystąpił błąd'}</span>
              <button onClick={() => dispatch(clearError())}>×</button>
            </div>
          )}

          {/* Success message */}
          {lastSuccess && lastSuccess.type === 'delete' && (
            <div className="saved-analysis-success">
              <span className="success-icon">✓</span>
              {lastSuccess.message}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="saved-analysis-loading">
              <span className="loading-spinner">⟳</span>
              <span>Ładowanie...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredAnalyses.length === 0 && (
            <div className="saved-analysis-empty">
              <span className="empty-icon">📊</span>
              <span>{searchTerm ? 'Brak wyników' : 'Brak zapisanych analiz'}</span>
              {!searchTerm && (
                <span className="empty-hint">
                  Użyj przycisku "Save" na wykresie aby zapisać aktualny widok
                </span>
              )}
            </div>
          )}

          {/* Analyses list */}
          {!loading && filteredAnalyses.length > 0 && (
            <div className="saved-analysis-list">
              {filteredAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className={`saved-analysis-item ${loadingAnalysisId === analysis.id ? 'loading' : ''}`}
                >
                  <div 
                    className="analysis-info"
                    onClick={() => handleLoadAnalysis(analysis.id)}
                  >
                    <div className="analysis-name">
                      {analysis.name}
                    </div>
                    <div className="analysis-meta">
                      <span className="meta-asset">
                        {analysis.asset_name || 'Unknown'}/{analysis.quote_name || '?'}
                      </span>
                      <span className="meta-separator">•</span>
                      <span className="meta-interval">{analysis.interval}</span>
                      {analysis.exchange_name && (
                        <>
                          <span className="meta-separator">•</span>
                          <span className="meta-exchange">{analysis.exchange_name}</span>
                        </>
                      )}
                    </div>
                    <div className="analysis-date">
                      {formatDate(analysis.updated_at)}
                    </div>
                  </div>

                  <button
                    className={`delete-btn ${confirmDeleteId === analysis.id ? 'confirm' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(analysis.id);
                    }}
                    disabled={deleting}
                    title={confirmDeleteId === analysis.id ? 'Kliknij ponownie aby potwierdzić' : 'Usuń analizę'}
                  >
                    {confirmDeleteId === analysis.id ? '⚠️' : '🗑️'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SavedAnalysisSection;
