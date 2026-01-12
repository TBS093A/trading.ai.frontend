/**
 * Technical Indicators Calculations
 * These are display-only calculations for client-side visualization
 */

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array} klines - Klines data
 * @param {number} period - RSI period (default 14)
 * @returns {Array} RSI data for chart
 */
export const calculateRSI = (klines, period = 14) => {
  if (klines.length < period + 1) return [];

  const closes = klines.map((k) => parseFloat(k.close));
  const rsiData = [];

  // Calculate price changes
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Calculate initial average gains and losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  rsiData.push({
    time: klines[period].open_time / 1000,
    value: rsi,
  });

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);

    rsiData.push({
      time: klines[i + 1].open_time / 1000,
      value: rsi,
    });
  }

  return rsiData;
};

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {Array} data - Price data
 * @param {number} period - EMA period
 * @returns {Array} EMA values
 */
const calculateEMA = (data, period) => {
  const multiplier = 2 / (period + 1);
  const ema = [];

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema.push(sum / period);

  // Calculate subsequent EMAs
  for (let i = period; i < data.length; i++) {
    ema.push((data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }

  return ema;
};

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {Array} klines - Klines data
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line period (default 9)
 * @returns {Object} MACD data { macdLine, signalLine, histogram }
 */
export const calculateMACD = (klines, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (klines.length < slowPeriod + signalPeriod) {
    return { macdLine: [], signalLine: [], histogram: [] };
  }

  const closes = klines.map((k) => parseFloat(k.close));

  // Calculate EMAs
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // Calculate MACD line (fast EMA - slow EMA)
  const macdValues = [];
  const startIndex = slowPeriod - 1;
  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = i + (slowPeriod - fastPeriod);
    if (fastIndex >= 0 && fastIndex < fastEMA.length) {
      macdValues.push(fastEMA[fastIndex] - slowEMA[i]);
    }
  }

  // Calculate Signal line (EMA of MACD)
  const signalEMA = calculateEMA(macdValues, signalPeriod);

  // Build output arrays
  const macdLine = [];
  const signalLine = [];
  const histogram = [];

  const dataStartIndex = slowPeriod - 1 + signalPeriod - 1;

  for (let i = signalPeriod - 1; i < macdValues.length; i++) {
    const klineIndex = startIndex + i;
    if (klineIndex < klines.length) {
      const time = klines[klineIndex].open_time / 1000;
      const macdValue = macdValues[i];
      const signalValue = signalEMA[i - signalPeriod + 1];
      const histValue = macdValue - signalValue;

      macdLine.push({ time, value: macdValue });
      signalLine.push({ time, value: signalValue });
      histogram.push({ time, value: histValue });
    }
  }

  return { macdLine, signalLine, histogram };
};

/**
 * Calculate OBV (On-Balance Volume)
 * @param {Array} klines - Klines data
 * @returns {Array} OBV data for chart
 */
export const calculateOBV = (klines) => {
  if (klines.length < 2) return [];

  const obvData = [];
  let obv = 0;

  // First data point
  obvData.push({
    time: klines[0].open_time / 1000,
    value: obv,
  });

  for (let i = 1; i < klines.length; i++) {
    const currentClose = parseFloat(klines[i].close);
    const previousClose = parseFloat(klines[i - 1].close);
    const volume = parseFloat(klines[i].volume);

    if (currentClose > previousClose) {
      obv += volume;
    } else if (currentClose < previousClose) {
      obv -= volume;
    }
    // If equal, OBV stays the same

    obvData.push({
      time: klines[i].open_time / 1000,
      value: obv,
    });
  }

  return obvData;
};

/**
 * Calculate SMA (Simple Moving Average)
 * @param {Array} klines - Klines data
 * @param {number} period - SMA period
 * @returns {Array} SMA data for chart
 */
export const calculateSMA = (klines, period) => {
  if (klines.length < period) return [];

  const smaData = [];
  const closes = klines.map((k) => parseFloat(k.close));

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += closes[i - j];
    }
    smaData.push({
      time: klines[i].open_time / 1000,
      value: sum / period,
    });
  }

  return smaData;
};

/**
 * Calculate Bollinger Bands
 * @param {Array} klines - Klines data
 * @param {number} period - Period (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {Object} Bollinger Bands data { upper, middle, lower }
 */
export const calculateBollingerBands = (klines, period = 20, stdDev = 2) => {
  if (klines.length < period) return { upper: [], middle: [], lower: [] };

  const closes = klines.map((k) => parseFloat(k.close));
  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = period - 1; i < closes.length; i++) {
    // Calculate SMA
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += closes[i - j];
    }
    const sma = sum / period;

    // Calculate Standard Deviation
    let sqSum = 0;
    for (let j = 0; j < period; j++) {
      sqSum += Math.pow(closes[i - j] - sma, 2);
    }
    const std = Math.sqrt(sqSum / period);

    const time = klines[i].open_time / 1000;
    middle.push({ time, value: sma });
    upper.push({ time, value: sma + stdDev * std });
    lower.push({ time, value: sma - stdDev * std });
  }

  return { upper, middle, lower };
};

