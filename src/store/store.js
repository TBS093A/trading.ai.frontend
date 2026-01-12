import { configureStore } from '@reduxjs/toolkit';
import exchangesReducer from './slices/exchangesSlice';
import assetsReducer from './slices/assetsSlice';
import chartReducer from './slices/chartSlice';
import analysisReducer from './slices/analysisSlice';
import uiReducer from './slices/uiSlice';
import syncReducer from './slices/syncSlice';

export const store = configureStore({
  reducer: {
    exchanges: exchangesReducer,
    assets: assetsReducer,
    chart: chartReducer,
    analysis: analysisReducer,
    ui: uiReducer,
    sync: syncReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

