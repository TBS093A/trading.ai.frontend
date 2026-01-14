import { configureStore } from '@reduxjs/toolkit';
import exchangesReducer from './slices/exchangesSlice';
import assetsReducer from './slices/assetsSlice';
import chartReducer from './slices/chartSlice';
import analysisReducer from './slices/analysisSlice';
import uiReducer from './slices/uiSlice';
import syncReducer from './slices/syncSlice';
import authReducer from './slices/authSlice';
import savedAnalysisReducer from './slices/savedAnalysisSlice';

export const store = configureStore({
  reducer: {
    exchanges: exchangesReducer,
    assets: assetsReducer,
    chart: chartReducer,
    analysis: analysisReducer,
    ui: uiReducer,
    sync: syncReducer,
    auth: authReducer,
    savedAnalysis: savedAnalysisReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

