import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { formatApiError } from './harmonicsSlice';

export const fetchRiskFields = createAsyncThunk(
  'trading/fetchRiskFields',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getRiskFields();
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Nie udało się wczytać ustawień ryzyka'));
    }
  }
);

export const fetchTradingAccounts = createAsyncThunk(
  'trading/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getTradingAccounts();
      return data.accounts || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Nie udało się wczytać kont'));
    }
  }
);

export const createTradingAccount = createAsyncThunk(
  'trading/createAccount',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.createTradingAccount(body);
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Nie udało się utworzyć konta'));
    }
  }
);

export const updateTradingAccount = createAsyncThunk(
  'trading/updateAccount',
  async ({ accountId, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.updateTradingAccount(accountId, body);
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Nie udało się zapisać konta'));
    }
  }
);

export const setAccountKillSwitch = createAsyncThunk(
  'trading/killSwitch',
  async ({ accountId, on, reason }, { rejectWithValue }) => {
    try {
      const { data } = await api.setKillSwitch(accountId, on, reason);
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Nie udało się przełączyć kill switcha'));
    }
  }
);

const upsert = (list, account) => {
  const i = list.findIndex((a) => a.id === account.id);
  if (i >= 0) list[i] = account; else list.push(account);
};

const tradingSlice = createSlice({
  name: 'trading',
  initialState: {
    meta: { fields: [], presets: [], defaults: {}, exchanges: ['paper'], entryModes: ['touch'], loading: false, error: null },
    accounts: { list: [], loading: false, error: null },
    save: { status: 'idle', error: null }, // create / update / kill switch
  },
  reducers: {
    resetTradingSave: (state) => {
      state.save = { status: 'idle', error: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRiskFields.pending, (state) => {
        state.meta.loading = true;
        state.meta.error = null;
      })
      .addCase(fetchRiskFields.fulfilled, (state, action) => {
        const d = action.payload;
        state.meta = {
          fields: d.fields || [],
          presets: d.presets || [],
          defaults: d.defaults || {},
          exchanges: d.exchanges || ['paper'],
          entryModes: d.entry_modes || ['touch'],
          loading: false,
          error: null,
        };
      })
      .addCase(fetchRiskFields.rejected, (state, action) => {
        state.meta.loading = false;
        state.meta.error = action.payload;
      })
      .addCase(fetchTradingAccounts.pending, (state) => {
        state.accounts.loading = true;
        state.accounts.error = null;
      })
      .addCase(fetchTradingAccounts.fulfilled, (state, action) => {
        state.accounts = { list: action.payload, loading: false, error: null };
      })
      .addCase(fetchTradingAccounts.rejected, (state, action) => {
        state.accounts.loading = false;
        state.accounts.error = action.payload;
      });
    [createTradingAccount, updateTradingAccount, setAccountKillSwitch].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.save = { status: 'saving', error: null };
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.save = { status: 'saved', error: null };
          upsert(state.accounts.list, action.payload);
        })
        .addCase(thunk.rejected, (state, action) => {
          state.save = { status: 'failed', error: action.payload };
        });
    });
  },
});

export const { resetTradingSave } = tradingSlice.actions;
export default tradingSlice.reducer;
