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
      pointLevelLineStyle: 'fromPoint', // 'fromPoint' = from point to right scale, 'throughPoint' = from chart start through point to scale
      // Pattern shapes (triangles XAB, BCD for XABCD; ABC, BCD for ABCD; lines AB, BC for ABC)
      showPatternShapes: true,
      // Retrace lines between points (dashed lines with labels like XB, BD, etc.)
      showRetraceLines: true,
      // Monochromatic mode: white candles (filled up, hollow down), gray patterns
      monochromaticMode: true,
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
        };
      }
      state.patternDisplayOptions[patternId][option] = !state.patternDisplayOptions[patternId][option];
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
        };
      }
      state.patternDisplayOptions[patternId][option] = value;
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
        };
      }
    },
    // Global pattern display toggles
    toggleShowPointLevelLines: (state) => {
      state.globalPatternDisplay.showPointLevelLines = !state.globalPatternDisplay.showPointLevelLines;
    },
    setPointLevelLineStyle: (state, action) => {
      state.globalPatternDisplay.pointLevelLineStyle = action.payload; // 'fromPoint' or 'throughPoint'
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
  initPatternDisplayOptions,
  toggleShowPointLevelLines,
  setPointLevelLineStyle,
  toggleShowPatternShapes,
  toggleShowRetraceLines,
  toggleMonochromaticMode,
  toggleIndicator,
  setIndicator,
  clearAnalysis,
  clearAnalysisError,
} = analysisSlice.actions;
export default analysisSlice.reducer;

