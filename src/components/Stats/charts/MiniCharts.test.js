import { niceTicks } from './MiniCharts';

test('nice ticks cover the range with round steps', () => {
  expect(niceTicks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  expect(niceTicks(0.48, 0.71)).toEqual([0.4, 0.5, 0.6, 0.7, 0.8]);
  expect(niceTicks(-0.3, 0.3)).toEqual([-0.4, -0.2, 0, 0.2, 0.4]);
  expect(niceTicks(5, 5)).toEqual([4, 4.5, 5, 5.5, 6]);
  expect(niceTicks(NaN, 1)).toEqual([]);
});
