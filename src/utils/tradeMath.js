/**
 * Position sizing / expectancy helpers for the setup performance calculator.
 * All results are linear (no compounding) and ignore slippage.
 */

// Dollar amount lost when the stop is hit (1R)
export const riskAmount = (capital, riskPct) => capital * (riskPct / 100);

// Round-trip fee expressed in R: fees are a share of the position's notional, and the notional is
// risk / stop distance, so each % of fee costs (fee / stop distance) R per side.
export const feeInR = (feePctPerSide, stopDistancePct) => {
  if (!(stopDistancePct > 0)) return null;
  return (2 * feePctPerSide) / stopDistancePct;
};

export const netR = (avgR, feeR) => (avgR == null || feeR == null ? null : avgR - feeR);

// Expected longest run of losses in `trades` trades for a loss probability `q`
// (classic approximation: log base 1/q of trades * (1 - q))
export const expectedLosingStreak = (q, trades = 100) => {
  if (q == null || trades <= 0) return null;
  if (q <= 0) return 0;
  if (q >= 1) return trades;
  const run = Math.log(trades * (1 - q)) / Math.log(1 / q);
  return Math.max(1, Math.ceil(run));
};

// Capital lost over a losing streak when risking riskPct of the current balance each time
export const streakDrawdownPct = (streak, riskPct) => {
  if (streak == null) return null;
  return (1 - (1 - riskPct / 100) ** streak) * 100;
};

/**
 * Projection for one stats group over `horizon` trades.
 * Returns null fields when the group has no trades.
 */
export const projectGroup = (group, { capital, riskPct, feePct, stopDistancePct, horizon = 100 }) => {
  const risk = riskAmount(capital, riskPct);
  const fee = feeInR(feePct, stopDistancePct);
  const net = netR(group.avg_r, fee);
  const lossRate = group.trades > 0 ? group.losses / group.trades : null;
  const streak = expectedLosingStreak(lossRate, horizon);
  return {
    risk,
    feeR: fee,
    netR: net,
    resultUsd: net == null ? null : horizon * net * risk,
    resultPct: net == null || !(capital > 0) ? null : (horizon * net * risk / capital) * 100,
    lossRate,
    streak,
    streakDrawdownPct: streakDrawdownPct(streak, riskPct),
  };
};
