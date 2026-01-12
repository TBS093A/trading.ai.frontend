import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchExchanges = createAsyncThunk(
  'exchanges/fetchExchanges',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getExchanges();
      return response.data.exchanges;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch exchanges');
    }
  }
);

const exchangesSlice = createSlice({
  name: 'exchanges',
  initialState: {
    list: [],
    selectedExchange: null,
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedExchange: (state, action) => {
      state.selectedExchange = action.payload;
    },
    clearExchangeError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExchanges.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExchanges.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
        // Auto-select first exchange if none selected
        if (!state.selectedExchange && action.payload.length > 0) {
          state.selectedExchange = action.payload[0];
        }
      })
      .addCase(fetchExchanges.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setSelectedExchange, clearExchangeError } = exchangesSlice.actions;
export default exchangesSlice.reducer;

