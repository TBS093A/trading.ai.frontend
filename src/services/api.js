import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const api = {
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
};

export default api;

