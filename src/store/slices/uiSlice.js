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
      const newState = !state.sidebarOpen;
      state.sidebarOpen = newState;
      // Close patterns panel when opening sidebar
      if (newState) {
        state.patternsPanelOpen = false;
      }
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
      // Close patterns panel when opening sidebar
      if (action.payload) {
        state.patternsPanelOpen = false;
      }
    },
    toggleRightPanel: (state) => {
      state.rightPanelOpen = !state.rightPanelOpen;
    },
    setRightPanelOpen: (state, action) => {
      state.rightPanelOpen = action.payload;
    },
    togglePatternsPanel: (state) => {
      const newState = !state.patternsPanelOpen;
      state.patternsPanelOpen = newState;
      // Close sidebar when opening patterns panel
      if (newState) {
        state.sidebarOpen = false;
      }
    },
    setPatternsPanelOpen: (state, action) => {
      state.patternsPanelOpen = action.payload;
      // Close sidebar when opening patterns panel
      if (action.payload) {
        state.sidebarOpen = false;
      }
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

