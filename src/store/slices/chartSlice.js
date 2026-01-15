import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchKlines = createAsyncThunk(
  'chart/fetchKlines',
  async ({ assetId, interval, limit = 500 }, { rejectWithValue }) => {
    try {
      const response = await api.getKlines(assetId, interval, limit);
      return {
        klines: response.data.klines,
        asset: response.data.asset,
        quote: response.data.quote,
        interval: response.data.interval,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch klines');
    }
  }
);

const chartSlice = createSlice({
  name: 'chart',
  initialState: {
    klines: [],
    asset: null,
    quote: null,
    interval: '4h',
    availableIntervals: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    loading: false,
    error: null,
    shouldResetScale: false, // Flag to force chart scale reset
  },
  reducers: {
    setInterval: (state, action) => {
      state.interval = action.payload;
    },
    clearChart: (state) => {
      state.klines = [];
      state.asset = null;
      state.quote = null;
    },
    clearChartError: (state) => {
      state.error = null;
    },
    triggerScaleReset: (state) => {
      state.shouldResetScale = true;
    },
    clearScaleReset: (state) => {
      state.shouldResetScale = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchKlines.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchKlines.fulfilled, (state, action) => {
        state.loading = false;
        state.klines = action.payload.klines;
        state.asset = action.payload.asset;
        state.quote = action.payload.quote;
        state.interval = action.payload.interval;
      })
      .addCase(fetchKlines.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setInterval, clearChart, clearChartError, triggerScaleReset, clearScaleReset } = chartSlice.actions;
export default chartSlice.reducer;

