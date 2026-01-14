import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchTechnicalAnalysis = createAsyncThunk(
  'analysis/fetchTechnicalAnalysis',
  async ({ assetId, interval, startTimestamp, endTimestamp }, { rejectWithValue }) => {
    try {
      const response = await api.getTechnicalAnalysis(assetId, interval, startTimestamp, endTimestamp);
      return response.data.analyses;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch technical analysis');
    }
  }
);

const analysisSlice = createSlice({
  name: 'analysis',
  initialState: {
    harmonicPatterns: [],
    selectedPattern: null,
    hoveredPattern: null,
    expandedPatternId: null, // ID of pattern with expanded dropdown in list
    unselectedAlpha: 0.15, // Alpha (opacity) for unselected patterns (0-1), default 15%
    autoCenterOnSelect: true, // Auto-center chart when clicking pattern in list
    loading: false,
    error: null,
    // Display options stored per-pattern (keyed by pattern ID)
    // Each pattern can have: showInternalFibo, showExternalFibo, showFiboFE, showTPPRZSL
    patternDisplayOptions: {},
    // Global pattern display settings
    globalPatternDisplay: {
      // Point level lines (horizontal lines at X, A, B, C, D price levels)
      showPointLevelLines: false,
      // Line display style: 'fromFirstPoint' = lines start from pattern's first point, 'fullWidth' = full chart width
      lineDisplayStyle: 'fromFirstPoint',
      // Pattern shapes (triangles XAB, BCD for XABCD; ABC, BCD for ABCD; lines AB, BC for ABC)
      showPatternShapes: true,
      // Retrace lines between points (dashed lines with labels like XB, BD, etc.)
      showRetraceLines: true,
      // Monochromatic mode: white candles (filled up, hollow down), gray patterns
      monochromaticMode: true,
      // Show labels for unselected patterns (fib lines, etc.)
      showUnselectedLabels: false,
    },
    // Indicator visibility
    indicators: {
      volume: true,
      rsi: false,
      macd: false,
      obv: false,
    },
  },
  reducers: {
    setSelectedPattern: (state, action) => {
      state.selectedPattern = action.payload;
      // When selecting a pattern, also expand it in the list
      if (action.payload) {
        state.expandedPatternId = action.payload.id;
      }
    },
    setHoveredPattern: (state, action) => {
      state.hoveredPattern = action.payload;
    },
    clearSelectedPattern: (state) => {
      state.selectedPattern = null;
      state.expandedPatternId = null;
      // Note: patternDisplayOptions are NOT cleared - they persist
    },
    setExpandedPatternId: (state, action) => {
      state.expandedPatternId = action.payload;
    },
    toggleExpandedPattern: (state, action) => {
      const patternId = action.payload;
      state.expandedPatternId = state.expandedPatternId === patternId ? null : patternId;
    },
    setUnselectedAlpha: (state, action) => {
      state.unselectedAlpha = Math.max(0, Math.min(1, action.payload));
    },
    toggleAutoCenterOnSelect: (state) => {
      state.autoCenterOnSelect = !state.autoCenterOnSelect;
    },
    setAutoCenterOnSelect: (state, action) => {
      state.autoCenterOnSelect = action.payload;
    },
    // Toggle display option for specific pattern
    togglePatternDisplayOption: (state, action) => {
      const { patternId, option } = action.payload;
      if (!state.patternDisplayOptions[patternId]) {
        state.patternDisplayOptions[patternId] = {
          showInternalFibo: false,
          showExternalFibo: false,
          showFiboFE: false,
          showTPPRZSL: false,
          hiddenLines: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
        };
      }
      const newValue = !state.patternDisplayOptions[patternId][option];
      state.patternDisplayOptions[patternId][option] = newValue;
      // When enabling a category, clear hidden lines for that category (show all)
      if (newValue) {
        const categoryMap = {
          showInternalFibo: 'internalFibo',
          showExternalFibo: 'externalFibo',
          showFiboFE: 'fiboFE',
          showTPPRZSL: 'tpPrzSl',
        };
        const category = categoryMap[option];
        if (category && state.patternDisplayOptions[patternId].hiddenLines) {
          state.patternDisplayOptions[patternId].hiddenLines[category] = [];
        }
      }
    },
    // Set display option for specific pattern
    setPatternDisplayOption: (state, action) => {
      const { patternId, option, value } = action.payload;
      if (!state.patternDisplayOptions[patternId]) {
        state.patternDisplayOptions[patternId] = {
          showInternalFibo: false,
          showExternalFibo: false,
          showFiboFE: false,
          showTPPRZSL: false,
          hiddenLines: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
        };
      }
      state.patternDisplayOptions[patternId][option] = value;
    },
    // Toggle visibility of individual fib line
    toggleFibLineVisibility: (state, action) => {
      const { patternId, category, lineKey } = action.payload;
      if (!state.patternDisplayOptions[patternId]) {
        state.patternDisplayOptions[patternId] = {
          showInternalFibo: false,
          showExternalFibo: false,
          showFiboFE: false,
          showTPPRZSL: false,
          hiddenLines: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
        };
      }
      if (!state.patternDisplayOptions[patternId].hiddenLines) {
        state.patternDisplayOptions[patternId].hiddenLines = { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] };
      }
      const hiddenLines = state.patternDisplayOptions[patternId].hiddenLines[category];
      const index = hiddenLines.indexOf(lineKey);
      if (index === -1) {
        hiddenLines.push(lineKey); // Hide line
      } else {
        hiddenLines.splice(index, 1); // Show line
      }
    },
    // Get display options for pattern (helper - creates default if not exists)
    initPatternDisplayOptions: (state, action) => {
      const patternId = action.payload;
      if (!state.patternDisplayOptions[patternId]) {
        state.patternDisplayOptions[patternId] = {
          showInternalFibo: false,
          showExternalFibo: false,
          showFiboFE: false,
          showTPPRZSL: false,
          hiddenLines: { internalFibo: [], externalFibo: [], fiboFE: [], tpPrzSl: [] },
        };
      }
    },
    // Global pattern display toggles
    toggleShowPointLevelLines: (state) => {
      state.globalPatternDisplay.showPointLevelLines = !state.globalPatternDisplay.showPointLevelLines;
    },
    setLineDisplayStyle: (state, action) => {
      state.globalPatternDisplay.lineDisplayStyle = action.payload; // 'fromFirstPoint' or 'fullWidth'
    },
    toggleShowPatternShapes: (state) => {
      state.globalPatternDisplay.showPatternShapes = !state.globalPatternDisplay.showPatternShapes;
    },
    toggleShowRetraceLines: (state) => {
      state.globalPatternDisplay.showRetraceLines = !state.globalPatternDisplay.showRetraceLines;
    },
    toggleMonochromaticMode: (state) => {
      state.globalPatternDisplay.monochromaticMode = !state.globalPatternDisplay.monochromaticMode;
    },
    toggleShowUnselectedLabels: (state) => {
      state.globalPatternDisplay.showUnselectedLabels = !state.globalPatternDisplay.showUnselectedLabels;
    },
    toggleIndicator: (state, action) => {
      const indicator = action.payload;
      if (state.indicators.hasOwnProperty(indicator)) {
        state.indicators[indicator] = !state.indicators[indicator];
      }
    },
    setIndicator: (state, action) => {
      const { indicator, value } = action.payload;
      if (state.indicators.hasOwnProperty(indicator)) {
        state.indicators[indicator] = value;
      }
    },
    clearAnalysis: (state) => {
      state.harmonicPatterns = [];
      state.selectedPattern = null;
      state.hoveredPattern = null;
      state.expandedPatternId = null;
    },
    clearAnalysisError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTechnicalAnalysis.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTechnicalAnalysis.fulfilled, (state, action) => {
        state.loading = false;
        state.harmonicPatterns = action.payload;
      })
      .addCase(fetchTechnicalAnalysis.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setSelectedPattern,
  setHoveredPattern,
  clearSelectedPattern,
  setExpandedPatternId,
  toggleExpandedPattern,
  setUnselectedAlpha,
  toggleAutoCenterOnSelect,
  setAutoCenterOnSelect,
  togglePatternDisplayOption,
  setPatternDisplayOption,
  toggleFibLineVisibility,
  initPatternDisplayOptions,
  toggleShowPointLevelLines,
  setLineDisplayStyle,
  toggleShowPatternShapes,
  toggleShowRetraceLines,
  toggleMonochromaticMode,
  toggleShowUnselectedLabels,
  toggleIndicator,
  setIndicator,
  clearAnalysis,
  clearAnalysisError,
} = analysisSlice.actions;
export default analysisSlice.reducer;


