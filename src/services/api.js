import axios from 'axios';
import { getCsrfToken, clearCsrfToken, sanitizeObject } from '../utils/security';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Cache dla CSRF tokenu
let csrfTokenPromise = null;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Pobiera CSRF token (z cache lub z serwera)
 */
const ensureCsrfToken = async () => {
  try {
    // Unikaj wielokrotnych równoczesnych requestów po token
    if (!csrfTokenPromise) {
      csrfTokenPromise = getCsrfToken(API_BASE_URL);
    }
    const token = await csrfTokenPromise;
    csrfTokenPromise = null;
    return token;
  } catch (error) {
    csrfTokenPromise = null;
    console.warn('[API] Failed to get CSRF token:', error);
    return null;
  }
};

// Request interceptor - dodaje token autoryzacji i CSRF
axiosInstance.interceptors.request.use(
  async (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    
    // Dodaj token autoryzacji jeśli istnieje
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Dodaj CSRF token dla requestów modyfikujących
    const modifyingMethods = ['post', 'put', 'delete', 'patch'];
    if (modifyingMethods.includes(config.method?.toLowerCase())) {
      // Pomijaj CSRF dla logowania
      if (!config.url?.includes('/auth/login')) {
        const csrfToken = await ensureCsrfToken();
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
      
      // Sanityzuj dane w body (jeśli to nie FormData)
      if (config.data && !(config.data instanceof FormData)) {
        config.data = sanitizeObject(config.data);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - obsługuje błędy
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    
    const status = error.response?.status;
    const isLoginEndpoint = error.config?.url?.includes('/user/auth/login');
    
    // 401 - nieautoryzowany
    if (status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      clearCsrfToken(); // Wyczyść CSRF token przy wylogowaniu
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    
    // 403 - CSRF validation failed - odśwież token i spróbuj ponownie
    if (status === 403 && error.response?.data?.error === 'CSRF Validation Failed') {
      console.warn('[API] CSRF token expired, clearing cache');
      clearCsrfToken();
      // Możesz dodać logikę retry tutaj
    }
    
    // 429 - Rate limit exceeded
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || 
                         error.response?.data?.retry_after || 60;
      console.warn(`[API] Rate limit exceeded. Retry after ${retryAfter} seconds`);
      // Dispatch event dla UI do obsługi
      window.dispatchEvent(new CustomEvent('api:rate-limited', { 
        detail: { retryAfter } 
      }));
    }
    
    return Promise.reject(error);
  }
);

const api = {
  // ==================
  // AUTHENTICATION
  // ==================
  login: (username, password) =>
    axiosInstance.post('/user/auth/login', { username, password }),

  logout: () =>
    axiosInstance.post('/user/auth/logout'),

  verifySession: () =>
    axiosInstance.get('/user/auth/verify'),

  // ==================
  // USER PROFILE
  // ==================
  getMyProfile: () =>
    axiosInstance.get('/user/me'),

  updateMyProfile: (data) =>
    axiosInstance.put('/user/me', data),

  changePassword: (currentPassword, newPassword) =>
    axiosInstance.post('/user/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  getMyAvatar: () =>
    axiosInstance.get('/user/me/avatar'),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return axiosInstance.post('/user/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  deleteAvatar: () =>
    axiosInstance.delete('/user/me/avatar'),

  // ==================
  // USER MANAGEMENT (Admin only)
  // ==================
  getUsers: (limit = 50, offset = 0) =>
    axiosInstance.get('/user/list', { params: { limit, offset } }),

  createUser: (userData) =>
    axiosInstance.post('/user/create', userData),

  getUserById: (userId) =>
    axiosInstance.get(`/user/${userId}`),

  updateUser: (userId, userData) =>
    axiosInstance.put(`/user/${userId}`, userData),

  deleteUser: (userId) =>
    axiosInstance.delete(`/user/${userId}`),

  // ==================
  // SAVED ANALYSES
  // ==================
  getSavedAnalyses: (limit = 50, offset = 0) =>
    axiosInstance.get('/user/saved-analyses', { params: { limit, offset } }),

  getSavedAnalysis: (analysisId) =>
    axiosInstance.get(`/user/saved-analyses/${analysisId}`),

  createSavedAnalysis: (analysisData) =>
    axiosInstance.post('/user/saved-analyses', analysisData),

  updateSavedAnalysis: (analysisId, updateData) =>
    axiosInstance.put(`/user/saved-analyses/${analysisId}`, updateData),

  deleteSavedAnalysis: (analysisId) =>
    axiosInstance.delete(`/user/saved-analyses/${analysisId}`),

  // ==================
  // EXCHANGES
  // ==================
  getExchanges: (limit = 50, offset = 0, activeOnly = true) =>
    axiosInstance.get('/exchanges/list', {
      params: { limit, offset, active_only: activeOnly },
    }),

  getActiveExchanges: (limit = 50, offset = 0) =>
    axiosInstance.get('/exchanges/active', { params: { limit, offset } }),

  getExchangeById: (exchangeId) =>
    axiosInstance.get(`/exchanges/${exchangeId}`),

  // ==================
  // ASSETS
  // ==================
  getAssets: (limit = 50, offset = 0) =>
    axiosInstance.get('/assets/list', { params: { limit, offset } }),

  getAssetsByExchange: (exchangeId, limit = 1000, offset = 0) =>
    axiosInstance.get(`/assets/exchange/${exchangeId}`, { params: { limit, offset } }),

  getAssetById: (assetId) =>
    axiosInstance.get(`/assets/${assetId}`),

  searchAssets: (assetName) =>
    axiosInstance.get(`/assets/search/asset/${assetName}`),

  searchAssetsByQuote: (quoteName) =>
    axiosInstance.get(`/assets/search/quote/${quoteName}`),

  getAssetsWithPatterns: (exchangeId = null, limit = 1000, offset = 0) =>
    axiosInstance.get('/assets/with-harmonic-patterns', {
      params: {
        ...(exchangeId && { exchange_id: exchangeId }),
        limit,
        offset,
      },
    }),

  // ==================
  // KLINES
  // ==================
  // compact=true: backends that support it send [[open_time, o, h, l, c, v], ...] (with `fields`);
  // older ones ignore the param and send objects - chartSlice normalizes both
  getKlines: (assetId, interval, limit = 500, startTime = null, endTime = null) =>
    axiosInstance.get(`/exchanges/klines/${assetId}/${interval}`, {
      params: {
        limit,
        compact: true,
        ...(startTime && { start_time: startTime }),
        ...(endTime && { end_time: endTime }),
      },
    }),

  // ==================
  // HARMONICS (on-demand range scan, manual XABCD validation)
  // ==================
  // 200 "complete" | 202 "computing" (poll after retry_after_ms) | 200 "failed"
  getHarmonics: (assetId, interval, startTime = null, endTime = null) =>
    axiosInstance.get(`/harmonics/${assetId}/${interval}`, {
      params: {
        ...(startTime != null && { start_time: startTime }),
        ...(endTime != null && { end_time: endTime }),
      },
    }),

  // Setup performance (simulated trades on harmonic setups)
  getHarmonicStats: (params = {}) =>
    axiosInstance.get('/harmonics/stats', { params }),

  getHarmonicSetups: (params = {}) =>
    axiosInstance.get('/harmonics/setups', { params }),

  getTrackedSetups: () =>
    axiosInstance.get('/harmonics/setups/tracked'),

  // Section counts for the sidebar (active / won / lost / junk)
  getSetupSections: (params = {}) =>
    axiosInstance.get('/harmonics/setups/sections', { params }),

  // Model behind pattern/setup `strength` (score percentile + p_win)
  getStrengthModel: () =>
    axiosInstance.get('/harmonics/strength/model'),

  // Strength model training history / training data / manual fit (admin)
  getStrengthHistory: (kind = 'entry', limit = 50) =>
    axiosInstance.get('/harmonics/strength/history', { params: { kind, limit } }),

  getStrengthData: () =>
    axiosInstance.get('/harmonics/strength/data'),

  fitStrengthModel: () =>
    axiosInstance.post('/harmonics/strength/fit'),

  // Strategy variant benchmarks (one report = all variants over the same pairs and cutoff)
  getVariantReports: (limit = 20) =>
    axiosInstance.get('/harmonics/variants/reports', { params: { limit } }),

  getVariantReport: (reportId = null) =>
    axiosInstance.get('/harmonics/variants/report', { params: reportId != null ? { report_id: reportId } : {} }),

  runVariantBenchmark: (candles = 5000) =>
    axiosInstance.post('/harmonics/variants/run', null, { params: { candles } }),

  // Tracked assets (nightly pattern sync + hourly setup tracking); writes are admin-only
  getTrackedAssets: () =>
    axiosInstance.get('/harmonics/tracked-assets'),

  putTrackedAsset: (assetId, { patternsSync, setupIntervals, backfillCandles }) =>
    axiosInstance.put(`/harmonics/tracked-assets/${assetId}`, {
      patterns_sync: patternsSync,
      setup_intervals: setupIntervals,
      ...(backfillCandles != null && { backfill_candles: backfillCandles }),
    }),

  deleteTrackedAsset: (assetId) =>
    axiosInstance.delete(`/harmonics/tracked-assets/${assetId}`),

  // Setup status alerts for the current user
  getAlertSettings: () =>
    axiosInstance.get('/harmonics/alerts/settings'),

  putAlertSettings: (settings) =>
    axiosInstance.put('/harmonics/alerts/settings', settings),

  getAlertEvents: (params = {}) =>
    axiosInstance.get('/harmonics/alerts/events', { params }),

  sendTestAlert: () =>
    axiosInstance.post('/harmonics/alerts/test'),

  validateHarmonic: (points, fibTolerance = null) =>
    axiosInstance.post('/harmonics/validate', {
      points,
      ...(fibTolerance != null && { fib_tolerance: fibTolerance }),
    }),

  // ==================
  // TECHNICAL ANALYSIS
  // ==================
  getTechnicalAnalysis: (assetId, interval, startTimestamp = null, endTimestamp = null, limit = 100) =>
    axiosInstance.get(`/analysis/technical/asset/${assetId}/interval/${interval}`, {
      params: { limit },
    }),

  getTechnicalAnalysisByTimestampRange: (assetId, interval, startTimestamp, endTimestamp, limit = 100) =>
    axiosInstance.get(
      `/analysis/technical/timestamp/range/asset/${assetId}/interval/${interval}`,
      {
        params: {
          start_timestamp: startTimestamp,
          end_timestamp: endTimestamp,
          limit,
        },
      }
    ),

  getTechnicalAnalysisById: (analysisId) =>
    axiosInstance.get(`/analysis/technical/${analysisId}`),

  getPatternCounts: (assetId) =>
    axiosInstance.get(`/analysis/technical/pattern-counts/${assetId}`),

  getCompletePatterns: (assetId, limit = 100) =>
    axiosInstance.get(`/analysis/technical/patterns/complete/${assetId}`, {
      params: { limit },
    }),

  // Delete all patterns for an asset (admin only)
  deleteAllPatternsForAsset: (assetId) =>
    axiosInstance.delete(`/analysis/technical/asset/${assetId}/all`),

  // ==================
  // STATS
  // ==================
  getExchangeStats: () => axiosInstance.get('/exchanges/stats'),
  getAssetStats: () => axiosInstance.get('/assets/stats'),
  getTechnicalAnalysisStats: () => axiosInstance.get('/analysis/technical/stats'),

  // ==================
  // SYNC OPERATIONS
  // ==================
  
  // Sync Exchanges
  syncExchanges: (testMode = false, customDependencies = null) =>
    axiosInstance.post('/exchanges/sync', {
      test_mode: testMode,
      custom_dependencies: customDependencies,
    }),

  // Sync Technical Analysis
  syncTechnicalAnalysis: (limit = 50, offset = 0, testMode = false, customDependencies = null) =>
    axiosInstance.post('/analysis/technical/sync', {
      limit,
      offset,
      test_mode: testMode,
      custom_dependencies: customDependencies,
    }),

  // Sync Bulk Assets Technical Analysis
  syncBulkAssetsTechnicalAnalysis: (assetIds, testMode = false, customDependencies = null) =>
    axiosInstance.post('/analysis/technical/sync/assets', {
      asset_ids: assetIds,
      test_mode: testMode,
      custom_dependencies: customDependencies,
    }),

  // Get Sync Task Status
  getSyncTaskStatus: (taskId) =>
    axiosInstance.get(`/sync/status/${taskId}`),

  // Get All Sync Tasks
  getAllSyncTasks: () =>
    axiosInstance.get('/sync/status'),

  // Cancel Sync Task
  cancelSyncTask: (taskId) =>
    axiosInstance.delete(`/sync/status/${taskId}`),

  // Get Sync Health Check
  getSyncHealth: () =>
    axiosInstance.get('/sync/health'),

  // Get Sync Workflow Status
  getSyncWorkflow: () =>
    axiosInstance.get('/sync/workflow'),
};

export default api;

