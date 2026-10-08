import { parseDeepLink } from './deepLink';

jest.mock('../services/api', () => ({ __esModule: true, default: { getAssetById: jest.fn() } }));

test('parses an e-mail link', () => {
  expect(parseDeepLink('?view=chart&asset_id=5&interval=4h&t=1700000000000&pattern=bat&x=1699000000000&c=1699500000000'))
    .toEqual({ view: 'chart', assetId: 5, interval: '4h', t: 1700000000000, pattern: 'bat', x: 1699000000000, c: 1699500000000 });
});

test('ignores missing and malformed parameters', () => {
  expect(parseDeepLink('')).toBeNull();
  expect(parseDeepLink('?foo=bar')).toBeNull();
  expect(parseDeepLink('?asset_id=abc&t=-5&x=1.5')).toBeNull();
  expect(parseDeepLink('?asset_id=7&t=oops')).toEqual({
    view: null, assetId: 7, interval: null, t: null, pattern: null, x: null, c: null,
  });
});

test('unknown intervals are dropped when the list is known', () => {
  expect(parseDeepLink('?asset_id=1&interval=2h', ['1h', '4h']).interval).toBeNull();
  expect(parseDeepLink('?asset_id=1&interval=4h', ['1h', '4h']).interval).toBe('4h');
});
