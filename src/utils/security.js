/**
 * Moduł bezpieczeństwa dla aplikacji React.
 * 
 * Zawiera:
 * - Input sanitization
 * - XSS prevention utilities
 * - CSRF token management
 * - Secure storage utilities
 */

// =============================================================================
// Input Sanitization
// =============================================================================

/**
 * Niebezpieczne wzorce do wykrywania i usuwania
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,  // Script tags
  /javascript:/gi,                          // JavaScript protocol
  /on\w+\s*=/gi,                            // Event handlers (onclick, onerror, etc.)
  /<\s*iframe/gi,                           // iframes
  /<\s*object/gi,                           // object tags
  /<\s*embed/gi,                            // embed tags
  /expression\s*\(/gi,                      // CSS expressions
  /vbscript:/gi,                            // VBScript protocol
  /data:.*?base64/gi,                       // Data URLs with base64
];

/**
 * Escapes HTML entities w stringu
 * @param {string} str - String do sanityzacji
 * @returns {string} String z escaped entities
 */
export const escapeHtml = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
};

/**
 * Usuwa potencjalnie niebezpieczne wzorce ze stringa
 * @param {string} str - String do sanityzacji
 * @returns {string} Zsanityzowany string
 */
export const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  let sanitized = str.trim();
  
  // Usuń niebezpieczne wzorce
  DANGEROUS_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
};

/**
 * Sanityzuje string i escapes HTML
 * @param {string} str - String do sanityzacji
 * @param {number} [maxLength] - Maksymalna długość
 * @returns {string} Zsanityzowany i escaped string
 */
export const sanitizeAndEscape = (str, maxLength = null) => {
  if (!str || typeof str !== 'string') return str;
  
  let result = sanitizeString(str);
  
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  
  return escapeHtml(result);
};

/**
 * Sprawdza czy string zawiera niebezpieczne wzorce
 * @param {string} str - String do sprawdzenia
 * @returns {boolean} True jeśli string jest bezpieczny
 */
export const isSafeString = (str) => {
  if (!str || typeof str !== 'string') return true;
  
  return !DANGEROUS_PATTERNS.some((pattern) => pattern.test(str));
};

/**
 * Sanityzuje nazwę pliku
 * @param {string} filename - Nazwa pliku
 * @param {number} [maxLength=255] - Maksymalna długość
 * @returns {string} Zsanityzowana nazwa pliku
 */
export const sanitizeFilename = (filename, maxLength = 255) => {
  if (!filename || typeof filename !== 'string') return 'unnamed';
  
  // Usuń ścieżkę
  let sanitized = filename.split('/').pop().split('\\').pop();
  
  // Usuń niedozwolone znaki
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
  
  // Ogranicz długość
  if (sanitized.length > maxLength) {
    const ext = sanitized.includes('.') ? sanitized.split('.').pop() : '';
    const name = sanitized.substring(0, sanitized.lastIndexOf('.') || sanitized.length);
    const maxNameLength = maxLength - ext.length - 1;
    sanitized = ext ? `${name.substring(0, maxNameLength)}.${ext}` : name.substring(0, maxLength);
  }
  
  return sanitized || 'unnamed';
};

/**
 * Rekurencyjnie sanityzuje obiekt
 * @param {Object} obj - Obiekt do sanityzacji
 * @param {number} [maxStringLength=10000] - Maksymalna długość stringów
 * @returns {Object} Zsanityzowany obiekt
 */
export const sanitizeObject = (obj, maxStringLength = 10000) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj).substring(0, maxStringLength);
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, maxStringLength));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    Object.keys(obj).forEach((key) => {
      const safeKey = sanitizeString(String(key)).substring(0, 256);
      sanitized[safeKey] = sanitizeObject(obj[key], maxStringLength);
    });
    return sanitized;
  }
  
  return obj;
};


// =============================================================================
// CSRF Token Management
// =============================================================================

let csrfToken = null;
let csrfTokenExpiry = null;

/**
 * Pobiera token CSRF z backendu
 * @param {string} apiBaseUrl - Base URL API
 * @returns {Promise<string>} Token CSRF
 */
export const fetchCsrfToken = async (apiBaseUrl) => {
  try {
    const response = await fetch(`${apiBaseUrl}/csrf-token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    const data = await response.json();
    csrfToken = data.csrf_token;
    csrfTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Odśwież minutę przed wygaśnięciem
    
    return csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
};

/**
 * Pobiera aktualny token CSRF (z cache lub z backendu)
 * @param {string} apiBaseUrl - Base URL API
 * @returns {Promise<string>} Token CSRF
 */
export const getCsrfToken = async (apiBaseUrl) => {
  // Sprawdź czy token jest ważny
  if (csrfToken && csrfTokenExpiry && Date.now() < csrfTokenExpiry) {
    return csrfToken;
  }
  
  // Pobierz nowy token
  return fetchCsrfToken(apiBaseUrl);
};

/**
 * Czyści cached CSRF token
 */
export const clearCsrfToken = () => {
  csrfToken = null;
  csrfTokenExpiry = null;
};


// =============================================================================
// Secure Storage
// =============================================================================

/**
 * Bezpiecznie zapisuje dane w localStorage
 * Sanityzuje klucz i wartość przed zapisem
 * @param {string} key - Klucz
 * @param {*} value - Wartość
 */
export const secureSetItem = (key, value) => {
  const safeKey = sanitizeString(key);
  const safeValue = typeof value === 'string' 
    ? sanitizeString(value) 
    : JSON.stringify(sanitizeObject(value));
  
  try {
    localStorage.setItem(safeKey, safeValue);
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

/**
 * Bezpiecznie pobiera dane z localStorage
 * @param {string} key - Klucz
 * @param {*} [defaultValue=null] - Domyślna wartość
 * @returns {*} Wartość lub domyślna
 */
export const secureGetItem = (key, defaultValue = null) => {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    
    // Próbuj sparsować JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultValue;
  }
};

/**
 * Bezpiecznie usuwa dane z localStorage
 * @param {string} key - Klucz
 */
export const secureRemoveItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
};


// =============================================================================
// URL Validation
// =============================================================================

/**
 * Sprawdza czy URL jest bezpieczny (nie zawiera javascript: etc.)
 * @param {string} url - URL do sprawdzenia
 * @returns {boolean} True jeśli URL jest bezpieczny
 */
export const isSafeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  const trimmedUrl = url.trim().toLowerCase();
  
  // Sprawdź niebezpieczne protokoły
  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:'];
  if (dangerousProtocols.some((protocol) => trimmedUrl.startsWith(protocol))) {
    return false;
  }
  
  return true;
};

/**
 * Sanityzuje URL
 * @param {string} url - URL do sanityzacji
 * @returns {string|null} Zsanityzowany URL lub null jeśli niebezpieczny
 */
export const sanitizeUrl = (url) => {
  if (!isSafeUrl(url)) return null;
  return sanitizeString(url);
};


// =============================================================================
// Password Validation
// =============================================================================

/**
 * Sprawdza siłę hasła
 * @param {string} password - Hasło do sprawdzenia
 * @returns {{ isValid: boolean, errors: string[], strength: 'weak'|'medium'|'strong' }}
 */
export const validatePassword = (password) => {
  const errors = [];
  let score = 0;
  
  if (!password || password.length < 8) {
    errors.push('Hasło musi mieć minimum 8 znaków');
  } else {
    score += 1;
  }
  
  if (password && password.length > 128) {
    errors.push('Hasło może mieć maksymalnie 128 znaków');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Hasło musi zawierać małą literę');
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Hasło musi zawierać wielką literę');
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    errors.push('Hasło musi zawierać cyfrę');
  } else {
    score += 1;
  }
  
  // Bonus za znak specjalny
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  }
  
  // Bonus za długość
  if (password && password.length >= 12) {
    score += 1;
  }
  
  let strength = 'weak';
  if (score >= 5) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
};


// =============================================================================
// Rate Limit Helper
// =============================================================================

/**
 * Przetwarza nagłówki rate limit z odpowiedzi
 * @param {Response} response - Odpowiedź z API
 * @returns {{ remaining: number, limit: number, retryAfter: number|null }}
 */
export const parseRateLimitHeaders = (response) => {
  const headers = response.headers || {};
  
  return {
    remaining: parseInt(headers.get?.('X-RateLimit-Remaining') || '0', 10),
    limit: parseInt(headers.get?.('X-RateLimit-Limit') || '120', 10),
    retryAfter: headers.get?.('Retry-After') ? parseInt(headers.get('Retry-After'), 10) : null,
  };
};


// =============================================================================
// Export all utilities
// =============================================================================

export default {
  // Input Sanitization
  escapeHtml,
  sanitizeString,
  sanitizeAndEscape,
  isSafeString,
  sanitizeFilename,
  sanitizeObject,
  
  // CSRF
  fetchCsrfToken,
  getCsrfToken,
  clearCsrfToken,
  
  // Secure Storage
  secureSetItem,
  secureGetItem,
  secureRemoveItem,
  
  // URL Validation
  isSafeUrl,
  sanitizeUrl,
  
  // Password
  validatePassword,
  
  // Rate Limit
  parseRateLimitHeaders,
};

