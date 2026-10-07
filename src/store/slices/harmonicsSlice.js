import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { mergeHarmonicPatterns } from './analysisSlice';
import { fetchKlines, clearChart } from './chartSlice';

// Backend limit for one scan range
export const MAX_SCAN_CANDLES = 2000;
// Give up polling a "computing" scan after this many attempts (~2 min at 2 s)
export const MAX_SCAN_POLLS = 60;
export const MANUAL_POINTS = ['X', 'A', 'B', 'C', 'D'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// FastAPI sends `detail` as a string (our own errors) or a list of validation errors
export const formatApiError = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
  }
  return error?.message || fallback;
};

// Scan a candle range for harmonic patterns. While the backend answers 202 "computing",
// patterns found so far are drawn right away and the same range is re-requested.
export const scanHarmonics = createAsyncThunk(
  'harmonics/scan',
  async ({ assetId, interval, startTime, endTime }, { dispatch, getState, requestId, rejectWithValue }) => {
    const datasetId = getState().chart.datasetId;
    // Superseded by a newer scan, dismissed, or the user moved to another asset/interval
    const isStale = () => getState().harmonics.scan.requestId !== requestId
      || getState().chart.datasetId !== datasetId;
    try {
      for (let attempt = 0; attempt < MAX_SCAN_POLLS; attempt++) {
        const { data } = await api.getHarmonics(assetId, interval, startTime, endTime);
        if (isStale()) return rejectWithValue({ stale: true });

        dispatch(mergeHarmonicPatterns(data.patterns || []));
        dispatch(scanProgress({ found: (data.patterns || []).length, range: [data.start_time, data.end_time] }));

        if (data.status === 'complete') return { found: (data.patterns || []).length };
        if (data.status === 'failed') {
          return rejectWithValue({ message: data.error || 'Pattern scan failed' });
        }
        await sleep(data.retry_after_ms || 2000);
        if (isStale()) return rejectWithValue({ stale: true });
      }
      return rejectWithValue({ message: 'Scan is taking too long - try again in a moment' });
    } catch (error) {
      if (isStale()) return rejectWithValue({ stale: true });
      return rejectWithValue({ message: formatApiError(error, 'Pattern scan failed') });
    }
  }
);

// Validate the user's X-A-B-C(-D) points against the pattern definitions
export const validateManualPattern = createAsyncThunk(
  'harmonics/validate',
  async ({ points, fibTolerance }, { rejectWithValue }) => {
    try {
      const { data } = await api.validateHarmonic(points, fibTolerance);
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Validation failed'));
    }
  }
);

const initialManual = {
  active: false,
  points: {}, // { X: {time, price}, A: ..., ... }
  result: null,
  validating: false,
  error: null,
};

const initialState = {
  selectingRange: false,
  scan: {
    status: 'idle', // 'idle' | 'computing' | 'complete' | 'failed'
    requestId: null, // the scan whose polling is current
    range: null, // [start_time, end_time] as resolved by the backend
    request: null, // last request args, for retry
    found: 0,
    error: null,
  },
  manual: initialManual,
};

const harmonicsSlice = createSlice({
  name: 'harmonics',
  initialState,
  reducers: {
    setSelectingRange: (state, action) => {
      state.selectingRange = action.payload;
      if (action.payload) state.manual = initialManual;
    },
    scanProgress: (state, action) => {
      if (state.scan.status !== 'computing') return;
      state.scan.found = action.payload.found;
      state.scan.range = action.payload.range;
    },
    dismissScan: (state) => {
      state.scan = initialState.scan;
    },
    startManual: (state) => {
      state.manual = { ...initialManual, active: true };
      state.selectingRange = false;
    },
    stopManual: (state) => {
      state.manual = initialManual;
    },
    // Next point in X, A, B, C, D order
    addManualPoint: (state, action) => {
      const next = MANUAL_POINTS.find((name) => !state.manual.points[name]);
      if (!next) return;
      state.manual.points[next] = action.payload;
      state.manual.error = null;
    },
    undoManualPoint: (state) => {
      const last = [...MANUAL_POINTS].reverse().find((name) => state.manual.points[name]);
      if (!last) return;
      delete state.manual.points[last];
      state.manual.error = null;
      // Ratios no longer describe the remaining points; PRZ needs at least X-A-B-C
      if (Object.keys(state.manual.points).length < 4) state.manual.result = null;
    },
    setManualError: (state, action) => {
      state.manual.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(scanHarmonics.pending, (state, action) => {
        state.selectingRange = false;
        state.scan = {
          status: 'computing',
          requestId: action.meta.requestId,
          range: [action.meta.arg.startTime, action.meta.arg.endTime],
          request: action.meta.arg,
          found: 0,
          error: null,
        };
      })
      .addCase(scanHarmonics.fulfilled, (state, action) => {
        if (state.scan.requestId !== action.meta.requestId) return;
        state.scan.status = 'complete';
        state.scan.found = action.payload.found;
      })
      .addCase(scanHarmonics.rejected, (state, action) => {
        if (action.payload?.stale || state.scan.requestId !== action.meta.requestId) return;
        state.scan.status = 'failed';
        state.scan.error = action.payload?.message || action.error?.message || 'Pattern scan failed';
      })
      .addCase(validateManualPattern.pending, (state) => {
        state.manual.validating = true;
        state.manual.error = null;
      })
      .addCase(validateManualPattern.fulfilled, (state, action) => {
        state.manual.validating = false;
        state.manual.result = action.payload;
      })
      .addCase(validateManualPattern.rejected, (state, action) => {
        state.manual.validating = false;
        state.manual.error = action.payload || 'Validation failed';
      })
      // Scan state and the manual drawing belong to the dataset on screen
      .addCase(fetchKlines.fulfilled, () => initialState)
      .addCase(clearChart, () => initialState);
  },
});

export const {
  setSelectingRange,
  scanProgress,
  dismissScan,
  startManual,
  stopManual,
  addManualPoint,
  undoManualPoint,
  setManualError,
} = harmonicsSlice.actions;
export default harmonicsSlice.reducer;
