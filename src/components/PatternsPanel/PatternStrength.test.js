import { strengthTint, compareByStrength } from './PatternStrength';

jest.mock('../../services/api', () => ({ __esModule: true, default: { getStrengthModel: jest.fn() } }));

test('tint alpha follows the score, null stays neutral', () => {
  expect(strengthTint(null)).toBeNull();
  expect(strengthTint({ score: null })).toBeNull();
  expect(strengthTint({ score: 0 })).toBe('rgba(0, 255, 136, 0.040)');
  expect(strengthTint({ score: 50 })).toBe('rgba(0, 255, 136, 0.190)');
  expect(strengthTint({ score: 100 })).toBe('rgba(0, 255, 136, 0.340)');
  expect(strengthTint({ score: 140 })).toBe('rgba(0, 255, 136, 0.340)');
});

test('strength sort: strongest first, unscored last, ties by newest D', () => {
  const p = (id, score, d) => ({ id, d_point_timestamp: d, strength: score == null ? null : { score } });
  const list = [p(1, 40, 10), p(2, null, 50), p(3, 90, 5), p(4, 40, 30), p(5, null, 20)];
  const dTime = (x) => x.d_point_timestamp;
  expect(list.sort((a, b) => compareByStrength(a, b, dTime)).map((x) => x.id)).toEqual([3, 4, 1, 2, 5]);
});
