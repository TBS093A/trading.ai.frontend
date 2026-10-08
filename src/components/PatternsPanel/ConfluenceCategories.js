import React from 'react';

// Confluence checklist grouped in the five categories used for patterns and setups.
// `confluences` is a confluences_json object: { total_score, confluences: [{type, confidence, ...}] }
export const CONFLUENCE_CATEGORIES = [
  {
    title: '1. RSI / Stochastic Divergence at D',
    items: [
      { label: 'RSI Oversold', types: ['rsi_oversold'], direction: 'bullish' },
      { label: 'RSI Overbought', types: ['rsi_overbought'], direction: 'bearish' },
      { label: 'RSI Bullish Divergence', types: ['rsi_bullish_divergence'], direction: 'bullish' },
      { label: 'RSI Bearish Divergence', types: ['rsi_bearish_divergence'], direction: 'bearish' },
      { label: 'Stochastic Oversold', types: ['stochastic_oversold'], direction: 'bullish' },
      { label: 'Stochastic Overbought', types: ['stochastic_overbought'], direction: 'bearish' },
    ],
  },
  {
    title: '2. Candlestick Pattern at D',
    items: [
      { label: 'Bullish Engulfing', types: ['bullish_engulfing'], direction: 'bullish' },
      { label: 'Bearish Engulfing', types: ['bearish_engulfing'], direction: 'bearish' },
      { label: 'Bullish Pin Bar', types: ['bullish_pin_bar'], direction: 'bullish' },
      { label: 'Bearish Pin Bar', types: ['bearish_pin_bar'], direction: 'bearish' },
      { label: 'Hammer', types: ['hammer'], direction: 'bullish' },
      { label: 'Shooting Star', types: ['shooting_star'], direction: 'bearish' },
      { label: 'Morning Star', types: ['morning_star'], direction: 'bullish' },
      { label: 'Evening Star', types: ['evening_star'], direction: 'bearish' },
      { label: 'Doji', types: ['doji'], direction: 'both' },
    ],
  },
  {
    title: '3. Fibonacci Cluster',
    items: [
      { label: 'Fib Cluster (same TF)', types: ['fib_cluster'], direction: 'both' },
      { label: 'Higher TF Fib', types: ['higher_tf_fib'], direction: 'both' },
    ],
  },
  {
    title: '4. Support / Resistance from Higher TF',
    items: [
      { label: 'Higher TF Support Zone', types: ['higher_tf_support_zone'], direction: 'bullish' },
      { label: 'Higher TF Resistance Zone', types: ['higher_tf_resistance_zone'], direction: 'bearish' },
      { label: 'Higher TF Support Trendline', types: ['higher_tf_support_trendline'], direction: 'bullish' },
      { label: 'Higher TF Resistance Trendline', types: ['higher_tf_resistance_trendline'], direction: 'bearish' },
      { label: 'Support Zone (same TF)', types: ['support_zone'], direction: 'bullish' },
      { label: 'Resistance Zone (same TF)', types: ['resistance_zone'], direction: 'bearish' },
      { label: 'Support Trendline (same TF)', types: ['support_trendline'], direction: 'bullish' },
      { label: 'Resistance Trendline (same TF)', types: ['resistance_trendline'], direction: 'bearish' },
      { label: 'Pivot Point', types: ['pivot_point'], direction: 'both' },
      { label: 'Round Level', types: ['round_level'], direction: 'both' },
    ],
  },
  {
    title: '5. Volume Confirmation',
    items: [
      { label: 'Volume Spike', types: ['volume_spike'], direction: 'both' },
      { label: 'Volume Dry-up', types: ['volume_dryup'], direction: 'both' },
      { label: 'Volume Profile (POC/VAH/VAL)', types: ['volume_profile'], direction: 'both' },
      { label: 'MACD Bullish Crossover', types: ['macd_bullish_crossover'], direction: 'bullish' },
      { label: 'MACD Bearish Crossover', types: ['macd_bearish_crossover'], direction: 'bearish' },
      { label: 'MACD Histogram Reversal', types: ['macd_histogram_reversal'], direction: 'both' },
      { label: 'MACD Bullish Divergence', types: ['macd_bullish_divergence'], direction: 'bullish' },
      { label: 'MACD Bearish Divergence', types: ['macd_bearish_divergence'], direction: 'bearish' },
      { label: 'OBV Bullish Divergence', types: ['obv_bullish_divergence'], direction: 'bullish' },
      { label: 'OBV Bearish Divergence', types: ['obv_bearish_divergence'], direction: 'bearish' },
    ],
  },
];

const ConfluenceCategories = ({ confluences, isBullish, collapsed = {}, onToggle, title = 'Confluences', note = null }) => {
  const cList = confluences?.confluences || [];
  const cTypes = new Set(cList.map((c) => c.type));
  const patternDirection = isBullish === true ? 'bullish' : isBullish === false ? 'bearish' : 'both';

  const matchesDirection = (direction) => {
    if (patternDirection === 'both') return true;
    if (!direction || direction === 'both') return true;
    return direction === patternDirection;
  };

  const getMatchedConfluence = (types) => cList.find((c) => types.includes(c.type));
  const totalScore = confluences?.total_score || 0;

  return (
    <div className="details-section confluences-section">
      <div className="details-title">
        {title}
        {totalScore > 0 && <span className="confluence-score">{totalScore} found</span>}
      </div>
      {note && <div className="confluence-note">{note}</div>}
      <div className="confluences-list">
        {CONFLUENCE_CATEGORIES.map((cat) => {
          const itemsVisible = cat.items.filter((item) => matchesDirection(item.direction));
          if (itemsVisible.length === 0) return null;

          const catHits = itemsVisible.filter((item) => item.types.some((t) => cTypes.has(t))).length;
          const isCatCollapsed = collapsed[cat.title] !== false;

          return (
            <div key={cat.title} className="confluence-category">
              <button
                type="button"
                className={`confluence-cat-title ${catHits > 0 ? 'has-hits' : ''} ${isCatCollapsed ? 'collapsed' : ''}`}
                onClick={(e) => onToggle?.(e, cat.title)}
                aria-expanded={!isCatCollapsed}
              >
                <span className="confluence-cat-chevron" aria-hidden>
                  {isCatCollapsed ? '▸' : '▾'}
                </span>
                <span className="confluence-cat-title-text">{cat.title}</span>
                {catHits > 0 && (
                  <span className="cat-hits">
                    {catHits}/{itemsVisible.length}
                  </span>
                )}
              </button>
              {!isCatCollapsed && (
                <div className="confluence-items">
                  {itemsVisible.map((item) => {
                    const match = getMatchedConfluence(item.types);
                    const active = !!match;
                    return (
                      <div
                        key={item.label}
                        className={`confluence-item ${active ? 'active' : 'inactive'}`}
                        title={active ? `Confidence: ${(match.confidence * 100).toFixed(0)}%` : 'Not detected'}
                      >
                        <span className={`confluence-dot ${active ? 'hit' : 'miss'}`}>
                          {active ? '●' : '○'}
                        </span>
                        <span className="confluence-label">{item.label}</span>
                        {active && (
                          <span className="confluence-conf">
                            {(match.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConfluenceCategories;
