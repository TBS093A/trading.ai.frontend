import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - dodaje token autoryzacji
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    
    // Dodaj token autoryzacji jeśli istnieje
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - obsługuje 401 (nieautoryzowany)
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    
    // Jeśli 401 i NIE jest to endpoint logowania, wyloguj użytkownika
    // (401 na /user/auth/login to normalna odpowiedź dla błędnych danych)
    const isLoginEndpoint = error.config?.url?.includes('/user/auth/login');
    
    if (error.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      // Dispatch event dla App.js do obsługi
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
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
  getKlines: (assetId, interval, limit = 500, startTime = null, endTime = null) =>
    axiosInstance.get(`/exchanges/klines/${assetId}/${interval}`, {
      params: {
        limit,
        ...(startTime && { start_time: startTime }),
        ...(endTime && { end_time: endTime }),
      },
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

  getCompletePatterns: (assetId, limit = 100) =>
    axiosInstance.get(`/analysis/technical/patterns/complete/${assetId}`, {
      params: { limit },
    }),

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

