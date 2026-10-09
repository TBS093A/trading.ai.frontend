import React from 'react';
import { HTF_TREND, htfTrendOf } from './tradingFormat';

// Small badge: was the signal with or against the higher-timeframe trend (nothing when unknown)
const HtfTrendBadge = ({ event }) => {
  const t = HTF_TREND[htfTrendOf(event)];
  if (!t) return null;
  return <span className={`htf-badge ${htfTrendOf(event)}`} title={t.title}>{t.label}</span>;
};

export default HtfTrendBadge;
