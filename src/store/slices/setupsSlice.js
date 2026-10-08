import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { formatApiError } from './harmonicsSlice';
import { fetchKlines, clearChart } from './chartSlice';

export const GROUP_BY_OPTIONS = [
  { key: 'pattern_type', label: 'Pattern' },
  { key: 'interval', label: 'Interval' },
  { key: 'asset_id', label: 'Asset' },
  { key: 'is_bullish', label: 'Direction' },
  { key: 'source', label: 'Source' },
];

// Setups drawn on the chart at most - each one is a handful of series
export const MAX_CHART_SETUPS = 60;

// Build the /harmonics/stats query from the UI filters, leaving out the "all" choices
export const buildStatsParams = ({ groupBy, interval, assetId, direction, source, minTrades }) => {
  const params = { group_by: groupBy.join(',') };
  if (interval) params.interval = interval;
  if (assetId) params.asset_id = assetId;
  if (direction === 'bullish') params.is_bullish = true;
  if (direction === 'bearish') params.is_bullish = false;
  if (source) params.source = source;
  if (minTrades > 0) params.min_trades = minTrades;
  return params;
};

export const fetchSetupStats = createAsyncThunk(
  'setups/fetchStats',
  async (filters, { rejectWithValue }) => {
    try {
      const { data } = await api.getHarmonicStats(buildStatsParams(filters));
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load setup statistics'));
    }
  }
);

export const fetchTrackedSetups = createAsyncThunk(
  'setups/fetchTracked',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getTrackedSetups();
      return data.tracked || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load tracked assets'));
    }
  }
);

// Setups for the asset/interval on the chart (overlay)
export const fetchChartSetups = createAsyncThunk(
  'setups/fetchChartSetups',
  async ({ assetId, interval }, { getState, rejectWithValue }) => {
    const datasetId = getState().chart.datasetId;
    try {
      const { data } = await api.getHarmonicSetups({ asset_id: assetId, interval, limit: 500 });
      return { setups: data.setups || [], datasetId };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load setups'));
    }
  }
);

const initialChart = { setups: [], loading: false, error: null, datasetId: null };

const setupsSlice = createSlice({
  name: 'setups',
  initialState: {
    filters: {
      groupBy: ['pattern_type'],
      interval: '',
      assetId: '',
      direction: 'all',
      source: '',
      minTrades: 0,
    },
    stats: { data: null, loading: false, error: null },
    tracked: { list: [], loading: false, error: null },
    showOnChart: false,
    chart: initialChart,
  },
  reducers: {
    setStatsFilter: (state, action) => {
      Object.assign(state.filters, action.payload);
    },
    toggleGroupBy: (state, action) => {
      const key = action.payload;
      const current = state.filters.groupBy;
      if (current.includes(key)) {
        // At least one grouping is always needed
        if (current.length > 1) state.filters.groupBy = current.filter((k) => k !== key);
      } else {
        state.filters.groupBy = [...current, key];
      }
    },
    setShowSetupsOnChart: (state, action) => {
      state.showOnChart = action.payload;
      if (!action.payload) state.chart = initialChart;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSetupStats.pending, (state) => {
        state.stats.loading = true;
        state.stats.error = null;
      })
      .addCase(fetchSetupStats.fulfilled, (state, action) => {
        state.stats.loading = false;
        state.stats.data = action.payload;
      })
      .addCase(fetchSetupStats.rejected, (state, action) => {
        state.stats.loading = false;
        state.stats.error = action.payload;
      })
      .addCase(fetchTrackedSetups.pending, (state) => {
        state.tracked.loading = true;
        state.tracked.error = null;
      })
      .addCase(fetchTrackedSetups.fulfilled, (state, action) => {
        state.tracked.loading = false;
        state.tracked.list = action.payload;
      })
      .addCase(fetchTrackedSetups.rejected, (state, action) => {
        state.tracked.loading = false;
        state.tracked.error = action.payload;
      })
      .addCase(fetchChartSetups.pending, (state) => {
        state.chart.loading = true;
        state.chart.error = null;
      })
      .addCase(fetchChartSetups.fulfilled, (state, action) => {
        state.chart.loading = false;
        state.chart.setups = action.payload.setups;
        state.chart.datasetId = action.payload.datasetId;
      })
      .addCase(fetchChartSetups.rejected, (state, action) => {
        state.chart.loading = false;
        state.chart.error = action.payload;
      })
      // Overlay belongs to the asset/interval on screen
      .addCase(fetchKlines.fulfilled, (state) => { state.chart = initialChart; })
      .addCase(clearChart, (state) => { state.chart = initialChart; });
  },
});

export const { setStatsFilter, toggleGroupBy, setShowSetupsOnChart } = setupsSlice.actions;
export default setupsSlice.reducer;
