import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import analysisReducer from './analysisSlice';
import chartReducer, { fetchKlines } from './chartSlice';
import harmonicsReducer, {
  scanHarmonics,
  validateManualPattern,
  addManualPoint,
  undoManualPoint,
  startManual,
  dismissScan,
  formatApiError,
} from './harmonicsSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { getHarmonics: jest.fn(), validateHarmonic: jest.fn(), getKlines: jest.fn() },
}));

const makeStore = () => configureStore({
  reducer: { chart: chartReducer, analysis: analysisReducer, harmonics: harmonicsReducer },
  middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
});

const pattern = (id) => ({ id, d_point_timestamp: id * 1000, ta_object_json: { points: {} } });
const page = (status, patterns, extra = {}) => ({
  data: { status, start_time: 1, end_time: 2, patterns, retry_after_ms: 1, ...extra },
});
const args = { assetId: 1, interval: '1h', startTime: 1, endTime: 2 };

beforeEach(() => {
  jest.resetAllMocks();
});

test('polls while computing, draws partial patterns, finishes on complete', async () => {
  const store = makeStore();
  api.getHarmonics
    .mockResolvedValueOnce(page('computing', [pattern(1)]))
    .mockResolvedValueOnce(page('complete', [pattern(1), pattern(2)]));

  await store.dispatch(scanHarmonics(args));

  expect(api.getHarmonics).toHaveBeenCalledTimes(2);
  expect(api.getHarmonics).toHaveBeenLastCalledWith(1, '1h', 1, 2);
  expect(store.getState().analysis.harmonicPatterns.map((p) => p.id)).toEqual([1, 2]);
  expect(store.getState().harmonics.scan).toMatchObject({ status: 'complete', found: 2, range: [1, 2] });
});

test('merging does not duplicate patterns already on the chart', async () => {
  const store = makeStore();
  api.getHarmonics.mockResolvedValueOnce(page('complete', [pattern(1)]));
  await store.dispatch(scanHarmonics(args));
  api.getHarmonics.mockResolvedValueOnce(page('complete', [pattern(1), pattern(3)]));
  await store.dispatch(scanHarmonics(args));
  expect(store.getState().analysis.harmonicPatterns.map((p) => p.id)).toEqual([1, 3]);
});

test('a failed scan shows the error and does not keep polling', async () => {
  const store = makeStore();
  api.getHarmonics.mockResolvedValueOnce(page('failed', [], { error: 'worker crashed' }));
  await store.dispatch(scanHarmonics(args));
  expect(api.getHarmonics).toHaveBeenCalledTimes(1);
  expect(store.getState().harmonics.scan).toMatchObject({ status: 'failed', error: 'worker crashed', request: args });
});

test('422 detail from the API is shown as-is', async () => {
  const store = makeStore();
  api.getHarmonics.mockRejectedValueOnce({ response: { data: { detail: 'Range too long: 2500 candles (max 2000)' } } });
  await store.dispatch(scanHarmonics(args));
  expect(store.getState().harmonics.scan.error).toBe('Range too long: 2500 candles (max 2000)');
});

test('dismissing a computing scan stops its polling', async () => {
  const store = makeStore();
  let resolveFirst;
  api.getHarmonics.mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }));
  const running = store.dispatch(scanHarmonics(args));
  store.dispatch(dismissScan());
  resolveFirst(page('computing', [pattern(1)]));
  await running;

  expect(api.getHarmonics).toHaveBeenCalledTimes(1);
  expect(store.getState().analysis.harmonicPatterns).toEqual([]);
  expect(store.getState().harmonics.scan.status).toBe('idle');
});

test('a newer dataset (asset/interval switch) resets tools and drops the old scan', async () => {
  const store = makeStore();
  let resolveScan;
  api.getHarmonics.mockReturnValueOnce(new Promise((r) => { resolveScan = r; }));
  const running = store.dispatch(scanHarmonics(args));

  api.getKlines.mockResolvedValueOnce({ data: { interval: '4h', klines: [] } });
  await store.dispatch(fetchKlines({ assetId: 2, interval: '4h' }));
  resolveScan(page('complete', [pattern(9)]));
  await running;

  expect(store.getState().harmonics.scan.status).toBe('idle');
  expect(store.getState().analysis.harmonicPatterns).toEqual([]);
});

test('manual points are placed in X, A, B, C, D order and undone from the end', () => {
  const store = makeStore();
  store.dispatch(startManual());
  ['X', 'A', 'B'].forEach((_, i) => store.dispatch(addManualPoint({ time: i, price: 10 + i })));
  expect(Object.keys(store.getState().harmonics.manual.points)).toEqual(['X', 'A', 'B']);
  store.dispatch(undoManualPoint());
  expect(Object.keys(store.getState().harmonics.manual.points)).toEqual(['X', 'A']);
});

test('validate stores the verdict, or the readable 422 detail', async () => {
  const store = makeStore();
  store.dispatch(startManual());
  api.validateHarmonic.mockResolvedValueOnce({ data: { direction: 'bullish', complete: true, matches: [{ pattern: 'gartley' }] } });
  await store.dispatch(validateManualPattern({ points: { X: {}, A: {}, B: {}, C: {}, D: {} } }));
  expect(store.getState().harmonics.manual.result.matches[0].pattern).toBe('gartley');

  api.validateHarmonic.mockRejectedValueOnce({ response: { data: { detail: [{ msg: 'prices must zigzag' }] } } });
  await store.dispatch(validateManualPattern({ points: {} }));
  expect(store.getState().harmonics.manual.error).toBe('prices must zigzag');
});

test('formatApiError falls back to the message', () => {
  expect(formatApiError(new Error('Network Error'), 'x')).toBe('Network Error');
  expect(formatApiError(undefined, 'fallback')).toBe('fallback');
});
