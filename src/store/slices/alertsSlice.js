import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { formatApiError } from './harmonicsSlice';

export const DEFAULT_SETUP_INTERVALS = ['1h', '4h', '1d'];
export const DEFAULT_BACKFILL_CANDLES = 5000;

// ---------- tracked assets ----------

export const fetchTrackedAssets = createAsyncThunk(
  'alerts/fetchTrackedAssets',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getTrackedAssets();
      return data.tracked || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load tracked assets'));
    }
  }
);

export const saveTrackedAsset = createAsyncThunk(
  'alerts/saveTrackedAsset',
  async ({ assetId, patternsSync, setupIntervals, backfillCandles }, { rejectWithValue }) => {
    try {
      const { data } = await api.putTrackedAsset(assetId, { patternsSync, setupIntervals, backfillCandles });
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to save tracked asset'));
    }
  }
);

export const removeTrackedAsset = createAsyncThunk(
  'alerts/removeTrackedAsset',
  async (assetId, { rejectWithValue }) => {
    try {
      await api.deleteTrackedAsset(assetId);
      return assetId;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to remove tracked asset'));
    }
  }
);

// ---------- alert settings / events ----------

export const fetchAlertSettings = createAsyncThunk(
  'alerts/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getAlertSettings();
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load alert settings'));
    }
  }
);

export const saveAlertSettings = createAsyncThunk(
  'alerts/saveSettings',
  async (settings, { rejectWithValue }) => {
    try {
      const { data } = await api.putAlertSettings(settings);
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to save alert settings'));
    }
  }
);

// Status codes from POST /harmonics/alerts/test, explained for the user when the API has no detail
const TEST_ERRORS = {
  503: 'Mail server is not configured yet - ask the admin to set up SMTP.',
  422: 'Save an e-mail address first.',
  502: 'The mail server rejected the message - try again later.',
};

export const sendTestAlert = createAsyncThunk(
  'alerts/sendTest',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.sendTestAlert();
      return data;
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      return rejectWithValue(typeof detail === 'string' ? detail : (TEST_ERRORS[status] || formatApiError(error, 'Sending failed')));
    }
  }
);

export const fetchAlertEvents = createAsyncThunk(
  'alerts/fetchEvents',
  async ({ assetId, interval, limit = 100 } = {}, { rejectWithValue }) => {
    try {
      const params = { limit };
      if (assetId) params.asset_id = assetId;
      if (interval) params.interval = interval;
      const { data } = await api.getAlertEvents(params);
      return data.events || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load alert history'));
    }
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState: {
    tracked: {
      list: [],
      loading: false,
      error: null,
      saving: {}, // assetId -> true while a PUT/DELETE is running
      // assetId -> intervals whose backfill was just started (shown after saving)
      backfill: {},
      rowErrors: {}, // assetId -> message
    },
    settings: { data: null, loading: false, saving: false, error: null, savedAt: null },
    test: { status: 'idle', message: null }, // idle | sending | sent | failed
    events: { list: [], loading: false, error: null },
  },
  reducers: {
    dismissBackfillNotice: (state, action) => {
      delete state.tracked.backfill[action.payload];
    },
    resetTestAlert: (state) => {
      state.test = { status: 'idle', message: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrackedAssets.pending, (state) => {
        state.tracked.loading = true;
        state.tracked.error = null;
      })
      .addCase(fetchTrackedAssets.fulfilled, (state, action) => {
        state.tracked.loading = false;
        state.tracked.list = action.payload;
      })
      .addCase(fetchTrackedAssets.rejected, (state, action) => {
        state.tracked.loading = false;
        state.tracked.error = action.payload;
      })
      .addCase(saveTrackedAsset.pending, (state, action) => {
        const id = action.meta.arg.assetId;
        state.tracked.saving[id] = true;
        delete state.tracked.rowErrors[id];
      })
      .addCase(saveTrackedAsset.fulfilled, (state, action) => {
        const id = action.meta.arg.assetId;
        delete state.tracked.saving[id];
        const row = action.payload.tracked;
        if (row) {
          const i = state.tracked.list.findIndex((t) => t.asset_id === row.asset_id);
          if (i >= 0) state.tracked.list[i] = row; else state.tracked.list.push(row);
        }
        const tasks = action.payload.backfill_tasks || [];
        if (tasks.length > 0) state.tracked.backfill[id] = tasks.map((t) => t.interval);
      })
      .addCase(saveTrackedAsset.rejected, (state, action) => {
        const id = action.meta.arg.assetId;
        delete state.tracked.saving[id];
        state.tracked.rowErrors[id] = action.payload;
      })
      .addCase(removeTrackedAsset.pending, (state, action) => {
        state.tracked.saving[action.meta.arg] = true;
        delete state.tracked.rowErrors[action.meta.arg];
      })
      .addCase(removeTrackedAsset.fulfilled, (state, action) => {
        delete state.tracked.saving[action.payload];
        delete state.tracked.backfill[action.payload];
        state.tracked.list = state.tracked.list.filter((t) => t.asset_id !== action.payload);
      })
      .addCase(removeTrackedAsset.rejected, (state, action) => {
        delete state.tracked.saving[action.meta.arg];
        state.tracked.rowErrors[action.meta.arg] = action.payload;
      })
      .addCase(fetchAlertSettings.pending, (state) => {
        state.settings.loading = true;
        state.settings.error = null;
      })
      .addCase(fetchAlertSettings.fulfilled, (state, action) => {
        state.settings.loading = false;
        state.settings.data = action.payload;
      })
      .addCase(fetchAlertSettings.rejected, (state, action) => {
        state.settings.loading = false;
        state.settings.error = action.payload;
      })
      .addCase(saveAlertSettings.pending, (state) => {
        state.settings.saving = true;
        state.settings.error = null;
      })
      .addCase(saveAlertSettings.fulfilled, (state, action) => {
        state.settings.saving = false;
        state.settings.data = action.payload;
        state.settings.savedAt = Date.now();
      })
      .addCase(saveAlertSettings.rejected, (state, action) => {
        state.settings.saving = false;
        state.settings.error = action.payload;
      })
      .addCase(sendTestAlert.pending, (state) => {
        state.test = { status: 'sending', message: null };
      })
      .addCase(sendTestAlert.fulfilled, (state, action) => {
        state.test = { status: 'sent', message: action.payload.sent_to };
      })
      .addCase(sendTestAlert.rejected, (state, action) => {
        state.test = { status: 'failed', message: action.payload };
      })
      .addCase(fetchAlertEvents.pending, (state) => {
        state.events.loading = true;
        state.events.error = null;
      })
      .addCase(fetchAlertEvents.fulfilled, (state, action) => {
        state.events.loading = false;
        state.events.list = action.payload;
      })
      .addCase(fetchAlertEvents.rejected, (state, action) => {
        state.events.loading = false;
        state.events.error = action.payload;
      });
  },
});

export const { dismissBackfillNotice, resetTestAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
