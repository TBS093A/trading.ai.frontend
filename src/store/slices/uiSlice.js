import { createSlice } from '@reduxjs/toolkit';

const SIDEBAR_PANEL_KEY = 'ui.sidebarPanel';
const SIDEBAR_PANELS = ['markets', 'saved', 'sync'];

const loadSidebarPanel = () => {
  try {
    const stored = localStorage.getItem(SIDEBAR_PANEL_KEY);
    if (stored === 'none') return null;
    return SIDEBAR_PANELS.includes(stored) ? stored : 'markets';
  } catch {
    return 'markets';
  }
};

const persistSidebarPanel = (panel) => {
  try {
    localStorage.setItem(SIDEBAR_PANEL_KEY, panel || 'none');
  } catch {
    // Storage unavailable (private mode etc.) - panel just won't be remembered
  }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarPanel: loadSidebarPanel(), // 'markets' | 'saved' | 'sync' | null (collapsed)
    accountModalOpen: false,
    mainView: 'chart', // 'chart' | 'stats' | 'model' | 'trading' | 'alerts' (dashboard groups)
    patternsPanelOpen: true, // Patterns list panel (always visible when patterns exist)
    theme: 'dark',
    tooltipPosition: null,
    tooltipContent: null,
  },
  reducers: {
    // Clicking the active rail icon collapses the panel, any other icon switches to it
    toggleSidebarPanel: (state, action) => {
      state.sidebarPanel = state.sidebarPanel === action.payload ? null : action.payload;
      persistSidebarPanel(state.sidebarPanel);
    },
    setSidebarPanel: (state, action) => {
      state.sidebarPanel = action.payload;
      persistSidebarPanel(state.sidebarPanel);
    },
    setAccountModalOpen: (state, action) => {
      state.accountModalOpen = action.payload;
    },
    setMainView: (state, action) => {
      state.mainView = action.payload;
    },
    togglePatternsPanel: (state) => {
      state.patternsPanelOpen = !state.patternsPanelOpen;
    },
    setPatternsPanelOpen: (state, action) => {
      state.patternsPanelOpen = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    showTooltip: (state, action) => {
      state.tooltipPosition = action.payload.position;
      state.tooltipContent = action.payload.content;
    },
    hideTooltip: (state) => {
      state.tooltipPosition = null;
      state.tooltipContent = null;
    },
  },
});

export const {
  toggleSidebarPanel,
  setSidebarPanel,
  setAccountModalOpen,
  setMainView,
  togglePatternsPanel,
  setPatternsPanelOpen,
  setTheme,
  showTooltip,
  hideTooltip,
} = uiSlice.actions;
export default uiSlice.reducer;
