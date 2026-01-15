import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError, selectAuthLoading, selectAuthError } from '../../store/slices/authSlice';
import { sanitizeString } from '../../utils/security';
import './Login.css';

// Dane dla animowanego wykresu
const generateCandleData = () => {
  const candles = [];
  let price = 100;
  
  for (let i = 0; i < 40; i++) {
    const change = (Math.random() - 0.5) * 4;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    candles.push({
      open,
      close,
      high,
      low,
      isBullish: close > open,
    });
    
    price = close;
  }
  
  return candles;
};

// XABCD Pattern Points (relative to candle indices)
const patternPoints = {
  X: { index: 5, priceOffset: 0 },
  A: { index: 12, priceOffset: 15 },
  B: { index: 18, priceOffset: 6 },
  C: { index: 25, priceOffset: 12 },
  D: { index: 32, priceOffset: 3 },
};

const AnimatedChart = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [candleData] = useState(generateCandleData);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  const animate = useCallback(() => {
    setAnimationProgress((prev) => {
      if (prev >= 1) {
        return 0; // Reset dla infinite loop
      }
      return prev + 0.003;
    });
    animationRef.current = requestAnimationFrame(animate);
  }, []);
  
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    ctx.fillStyle = 'rgba(6, 8, 16, 0.95)';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * (height / 10));
      ctx.lineTo(width, i * (height / 10));
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(i * (width / 10), 0);
      ctx.lineTo(i * (width / 10), height);
      ctx.stroke();
    }
    
    // Calculate candle dimensions
    const candleWidth = width / (candleData.length + 2);
    const candleSpacing = candleWidth * 0.3;
    
    // Find price range
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    candleData.forEach((c) => {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
    });
    
    // Add pattern offset to price range
    maxPrice += 20;
    minPrice -= 5;
    
    const priceRange = maxPrice - minPrice;
    const priceToY = (price) => height - ((price - minPrice) / priceRange) * height * 0.9 - height * 0.05;
    
    // Draw visible candles based on animation progress
    const visibleCandles = Math.floor(animationProgress * candleData.length * 1.5);
    
    candleData.forEach((candle, i) => {
      if (i > visibleCandles) return;
      
      const x = (i + 1) * candleWidth;
      const opacity = Math.min(1, (visibleCandles - i) / 3);
      
      // Wick
      ctx.strokeStyle = candle.isBullish 
        ? `rgba(0, 255, 136, ${opacity})` 
        : `rgba(255, 51, 102, ${opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2 - candleSpacing / 2, priceToY(candle.high));
      ctx.lineTo(x + candleWidth / 2 - candleSpacing / 2, priceToY(candle.low));
      ctx.stroke();
      
      // Body
      ctx.fillStyle = candle.isBullish 
        ? `rgba(0, 255, 136, ${opacity})` 
        : `rgba(255, 51, 102, ${opacity})`;
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyHeight = Math.max(2, Math.abs(priceToY(candle.open) - priceToY(candle.close)));
      ctx.fillRect(
        x,
        bodyTop,
        candleWidth - candleSpacing,
        bodyHeight
      );
    });
    
    // Draw XABCD pattern
    const getPatternPoint = (point) => {
      const candle = candleData[point.index];
      if (!candle) return null;
      const x = (point.index + 1) * candleWidth + candleWidth / 2 - candleSpacing / 2;
      const y = priceToY(candle.low + point.priceOffset);
      return { x, y };
    };
    
    const points = {
      X: getPatternPoint(patternPoints.X),
      A: getPatternPoint(patternPoints.A),
      B: getPatternPoint(patternPoints.B),
      C: getPatternPoint(patternPoints.C),
      D: getPatternPoint(patternPoints.D),
    };
    
    // Only draw pattern lines if animation has progressed enough
    if (animationProgress > 0.2) {
      const patternProgress = Math.min(1, (animationProgress - 0.2) / 0.5);
      
      ctx.strokeStyle = `rgba(153, 69, 255, ${patternProgress * 0.8})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      
      // Draw pattern lines progressively
      const drawLine = (from, to, threshold) => {
        if (patternProgress < threshold || !from || !to) return;
        const lineProgress = Math.min(1, (patternProgress - threshold) / 0.2);
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(
          from.x + (to.x - from.x) * lineProgress,
          from.y + (to.y - from.y) * lineProgress
        );
        ctx.stroke();
      };
      
      drawLine(points.X, points.A, 0);
      drawLine(points.A, points.B, 0.15);
      drawLine(points.B, points.C, 0.3);
      drawLine(points.C, points.D, 0.45);
      
      ctx.setLineDash([]);
      
      // Draw point labels
      const drawLabel = (point, label, threshold) => {
        if (patternProgress < threshold || !point) return;
        const labelOpacity = Math.min(1, (patternProgress - threshold) / 0.1);
        
        ctx.fillStyle = `rgba(153, 69, 255, ${labelOpacity})`;
        ctx.font = 'bold 14px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, point.x, point.y - 10);
        
        // Point circle
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      };
      
      drawLabel(points.X, 'X', 0);
      drawLabel(points.A, 'A', 0.15);
      drawLabel(points.B, 'B', 0.3);
      drawLabel(points.C, 'C', 0.45);
      drawLabel(points.D, 'D', 0.6);
    }
    
    // Glow effect on edges
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(153, 69, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(153, 69, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 240, 255, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 3);
    ctx.fillRect(0, height - 3, width, 3);
    
  }, [candleData, animationProgress]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={500} 
      height={400}
      className="login-chart-canvas"
    />
  );
};

const Login = () => {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  
  // Validation
  const errors = {
    username: touched.username && !username.trim() ? 'Nazwa użytkownika jest wymagana' : '',
    password: touched.password && !password ? 'Hasło jest wymagane' : '',
  };
  
  const isFormValid = username.trim() && password;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setTouched({ username: true, password: true });
      return;
    }
    
    // Sanitize username before sending
    const sanitizedUsername = sanitizeString(username.trim());
    dispatch(login({ username: sanitizedUsername, password }));
  };
  
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };
  
  // Clear error when user starts typing
  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (error) dispatch(clearError());
  };
  
  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) dispatch(clearError());
  };
  
  return (
    <div className="login-container">
      {/* Background effects */}
      <div className="login-bg-pattern" />
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />
      
      <div className="login-content">
        {/* Left side - Login form */}
        <div className="login-form-container">
          <div className="login-form-card">
            <div className="login-header">
              <div className="login-logo">
                <span className="login-logo-icon">◈</span>
                <span className="login-logo-text">TRADING AI</span>
              </div>
              <p className="login-subtitle">Zaloguj się do panelu</p>
            </div>
            
            <form className="login-form" onSubmit={handleSubmit}>
              <div className={`form-group ${errors.username ? 'has-error' : ''}`}>
                <label htmlFor="username">
                  <span className="label-icon">◎</span>
                  Nazwa użytkownika
                </label>
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={handleUsernameChange}
                  onBlur={() => handleBlur('username')}
                  placeholder="Wprowadź nazwę użytkownika"
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
                {errors.username && (
                  <span className="error-message">{errors.username}</span>
                )}
              </div>
              
              <div className={`form-group ${errors.password ? 'has-error' : ''}`}>
                <label htmlFor="password">
                  <span className="label-icon">⚿</span>
                  Hasło
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={() => handleBlur('password')}
                    placeholder="Wprowadź hasło"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? '◉' : '◎'}
                  </button>
                </div>
                {errors.password && (
                  <span className="error-message">{errors.password}</span>
                )}
              </div>
              
              {error && (
                <div className="form-error-alert">
                  <span className="error-icon">⚠</span>
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                className={`login-submit-btn ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner">⟳</span>
                    Logowanie...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">→</span>
                    Zaloguj się
                  </>
                )}
              </button>
            </form>
            
            <div className="login-footer">
              <span className="login-footer-text">
                Harmonic Pattern Trading System
              </span>
            </div>
          </div>
        </div>
        
        {/* Right side - Animated chart */}
        <div className="login-chart-container">
          <div className="login-chart-wrapper">
            <AnimatedChart />
            <div className="login-chart-overlay">
              <div className="chart-label">
                <span className="chart-label-icon">◇</span>
                <span>XABCD Harmonic Pattern</span>
              </div>
              <div className="chart-info">
                <span className="bullish-label">● Bullish</span>
                <span className="bearish-label">● Bearish</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

