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
    unselectedAlpha: 0.5, // Alpha (opacity) for unselected patterns (0-1)
    loading: false,
    error: null,
    // Panel visibility options for selected pattern
    panelOptions: {
      showInternalFibo: false,
      showExternalFibo: false,
      showFiboFE: false,
      showTPPRZSL: false,
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
      state.panelOptions = {
        showInternalFibo: false,
        showExternalFibo: false,
        showFiboFE: false,
        showTPPRZSL: false,
      };
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
    togglePanelOption: (state, action) => {
      const option = action.payload;
      if (state.panelOptions.hasOwnProperty(option)) {
        state.panelOptions[option] = !state.panelOptions[option];
      }
    },
    setPanelOption: (state, action) => {
      const { option, value } = action.payload;
      if (state.panelOptions.hasOwnProperty(option)) {
        state.panelOptions[option] = value;
      }
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
  togglePanelOption,
  setPanelOption,
  toggleIndicator,
  setIndicator,
  clearAnalysis,
  clearAnalysisError,
} = analysisSlice.actions;
export default analysisSlice.reducer;

