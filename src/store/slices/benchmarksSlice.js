import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { formatApiError } from './harmonicsSlice';

export const fetchVariantReports = createAsyncThunk(
  'benchmarks/fetchReports',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getVariantReports(20);
      return data.reports || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load benchmark reports'));
    }
  }
);

// reportId null = the latest report
export const fetchVariantReport = createAsyncThunk(
  'benchmarks/fetchReport',
  async (reportId = null, { rejectWithValue }) => {
    try {
      const { data } = await api.getVariantReport(reportId);
      return data;
    } catch (error) {
      if (error?.response?.status === 404) return null; // no report yet
      return rejectWithValue(formatApiError(error, 'Failed to load the benchmark report'));
    }
  }
);

export const runVariantBenchmark = createAsyncThunk(
  'benchmarks/run',
  async (candles, { rejectWithValue }) => {
    try {
      const { data } = await api.runVariantBenchmark(candles);
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to start the benchmark'));
    }
  }
);

const benchmarksSlice = createSlice({
  name: 'benchmarks',
  initialState: {
    reports: { list: [], loading: false, error: null },
    report: { data: null, loading: false, error: null, requestedId: null },
    run: { status: 'idle', error: null }, // idle | starting | started | failed
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVariantReports.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchVariantReports.fulfilled, (state, action) => {
        state.reports = { list: action.payload, loading: false, error: null };
      })
      .addCase(fetchVariantReports.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(fetchVariantReport.pending, (state, action) => {
        state.report.loading = true;
        state.report.error = null;
        state.report.requestedId = action.meta.arg ?? null;
      })
      .addCase(fetchVariantReport.fulfilled, (state, action) => {
        // A slower answer for a report the user already switched away from
        if ((action.meta.arg ?? null) !== state.report.requestedId) return;
        state.report.loading = false;
        state.report.data = action.payload;
      })
      .addCase(fetchVariantReport.rejected, (state, action) => {
        if ((action.meta.arg ?? null) !== state.report.requestedId) return;
        state.report.loading = false;
        state.report.error = action.payload;
      })
      .addCase(runVariantBenchmark.pending, (state) => {
        state.run = { status: 'starting', error: null };
      })
      .addCase(runVariantBenchmark.fulfilled, (state) => {
        state.run = { status: 'started', error: null };
      })
      .addCase(runVariantBenchmark.rejected, (state, action) => {
        state.run = { status: 'failed', error: action.payload };
      });
  },
});

export default benchmarksSlice.reducer;
