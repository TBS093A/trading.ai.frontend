import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks for sync operations

export const syncExchanges = createAsyncThunk(
  'sync/syncExchanges',
  async ({ testMode = false, customDependencies = null }, { rejectWithValue }) => {
    try {
      const response = await api.syncExchanges(testMode, customDependencies);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to sync exchanges');
    }
  }
);

export const syncTechnicalAnalysis = createAsyncThunk(
  'sync/syncTechnicalAnalysis',
  async ({ limit = 50, offset = 0, testMode = false, customDependencies = null }, { rejectWithValue }) => {
    try {
      const response = await api.syncTechnicalAnalysis(limit, offset, testMode, customDependencies);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to sync technical analysis');
    }
  }
);

export const syncBulkAssets = createAsyncThunk(
  'sync/syncBulkAssets',
  async ({ assetIds, testMode = false, customDependencies = null }, { rejectWithValue }) => {
    try {
      const response = await api.syncBulkAssetsTechnicalAnalysis(assetIds, testMode, customDependencies);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to sync bulk assets');
    }
  }
);

export const fetchTaskStatus = createAsyncThunk(
  'sync/fetchTaskStatus',
  async (taskId, { rejectWithValue }) => {
    try {
      const response = await api.getSyncTaskStatus(taskId);
      return { taskId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch task status');
    }
  }
);

const syncSlice = createSlice({
  name: 'sync',
  initialState: {
    // Active section in sidebar dropdown
    activeSection: null, // 'exchanges' | 'technical' | 'bulk'
    
    // Sync states
    exchanges: {
      loading: false,
      error: null,
      lastTask: null,
    },
    technical: {
      loading: false,
      error: null,
      lastTask: null,
    },
    bulk: {
      loading: false,
      error: null,
      lastTask: null,
    },
    
    // Active tasks for status polling
    activeTasks: {},
  },
  reducers: {
    setActiveSection: (state, action) => {
      state.activeSection = action.payload;
    },
    clearSyncError: (state, action) => {
      const section = action.payload;
      if (state[section]) {
        state[section].error = null;
      }
    },
    addActiveTask: (state, action) => {
      const { taskId, type, details } = action.payload;
      state.activeTasks[taskId] = { type, details, status: 'PENDING' };
    },
    updateTaskStatus: (state, action) => {
      const { taskId, status, result } = action.payload;
      if (state.activeTasks[taskId]) {
        state.activeTasks[taskId].status = status;
        state.activeTasks[taskId].result = result;
      }
    },
    removeTask: (state, action) => {
      delete state.activeTasks[action.payload];
    },
  },
  extraReducers: (builder) => {
    // Sync Exchanges
    builder
      .addCase(syncExchanges.pending, (state) => {
        state.exchanges.loading = true;
        state.exchanges.error = null;
      })
      .addCase(syncExchanges.fulfilled, (state, action) => {
        state.exchanges.loading = false;
        state.exchanges.lastTask = action.payload;
        state.activeTasks[action.payload.task_id] = {
          type: 'exchanges',
          details: action.payload.details,
          status: 'PENDING',
        };
      })
      .addCase(syncExchanges.rejected, (state, action) => {
        state.exchanges.loading = false;
        state.exchanges.error = action.payload;
      });

    // Sync Technical Analysis
    builder
      .addCase(syncTechnicalAnalysis.pending, (state) => {
        state.technical.loading = true;
        state.technical.error = null;
      })
      .addCase(syncTechnicalAnalysis.fulfilled, (state, action) => {
        state.technical.loading = false;
        state.technical.lastTask = action.payload;
        state.activeTasks[action.payload.task_id] = {
          type: 'technical',
          details: action.payload.details,
          status: 'PENDING',
        };
      })
      .addCase(syncTechnicalAnalysis.rejected, (state, action) => {
        state.technical.loading = false;
        state.technical.error = action.payload;
      });

    // Sync Bulk Assets
    builder
      .addCase(syncBulkAssets.pending, (state) => {
        state.bulk.loading = true;
        state.bulk.error = null;
      })
      .addCase(syncBulkAssets.fulfilled, (state, action) => {
        state.bulk.loading = false;
        state.bulk.lastTask = action.payload;
        state.activeTasks[action.payload.task_id] = {
          type: 'bulk',
          details: action.payload.details,
          status: 'PENDING',
        };
      })
      .addCase(syncBulkAssets.rejected, (state, action) => {
        state.bulk.loading = false;
        state.bulk.error = action.payload;
      });

    // Fetch Task Status
    builder
      .addCase(fetchTaskStatus.fulfilled, (state, action) => {
        const { taskId, status, result } = action.payload;
        if (state.activeTasks[taskId]) {
          state.activeTasks[taskId].status = status;
          state.activeTasks[taskId].result = result;
        }
      });
  },
});

export const {
  setActiveSection,
  clearSyncError,
  addActiveTask,
  updateTaskStatus,
  removeTask,
} = syncSlice.actions;

export default syncSlice.reducer;

