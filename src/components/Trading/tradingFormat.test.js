import { htfTrendOf, HTF_TREND } from './tradingFormat';

test('htf_trend is read from event data_json / data or the event itself', () => {
  expect(htfTrendOf({ data_json: { htf_trend: 'with' } })).toBe('with');
  expect(htfTrendOf({ data: { htf_trend: 'with' } })).toBe('with');
  expect(htfTrendOf({ htf_trend: 'against' })).toBe('against');
  expect(htfTrendOf({ data: { htf_trend: null } })).toBe(null);
  expect(htfTrendOf({})).toBe(null);
  expect(HTF_TREND[htfTrendOf({})]).toBeUndefined();
});
