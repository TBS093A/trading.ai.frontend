import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    rightPanelOpen: false,
    patternsPanelOpen: true, // Patterns list panel (always visible when patterns exist)
    theme: 'dark',
    tooltipPosition: null,
    tooltipContent: null,
  },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    toggleRightPanel: (state) => {
      state.rightPanelOpen = !state.rightPanelOpen;
    },
    setRightPanelOpen: (state, action) => {
      state.rightPanelOpen = action.payload;
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
  toggleSidebar,
  setSidebarOpen,
  toggleRightPanel,
  setRightPanelOpen,
  togglePatternsPanel,
  setPatternsPanelOpen,
  setTheme,
  showTooltip,
  hideTooltip,
} = uiSlice.actions;
export default uiSlice.reducer;

