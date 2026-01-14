import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createSavedAnalysis, clearError, clearSuccess, selectSavedAnalysisCreating, selectSavedAnalysisError, selectLastSuccess } from '../../store/slices/savedAnalysisSlice';
import { fetchSavedAnalyses } from '../../store/slices/savedAnalysisSlice';
import './SaveAnalysisModal.css';

const SaveAnalysisModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const creating = useSelector(selectSavedAnalysisCreating);
  const error = useSelector(selectSavedAnalysisError);
  const lastSuccess = useSelector(selectLastSuccess);

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

  // Generate default name based on asset
  useEffect(() => {
    if (isOpen && selectedAsset) {
      const date = new Date().toLocaleDateString('pl-PL');
      setName(`${selectedAsset.asset}/${selectedAsset.quote} - ${interval} - ${date}`);
      setDescription('');
      dispatch(clearError());
    }
  }, [isOpen, selectedAsset, interval, dispatch]);

  // Close modal on success
  useEffect(() => {
    if (lastSuccess && lastSuccess.type === 'create') {
      // Refresh the saved analyses list
      dispatch(fetchSavedAnalyses());
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

    dispatch(createSavedAnalysis(analysisData));
  };

  if (!isOpen) return null;

  return (
    <div className="save-modal-overlay" onClick={onClose}>
      <div className="save-modal" onClick={(e) => e.stopPropagation()}>
        <div className="save-modal-header">
          <h3>💾 Save Analysis</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {lastSuccess && lastSuccess.type === 'create' ? (
          <div className="save-modal-success">
            <span className="success-icon">✓</span>
            <span>{lastSuccess.message}</span>
          </div>
        ) : (
          <div className="save-modal-content">
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
              <button className="cancel-btn" onClick={onClose} disabled={creating}>
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={creating || !name.trim()}
              >
                {creating ? '⟳ Saving...' : '💾 Save Analysis'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SaveAnalysisModal;

