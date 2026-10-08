import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { formatApiError } from './harmonicsSlice';

export const MODEL_KINDS = ['entry', 'pre'];

export const fetchStrengthModels = createAsyncThunk(
  'strength/fetchModels',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getStrengthModel();
      return { entry: data.model || null, pre: data.pre_model || null };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load the strength models'));
    }
  }
);

export const fetchStrengthHistory = createAsyncThunk(
  'strength/fetchHistory',
  async ({ kind, limit = 50 }, { rejectWithValue }) => {
    try {
      const { data } = await api.getStrengthHistory(kind, limit);
      return data.runs || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load training history'));
    }
  }
);

export const fetchStrengthData = createAsyncThunk(
  'strength/fetchData',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getStrengthData();
      return { weeks: data.weeks || [], totals: data.totals || {} };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load training data'));
    }
  }
);

export const fitStrengthModel = createAsyncThunk(
  'strength/fit',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.fitStrengthModel();
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to start training'));
    }
  }
);

const initialHistory = { runs: [], loading: false, error: null };

const strengthSlice = createSlice({
  name: 'strength',
  initialState: {
    models: { entry: null, pre: null, loading: false, error: null },
    history: { entry: initialHistory, pre: initialHistory },
    data: { weeks: [], totals: {}, loading: false, error: null },
    fit: { status: 'idle', taskId: null, error: null, startedAt: null }, // idle | starting | started | failed
  },
  reducers: {
    dismissFit: (state) => {
      state.fit = { status: 'idle', taskId: null, error: null, startedAt: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStrengthModels.pending, (state) => {
        state.models.loading = true;
        state.models.error = null;
      })
      .addCase(fetchStrengthModels.fulfilled, (state, action) => {
        state.models = { ...action.payload, loading: false, error: null };
      })
      .addCase(fetchStrengthModels.rejected, (state, action) => {
        state.models.loading = false;
        state.models.error = action.payload;
      })
      .addCase(fetchStrengthHistory.pending, (state, action) => {
        const h = state.history[action.meta.arg.kind];
        h.loading = true;
        h.error = null;
      })
      .addCase(fetchStrengthHistory.fulfilled, (state, action) => {
        state.history[action.meta.arg.kind] = { runs: action.payload, loading: false, error: null };
      })
      .addCase(fetchStrengthHistory.rejected, (state, action) => {
        const h = state.history[action.meta.arg.kind];
        h.loading = false;
        h.error = action.payload;
      })
      .addCase(fetchStrengthData.pending, (state) => {
        state.data.loading = true;
        state.data.error = null;
      })
      .addCase(fetchStrengthData.fulfilled, (state, action) => {
        state.data = { ...action.payload, loading: false, error: null };
      })
      .addCase(fetchStrengthData.rejected, (state, action) => {
        state.data.loading = false;
        state.data.error = action.payload;
      })
      .addCase(fitStrengthModel.pending, (state) => {
        state.fit = { status: 'starting', taskId: null, error: null, startedAt: null };
      })
      .addCase(fitStrengthModel.fulfilled, (state, action) => {
        state.fit = { status: 'started', taskId: action.payload.task_id || null, error: null, startedAt: Date.now() };
      })
      .addCase(fitStrengthModel.rejected, (state, action) => {
        state.fit = { status: 'failed', taskId: null, error: action.payload, startedAt: null };
      });
  },
});

export const { dismissFit } = strengthSlice.actions;
export default strengthSlice.reducer;
