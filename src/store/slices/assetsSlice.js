import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAssetsByExchange = createAsyncThunk(
  'assets/fetchByExchange',
  async (exchangeId, { rejectWithValue }) => {
    try {
      const response = await api.getAssetsByExchange(exchangeId);
      return response.data.assets;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch assets');
    }
  }
);

export const searchAssets = createAsyncThunk(
  'assets/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const response = await api.searchAssets(searchTerm);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to search assets');
    }
  }
);

const assetsSlice = createSlice({
  name: 'assets',
  initialState: {
    list: [],
    filteredList: [],
    selectedAsset: null,
    searchTerm: '',
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedAsset: (state, action) => {
      state.selectedAsset = action.payload;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
      if (action.payload) {
        const term = action.payload.toLowerCase();
        state.filteredList = state.list.filter(
          (asset) =>
            asset.asset.toLowerCase().includes(term) ||
            asset.quote.toLowerCase().includes(term) ||
            (asset.full_name && asset.full_name.toLowerCase().includes(term))
        );
      } else {
        state.filteredList = state.list;
      }
    },
    clearAssetError: (state) => {
      state.error = null;
    },
    clearAssets: (state) => {
      state.list = [];
      state.filteredList = [];
      state.selectedAsset = null;
      state.searchTerm = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssetsByExchange.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAssetsByExchange.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
        state.filteredList = action.payload;
      })
      .addCase(fetchAssetsByExchange.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(searchAssets.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.filteredList = action.payload;
      })
      .addCase(searchAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setSelectedAsset, setSearchTerm, clearAssetError, clearAssets } = assetsSlice.actions;
export default assetsSlice.reducer;

