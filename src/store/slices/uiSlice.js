import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    rightPanelOpen: false,
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
  setTheme,
  showTooltip,
  hideTooltip,
} = uiSlice.actions;
export default uiSlice.reducer;

