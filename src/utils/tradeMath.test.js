import {
  riskAmount, feeInR, netR, expectedLosingStreak, streakDrawdownPct, projectGroup,
} from './tradeMath';

test('1R is the share of capital at risk', () => {
  expect(riskAmount(1000, 1)).toBe(10);
  expect(riskAmount(1000, 0.5)).toBe(5);
});

test('fees in R grow as the stop gets tighter', () => {
  // 0.1% per side, stop 1.2% away: 0.2 / 1.2 = 0.1667R (the 830$ BTC example)
  expect(feeInR(0.1, 1.2)).toBeCloseTo(0.1667, 3);
  expect(feeInR(0.1, 0.5)).toBeCloseTo(0.4, 5);
  expect(feeInR(0.1, 0)).toBeNull();
});

test('net R subtracts fees, null stays null', () => {
  expect(netR(0.15, 0.1667)).toBeCloseTo(-0.0167, 3);
  expect(netR(null, 0.1)).toBeNull();
});

test('expected losing streak rises with the loss rate', () => {
  expect(expectedLosingStreak(0, 100)).toBe(0);
  expect(expectedLosingStreak(1, 100)).toBe(100);
  expect(expectedLosingStreak(0.5, 100)).toBe(6); // log2(50) = 5.6
  expect(expectedLosingStreak(0.65, 100)).toBe(9); // ln(35)/ln(1/0.65) = 8.3
  expect(expectedLosingStreak(null)).toBeNull();
});

test('streak drawdown compounds on the remaining balance', () => {
  expect(streakDrawdownPct(8, 1)).toBeCloseTo(7.73, 2);
  expect(streakDrawdownPct(8, 5)).toBeCloseTo(33.66, 2);
});

test('group projection over 100 trades', () => {
  const p = projectGroup(
    { trades: 50, wins: 20, losses: 30, avg_r: 0.3 },
    { capital: 1000, riskPct: 1, feePct: 0.1, stopDistancePct: 2, horizon: 100 },
  );
  expect(p.risk).toBe(10);
  expect(p.feeR).toBeCloseTo(0.1, 5);
  expect(p.netR).toBeCloseTo(0.2, 5);
  expect(p.resultUsd).toBeCloseTo(200, 5);
  expect(p.resultPct).toBeCloseTo(20, 5);
  expect(p.lossRate).toBe(0.6);
  expect(p.streak).toBe(8); // ln(40)/ln(1/0.6) = 7.2
  expect(p.streakDrawdownPct).toBeCloseTo(7.73, 2);

  const empty = projectGroup({ trades: 0, wins: 0, losses: 0, avg_r: null }, { capital: 1000, riskPct: 1, feePct: 0.1, stopDistancePct: 2 });
  expect(empty.netR).toBeNull();
  expect(empty.resultUsd).toBeNull();
  expect(empty.streak).toBeNull();
});
