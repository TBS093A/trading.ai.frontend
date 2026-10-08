import { createSlice, createAsyncThunk, original } from '@reduxjs/toolkit';
import api from '../../services/api';

// Initial window and the size of each older page fetched while scrolling left
export const INITIAL_KLINES_LIMIT = 500;
export const HISTORY_PAGE_LIMIT = 1000;
// Hard cap on candles kept in memory - roughly where TradingView stops loading history too
export const MAX_KLINES = 30000;

const CANDLE_FIELDS = ['open_time', 'open', 'high', 'low', 'close', 'volume'];

// Keep only what the chart and indicators use, parsed to numbers once.
// Accepts the compact row format ([[open_time, o, h, l, c, v], ...] described by `fields`)
// and the legacy one (11 fields per candle object, mostly strings).
const normalizeKlines = (raw = [], fields = CANDLE_FIELDS) => {
  const idx = Object.fromEntries(CANDLE_FIELDS.map((f) => [f, fields.indexOf(f)]));
  const out = raw.map((k) => (Array.isArray(k)
    ? {
      open_time: Number(k[idx.open_time]),
      open: Number(k[idx.open]),
      high: Number(k[idx.high]),
      low: Number(k[idx.low]),
      close: Number(k[idx.close]),
      volume: Number(k[idx.volume]),
    }
    : {
      open_time: Number(k.open_time),
      open: Number(k.open),
      high: Number(k.high),
      low: Number(k.low),
      close: Number(k.close),
      volume: Number(k.volume),
    }));
  out.sort((a, b) => a.open_time - b.open_time);
  return out;
};

export const fetchKlines = createAsyncThunk(
  'chart/fetchKlines',
  async ({ assetId, interval, limit = INITIAL_KLINES_LIMIT }, { rejectWithValue }) => {
    try {
      const response = await api.getKlines(assetId, interval, limit);
      return {
        klines: normalizeKlines(response.data.klines, response.data.fields),
        asset: response.data.asset,
        quote: response.data.quote,
        full_name: response.data.full_name || null,
        interval: response.data.interval,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch klines');
    }
  }
);

// Fetch the page of candles just before the oldest one we have (cursor = end_time)
export const fetchOlderKlines = createAsyncThunk(
  'chart/fetchOlderKlines',
  async ({ assetId, interval, endTime, datasetId }, { rejectWithValue }) => {
    try {
      const response = await api.getKlines(assetId, interval, HISTORY_PAGE_LIMIT, null, endTime);
      return { klines: normalizeKlines(response.data.klines, response.data.fields), datasetId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch older klines');
    }
  },
  {
    // One history request at a time, and never for a dataset that is no longer shown
    condition: ({ datasetId }, { getState }) => {
      const { chart } = getState();
      return chart.datasetId === datasetId && chart.hasMoreHistory && !chart.historyLoading && !chart.loading;
    },
  }
);

export const fetchPatternCounts = createAsyncThunk(
  'chart/fetchPatternCounts',
  async (assetId, { rejectWithValue }) => {
    try {
      const response = await api.getPatternCounts(assetId);
      const map = {};
      for (const c of response.data.counts) {
        map[c.interval] = { bullish: c.bullish, bearish: c.bearish };
      }
      return map;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch pattern counts');
    }
  }
);

const chartSlice = createSlice({
  name: 'chart',
  initialState: {
    klines: [],
    // Bumped on every fresh (non-history) load; history pages for an older dataset are dropped
    datasetId: 0,
    klinesRequestId: null,
    hasMoreHistory: true,
    historyLoading: false,
    // { time (open_time ms), assetId, interval } the chart should scroll to once that dataset is
    // loaded and has the candle (e.g. from an alert event)
    focusTime: null,
    asset: null,
    quote: null,
    full_name: null,
    interval: '4h',
    availableIntervals: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    loading: false,
    error: null,
    patternCounts: {},
    shouldResetScale: false,
  },
  reducers: {
    setInterval: (state, action) => {
      state.interval = action.payload;
    },
    clearChart: (state) => {
      state.klines = [];
      state.datasetId += 1;
      state.klinesRequestId = null;
      state.hasMoreHistory = true;
      state.historyLoading = false;
      state.asset = null;
      state.quote = null;
      state.full_name = null;
      state.patternCounts = {};
    },
    clearChartError: (state) => {
      state.error = null;
    },
    focusChartAt: (state, action) => {
      state.focusTime = action.payload;
    },
    clearChartFocus: (state) => {
      state.focusTime = null;
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
      .addCase(fetchKlines.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.klinesRequestId = action.meta.requestId;
      })
      .addCase(fetchKlines.fulfilled, (state, action) => {
        // A newer request (fast asset/interval switching) supersedes this one
        if (state.klinesRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.klines = action.payload.klines;
        state.datasetId += 1;
        state.hasMoreHistory = action.payload.klines.length > 0;
        state.historyLoading = false;
        state.asset = action.payload.asset;
        state.quote = action.payload.quote;
        state.full_name = action.payload.full_name || null;
        state.interval = action.payload.interval;
      })
      .addCase(fetchKlines.rejected, (state, action) => {
        if (state.klinesRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchOlderKlines.pending, (state) => {
        state.historyLoading = true;
      })
      .addCase(fetchOlderKlines.fulfilled, (state, action) => {
        if (action.payload.datasetId !== state.datasetId) return;
        state.historyLoading = false;

        // Read the current array without drafting every candle (keeps prepends O(page))
        const current = original(state.klines);
        const oldest = current.length > 0 ? current[0].open_time : Infinity;
        const older = action.payload.klines.filter((k) => k.open_time < oldest);

        // No new candles means the exchange has no earlier data (or ignores end_time)
        if (older.length === 0) {
          state.hasMoreHistory = false;
          return;
        }

        const room = MAX_KLINES - current.length;
        const accepted = older.length > room ? older.slice(older.length - room) : older;
        state.klines = accepted.concat(current);
        if (state.klines.length >= MAX_KLINES) {
          state.hasMoreHistory = false;
        }
      })
      .addCase(fetchOlderKlines.rejected, (state, action) => {
        if (action.meta.arg.datasetId !== state.datasetId) return;
        state.historyLoading = false;
        // Keep hasMoreHistory so the next scroll retries
      })
      .addCase(fetchPatternCounts.fulfilled, (state, action) => {
        state.patternCounts = action.payload;
      });
  },
});

export const {
  setInterval,
  clearChart,
  clearChartError,
  triggerScaleReset,
  clearScaleReset,
  focusChartAt,
  clearChartFocus,
} = chartSlice.actions;
export default chartSlice.reducer;

