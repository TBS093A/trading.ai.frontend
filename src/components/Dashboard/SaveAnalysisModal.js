import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  createSavedAnalysis, 
  updateSavedAnalysis,
  fetchSavedAnalyses,
  clearError, 
  clearSuccess,
  clearEditingAnalysis,
  selectSavedAnalysisCreating, 
  selectSavedAnalysisUpdating,
  selectSavedAnalysisError, 
  selectLastSuccess,
  selectEditingAnalysisId,
  selectSavedAnalyses,
} from '../../store/slices/savedAnalysisSlice';
import './SaveAnalysisModal.css';

const SaveAnalysisModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const creating = useSelector(selectSavedAnalysisCreating);
  const updating = useSelector(selectSavedAnalysisUpdating);
  const error = useSelector(selectSavedAnalysisError);
  const lastSuccess = useSelector(selectLastSuccess);
  const editingAnalysisId = useSelector(selectEditingAnalysisId);
  const analyses = useSelector(selectSavedAnalyses);

  // Get current state from Redux
  const { selectedAsset } = useSelector((state) => state.assets);
  const { selectedExchange } = useSelector((state) => state.exchanges);
  const { interval } = useSelector((state) => state.chart);
  const {
    harmonicPatterns,
    selectedPattern,
    expandedPatternId,
    unselectedAlpha,
    autoCenterOnSelect,
    patternDisplayOptions,
    sharedPatternData,
    globalPatternDisplay,
    indicators,
  } = useSelector((state) => state.analysis);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Znajdź edytowaną analizę
  const editingAnalysis = editingAnalysisId 
    ? analyses.find(a => a.id === editingAnalysisId) 
    : null;

  // Określ czy jesteśmy w trybie edycji
  const isEditMode = !!editingAnalysisId;
  const isSaving = creating || updating;

  // Generate default name based on asset OR load from editing analysis
  useEffect(() => {
    if (isOpen) {
      dispatch(clearError());
      
      if (isEditMode && editingAnalysis) {
        // Tryb edycji - załaduj dane z istniejącej analizy
        setName(editingAnalysis.name || '');
        setDescription(editingAnalysis.description || '');
      } else {
        // Tryb tworzenia - generuj domyślną nazwę
        if (selectedAsset) {
          const date = new Date().toLocaleDateString('pl-PL');
          setName(`${selectedAsset.asset || selectedAsset.asset_name}/${selectedAsset.quote || selectedAsset.quote_name} - ${interval} - ${date}`);
          setDescription('');
        }
      }
    }
  }, [isOpen, selectedAsset, interval, dispatch, isEditMode, editingAnalysis]);

  // Close modal on success
  useEffect(() => {
    if (lastSuccess && (lastSuccess.type === 'create' || lastSuccess.type === 'update')) {
      // Refresh the saved analyses list
      dispatch(fetchSavedAnalyses({ limit: 1000, offset: 0 }));
      
      // Jeśli był update, wyłącz tryb edycji
      if (lastSuccess.type === 'update') {
        dispatch(clearEditingAnalysis());
      }
      
      setTimeout(() => {
        dispatch(clearSuccess());
        onClose();
      }, 1500);
    }
  }, [lastSuccess, dispatch, onClose]);

  const handleSave = () => {
    if (!name.trim()) return;

    const analysisData = {
      name: name.trim(),
      description: description.trim() || null,
      asset_id: selectedAsset.id,
      asset_name: selectedAsset.asset || selectedAsset.asset_name,
      quote_name: selectedAsset.quote || selectedAsset.quote_name,
      exchange_id: selectedExchange?.id,
      exchange_name: selectedExchange?.name,
      interval,
      chart_visible_range: null, // Could be captured from chart ref
      selected_pattern_id: selectedPattern?.id || null,
      expanded_pattern_id: expandedPatternId,
      pattern_display_options: patternDisplayOptions,
      shared_pattern_data: sharedPatternData,
      global_pattern_display: globalPatternDisplay,
      indicators,
      unselected_alpha: unselectedAlpha,
      auto_center_on_select: autoCenterOnSelect,
      harmonic_pattern_ids: harmonicPatterns.map(p => p.id),
    };

    if (isEditMode) {
      // Tryb edycji - update istniejącej analizy
      dispatch(updateSavedAnalysis({
        analysisId: editingAnalysisId,
        updateData: analysisData
      }));
    } else {
      // Tryb tworzenia - stwórz nową analizę
      dispatch(createSavedAnalysis(analysisData));
    }
  };

  const handleClose = () => {
    // Nie czyścimy trybu edycji przy zamknięciu modalu
    // żeby użytkownik mógł otworzyć ponownie i kontynuować edycję
    onClose();
  };

  const handleExitEditMode = () => {
    dispatch(clearEditingAnalysis());
  };

  if (!isOpen) return null;

  const successType = lastSuccess?.type;
  const isSuccess = successType === 'create' || successType === 'update';

  return (
    <div className="save-modal-overlay" onClick={handleClose}>
      <div className={`save-modal ${isEditMode ? 'edit-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="save-modal-header">
          <h3>
            {isEditMode ? '✏️ Update Analysis' : '💾 Save Analysis'}
          </h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        {isSuccess ? (
          <div className="save-modal-success">
            <span className="success-icon">✓</span>
            <span>{lastSuccess.message}</span>
          </div>
        ) : (
          <div className="save-modal-content">
            {/* Edit mode indicator */}
            {isEditMode && (
              <div className="edit-mode-banner">
                <span className="banner-icon">✏️</span>
                <span className="banner-text">
                  Edytujesz: <strong>{editingAnalysis?.name}</strong>
                </span>
                <button 
                  className="exit-edit-btn"
                  onClick={handleExitEditMode}
                  title="Przełącz na tryb tworzenia"
                >
                  Nowa analiza
                </button>
              </div>
            )}

            <div className="save-modal-info">
              <div className="info-item">
                <span className="info-label">Asset:</span>
                <span className="info-value">
                  {selectedAsset?.asset || selectedAsset?.asset_name}/{selectedAsset?.quote || selectedAsset?.quote_name}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Interval:</span>
                <span className="info-value interval-badge">{interval}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Patterns:</span>
                <span className="info-value">{harmonicPatterns.length}</span>
              </div>
            </div>

            <div className="form-field">
              <label>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter analysis name"
                maxLength={255}
                autoFocus
              />
            </div>

            <div className="form-field">
              <label>Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes about this analysis..."
                maxLength={1000}
                rows={3}
              />
            </div>

            {error && (
              <div className="save-modal-error">
                <span>{error}</span>
                <button onClick={() => dispatch(clearError())}>×</button>
              </div>
            )}

            <div className="save-modal-actions">
              <button className="cancel-btn" onClick={handleClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                className={`save-btn ${isEditMode ? 'update-btn' : ''}`}
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
              >
                {isSaving 
                  ? '⟳ Saving...' 
                  : isEditMode 
                    ? '✏️ Update Analysis' 
                    : '💾 Save Analysis'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SaveAnalysisModal;
