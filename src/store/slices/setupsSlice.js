import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { formatApiError } from './harmonicsSlice';
import { fetchKlines, clearChart } from './chartSlice';

export const GROUP_BY_OPTIONS = [
  { key: 'pattern_type', label: 'Pattern' },
  { key: 'interval', label: 'Interval' },
  { key: 'asset_id', label: 'Asset' },
  { key: 'is_bullish', label: 'Direction' },
  { key: 'source', label: 'Source' },
];

// Setups drawn on the chart at most - each one is a handful of series
export const MAX_CHART_SETUPS = 60;

export const SETUP_STATUSES = ['win', 'loss', 'open', 'waiting', 'expired', 'no_entry', 'invalidated'];

const HIDDEN_STATUSES_KEY = 'setups.hiddenStatuses';

const loadHiddenStatuses = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(HIDDEN_STATUSES_KEY));
    return Array.isArray(stored) ? stored.filter((st) => SETUP_STATUSES.includes(st)) : [];
  } catch {
    return [];
  }
};

const persistHiddenStatuses = (statuses) => {
  try {
    localStorage.setItem(HIDDEN_STATUSES_KEY, JSON.stringify(statuses));
  } catch {
    // Storage unavailable - the filter just won't be remembered
  }
};

// Build the /harmonics/stats query from the UI filters, leaving out the "all" choices
export const buildStatsParams = ({ groupBy, interval, assetId, direction, source, minTrades }) => {
  const params = { group_by: groupBy.join(',') };
  if (interval) params.interval = interval;
  if (assetId) params.asset_id = assetId;
  if (direction === 'bullish') params.is_bullish = true;
  if (direction === 'bearish') params.is_bullish = false;
  if (source) params.source = source;
  if (minTrades > 0) params.min_trades = minTrades;
  return params;
};

export const fetchSetupStats = createAsyncThunk(
  'setups/fetchStats',
  async (filters, { rejectWithValue }) => {
    try {
      const { data } = await api.getHarmonicStats(buildStatsParams(filters));
      return data;
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load setup statistics'));
    }
  }
);

export const fetchTrackedSetups = createAsyncThunk(
  'setups/fetchTracked',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getTrackedSetups();
      return data.tracked || [];
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load tracked assets'));
    }
  }
);

// Setups for the asset/interval on the chart (overlay)
export const fetchChartSetups = createAsyncThunk(
  'setups/fetchChartSetups',
  async ({ assetId, interval }, { getState, rejectWithValue }) => {
    const datasetId = getState().chart.datasetId;
    try {
      const { data } = await api.getHarmonicSetups({ asset_id: assetId, interval, limit: 500 });
      return { setups: data.setups || [], datasetId };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load setups'));
    }
  }
);

// Waiting/open setups for the asset/interval on screen (sidebar "Active setups")
export const fetchActiveSetups = createAsyncThunk(
  'setups/fetchActive',
  async ({ assetId, interval }, { rejectWithValue }) => {
    try {
      const { data } = await api.getHarmonicSetups({ asset_id: assetId, interval, active: true });
      return { setups: data.setups || [], key: `${assetId}:${interval}` };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load active setups'));
    }
  }
);

// Closed sections in the sidebar, paged with offset ("show more")
export const SECTION_PAGE = 50;
export const CLOSED_SECTIONS = ['won', 'lost', 'junk'];

// Counts for the section headers
export const fetchSetupSectionCounts = createAsyncThunk(
  'setups/fetchSectionCounts',
  async ({ assetId, interval }, { rejectWithValue }) => {
    try {
      const { data } = await api.getSetupSections({ asset_id: assetId, interval });
      return { sections: data.sections || {}, byStatus: data.by_status || {}, key: `${assetId}:${interval}` };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load setup counts'));
    }
  }
);

// One page of a closed section (won / lost / junk), newest exit first
export const fetchSetupSection = createAsyncThunk(
  'setups/fetchSection',
  async ({ assetId, interval, section, offset = 0 }, { rejectWithValue }) => {
    try {
      const { data } = await api.getHarmonicSetups({ asset_id: assetId, interval, section, limit: SECTION_PAGE, offset });
      return { setups: data.setups || [], key: `${assetId}:${interval}` };
    } catch (error) {
      return rejectWithValue(formatApiError(error, 'Failed to load setups'));
    }
  }
);

const SHOW_JUNK_KEY = 'setups.showJunk';
const loadShowJunk = () => {
  try { return localStorage.getItem(SHOW_JUNK_KEY) === 'true'; } catch { return false; }
};

const initialSectionList = { items: [], loading: false, error: null, hasMore: false, loaded: false };
const initialSections = {
  key: null,
  counts: {}, // section -> count
  byStatus: {},
  lists: { won: initialSectionList, lost: initialSectionList, junk: initialSectionList },
};

const initialChart = { setups: [], loading: false, error: null, datasetId: null };
const initialActive = { list: [], loading: false, error: null, key: null, fetchedAt: null };

const setupsSlice = createSlice({
  name: 'setups',
  initialState: {
    filters: {
      groupBy: ['pattern_type'],
      interval: '',
      assetId: '',
      direction: 'all',
      source: '',
      minTrades: 0,
    },
    stats: { data: null, loading: false, error: null },
    tracked: { list: [], loading: false, error: null },
    showOnChart: false,
    active: initialActive,
    sections: initialSections,
    // Expired / no-entry / invalidated section in the sidebar (off by default)
    showJunk: loadShowJunk(),
    // Setup pinned on the chart (from the sidebar or an e-mail link): drawn bold with SL/TP
    highlightedId: null,
    // From an e-mail link: find the setup by pattern + X/C time once the overlay has loaded
    highlightQuery: null, // { pattern, x, c }
    // Statuses switched off in the chart legend
    hiddenStatuses: loadHiddenStatuses(),
    chart: initialChart,
  },
  reducers: {
    setStatsFilter: (state, action) => {
      Object.assign(state.filters, action.payload);
    },
    toggleGroupBy: (state, action) => {
      const key = action.payload;
      const current = state.filters.groupBy;
      if (current.includes(key)) {
        // At least one grouping is always needed
        if (current.length > 1) state.filters.groupBy = current.filter((k) => k !== key);
      } else {
        state.filters.groupBy = [...current, key];
      }
    },
    toggleSetupStatus: (state, action) => {
      const status = action.payload;
      state.hiddenStatuses = state.hiddenStatuses.includes(status)
        ? state.hiddenStatuses.filter((st) => st !== status)
        : [...state.hiddenStatuses, status];
      persistHiddenStatuses(state.hiddenStatuses);
    },
    // Show only this status, or everything again when it is already the only one shown
    soloSetupStatus: (state, action) => {
      const others = SETUP_STATUSES.filter((st) => st !== action.payload);
      const alreadySolo = others.every((st) => state.hiddenStatuses.includes(st))
        && !state.hiddenStatuses.includes(action.payload);
      state.hiddenStatuses = alreadySolo ? [] : others;
      persistHiddenStatuses(state.hiddenStatuses);
    },
    setShowJunk: (state, action) => {
      state.showJunk = action.payload;
      try { localStorage.setItem(SHOW_JUNK_KEY, String(action.payload)); } catch { /* not remembered */ }
    },
    highlightSetup: (state, action) => {
      state.highlightedId = action.payload;
      state.highlightQuery = null;
    },
    setHighlightQuery: (state, action) => {
      state.highlightQuery = action.payload;
      state.highlightedId = null;
    },
    setShowSetupsOnChart: (state, action) => {
      state.showOnChart = action.payload;
      if (!action.payload) {
        state.chart = initialChart;
        state.highlightedId = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSetupStats.pending, (state) => {
        state.stats.loading = true;
        state.stats.error = null;
      })
      .addCase(fetchSetupStats.fulfilled, (state, action) => {
        state.stats.loading = false;
        state.stats.data = action.payload;
      })
      .addCase(fetchSetupStats.rejected, (state, action) => {
        state.stats.loading = false;
        state.stats.error = action.payload;
      })
      .addCase(fetchTrackedSetups.pending, (state) => {
        state.tracked.loading = true;
        state.tracked.error = null;
      })
      .addCase(fetchTrackedSetups.fulfilled, (state, action) => {
        state.tracked.loading = false;
        state.tracked.list = action.payload;
      })
      .addCase(fetchTrackedSetups.rejected, (state, action) => {
        state.tracked.loading = false;
        state.tracked.error = action.payload;
      })
      .addCase(fetchChartSetups.pending, (state) => {
        state.chart.loading = true;
        state.chart.error = null;
      })
      .addCase(fetchChartSetups.fulfilled, (state, action) => {
        state.chart.loading = false;
        state.chart.setups = action.payload.setups;
        state.chart.datasetId = action.payload.datasetId;
      })
      .addCase(fetchChartSetups.rejected, (state, action) => {
        state.chart.loading = false;
        state.chart.error = action.payload;
      })
      .addCase(fetchActiveSetups.pending, (state, action) => {
        const key = `${action.meta.arg.assetId}:${action.meta.arg.interval}`;
        // Keep showing the current list while refreshing the same asset/interval
        if (state.active.key !== key) state.active = { ...initialActive, key };
        state.active.loading = true;
        state.active.error = null;
      })
      .addCase(fetchActiveSetups.fulfilled, (state, action) => {
        if (action.payload.key !== state.active.key) return; // answer for an asset/interval no longer shown
        state.active.loading = false;
        state.active.list = action.payload.setups;
        state.active.fetchedAt = Date.now();
      })
      .addCase(fetchActiveSetups.rejected, (state, action) => {
        const key = `${action.meta.arg.assetId}:${action.meta.arg.interval}`;
        if (key !== state.active.key) return;
        state.active.loading = false;
        state.active.error = action.payload;
      })
      .addCase(fetchSetupSectionCounts.pending, (state, action) => {
        const key = `${action.meta.arg.assetId}:${action.meta.arg.interval}`;
        // New asset/interval: drop the old lists, they get reloaded when their section is open
        if (state.sections.key !== key) state.sections = { ...initialSections, key };
      })
      .addCase(fetchSetupSectionCounts.fulfilled, (state, action) => {
        if (action.payload.key !== state.sections.key) return;
        state.sections.counts = Object.fromEntries(
          Object.entries(action.payload.sections).map(([name, sec]) => [name, sec?.count ?? 0]),
        );
        state.sections.byStatus = action.payload.byStatus;
      })
      .addCase(fetchSetupSection.pending, (state, action) => {
        const { assetId, interval, section, offset } = action.meta.arg;
        const key = `${assetId}:${interval}`;
        if (state.sections.key !== key) state.sections = { ...initialSections, key };
        const list = state.sections.lists[section];
        if (!list) return;
        list.loading = true;
        list.error = null;
        if (!offset) list.items = [];
      })
      .addCase(fetchSetupSection.fulfilled, (state, action) => {
        const { section, offset } = action.meta.arg;
        if (action.payload.key !== state.sections.key) return;
        const list = state.sections.lists[section];
        if (!list) return;
        const known = new Set(offset ? list.items.map((x) => x.id) : []);
        list.items = [...(offset ? list.items : []), ...action.payload.setups.filter((x) => !known.has(x.id))];
        list.loading = false;
        list.loaded = true;
        list.hasMore = action.payload.setups.length === SECTION_PAGE;
      })
      .addCase(fetchSetupSection.rejected, (state, action) => {
        const { assetId, interval, section } = action.meta.arg;
        if (`${assetId}:${interval}` !== state.sections.key) return;
        const list = state.sections.lists[section];
        if (!list) return;
        list.loading = false;
        list.error = action.payload;
      })
      // Overlay and pinned setup belong to the asset/interval on screen
      .addCase(fetchKlines.fulfilled, (state) => {
        state.chart = initialChart;
        state.highlightedId = null;
      })
      .addCase(clearChart, (state) => {
        state.chart = initialChart;
        state.active = initialActive;
        state.sections = initialSections;
        state.highlightedId = null;
      });
  },
});

export const {
  setStatsFilter,
  toggleGroupBy,
  toggleSetupStatus,
  soloSetupStatus,
  setShowSetupsOnChart,
  highlightSetup,
  setHighlightQuery,
  setShowJunk,
} = setupsSlice.actions;
export default setupsSlice.reducer;
