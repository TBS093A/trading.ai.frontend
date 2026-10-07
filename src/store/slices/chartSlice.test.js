import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import chartReducer, {
  fetchKlines,
  fetchOlderKlines,
  HISTORY_PAGE_LIMIT,
  MAX_KLINES,
} from './chartSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { getKlines: jest.fn() },
}));

const HOUR = 3600e3;

// Raw API candles (strings, extra fields) for open times [from, to)
const rawKlines = (from, to) => {
  const out = [];
  for (let t = from; t < to; t++) {
    out.push({
      open_time: t * HOUR,
      open: '1.5', high: '2', low: '1', close: '1.75', volume: '10',
      close_time: (t + 1) * HOUR - 1, trades: 3,
    });
  }
  return out;
};

const respond = (klines) => ({ data: { asset: 'BTC', quote: 'USDT', interval: '1h', klines } });

const makeStore = () => configureStore({
  reducer: { chart: chartReducer, assets: (s = { selectedAsset: { id: 1 } }) => s },
  middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
});

const loadInitial = async (store, from, to) => {
  api.getKlines.mockResolvedValueOnce(respond(rawKlines(from, to)));
  await store.dispatch(fetchKlines({ assetId: 1, interval: '1h' }));
};

const loadOlder = (store, from, to) => {
  api.getKlines.mockResolvedValueOnce(respond(rawKlines(from, to)));
  const { klines, datasetId } = store.getState().chart;
  return store.dispatch(fetchOlderKlines({
    assetId: 1, interval: '1h', endTime: klines[0].open_time - 1, datasetId,
  }));
};

beforeEach(() => api.getKlines.mockReset());

test('normalizes candles to numbers and drops unused fields', async () => {
  const store = makeStore();
  await loadInitial(store, 100, 102);
  const [first] = store.getState().chart.klines;
  expect(first).toEqual({ open_time: 100 * HOUR, open: 1.5, high: 2, low: 1, close: 1.75, volume: 10 });
});

test('accepts the compact row format described by `fields`', async () => {
  const store = makeStore();
  api.getKlines.mockResolvedValueOnce({ data: {
    asset: 'BTC', quote: 'USDT', interval: '1h',
    fields: ['open_time', 'open', 'high', 'low', 'close', 'volume'],
    klines: [[2 * HOUR, 1.5, 2, 1, 1.75, 10], [1 * HOUR, '3', '4', '2', '3.5', '20']],
  } });
  await store.dispatch(fetchKlines({ assetId: 1, interval: '1h' }));
  expect(store.getState().chart.klines).toEqual([
    { open_time: 1 * HOUR, open: 3, high: 4, low: 2, close: 3.5, volume: 20 },
    { open_time: 2 * HOUR, open: 1.5, high: 2, low: 1, close: 1.75, volume: 10 },
  ]);
});

test('prepends an older page using end_time as the cursor', async () => {
  const store = makeStore();
  await loadInitial(store, 100, 200);
  await loadOlder(store, 50, 100);

  const { klines, hasMoreHistory } = store.getState().chart;
  expect(api.getKlines).toHaveBeenLastCalledWith(1, '1h', HISTORY_PAGE_LIMIT, null, 100 * HOUR - 1);
  expect(klines).toHaveLength(150);
  expect(klines[0].open_time).toBe(50 * HOUR);
  expect(klines[149].open_time).toBe(199 * HOUR);
  expect(hasMoreHistory).toBe(true);
});

test('drops overlapping candles and stops when a page brings nothing new', async () => {
  const store = makeStore();
  await loadInitial(store, 100, 200);
  // Exchange ignoring end_time and returning the latest page again
  await loadOlder(store, 100, 200);

  const { klines, hasMoreHistory } = store.getState().chart;
  expect(klines).toHaveLength(100);
  expect(hasMoreHistory).toBe(false);

  // No further requests once history is exhausted
  api.getKlines.mockClear();
  await loadOlder(store, 0, 100);
  expect(api.getKlines).not.toHaveBeenCalled();
});

test('caps candles in memory at MAX_KLINES, keeping the newest', async () => {
  const store = makeStore();
  const newest = 10 * MAX_KLINES;
  await loadInitial(store, newest - (MAX_KLINES - 10), newest);
  await loadOlder(store, newest - MAX_KLINES - 100, newest - (MAX_KLINES - 10));

  const { klines, hasMoreHistory } = store.getState().chart;
  expect(klines).toHaveLength(MAX_KLINES);
  expect(klines[klines.length - 1].open_time).toBe((newest - 1) * HOUR);
  expect(klines[0].open_time).toBe((newest - MAX_KLINES) * HOUR);
  expect(hasMoreHistory).toBe(false);
});

test('ignores a history page that arrives after switching to another dataset', async () => {
  const store = makeStore();
  await loadInitial(store, 100, 200);

  let resolveOld;
  api.getKlines.mockReturnValueOnce(new Promise((r) => { resolveOld = r; }));
  const { datasetId } = store.getState().chart;
  const pending = store.dispatch(fetchOlderKlines({ assetId: 1, interval: '1h', endTime: 100 * HOUR - 1, datasetId }));

  await loadInitial(store, 1000, 1100); // user picked another asset meanwhile
  resolveOld(respond(rawKlines(0, 100)));
  await pending;

  const { klines, historyLoading } = store.getState().chart;
  expect(klines).toHaveLength(100);
  expect(klines[0].open_time).toBe(1000 * HOUR);
  expect(historyLoading).toBe(false);
});

test('keeps only one history request in flight', async () => {
  const store = makeStore();
  await loadInitial(store, 100, 200);

  let resolveFirst;
  api.getKlines.mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }));
  const args = { assetId: 1, interval: '1h', endTime: 100 * HOUR - 1, datasetId: store.getState().chart.datasetId };
  const first = store.dispatch(fetchOlderKlines(args));
  store.dispatch(fetchOlderKlines(args));
  expect(api.getKlines).toHaveBeenCalledTimes(2); // initial load + one history page

  resolveFirst(respond(rawKlines(0, 100)));
  await first;
  expect(store.getState().chart.klines).toHaveLength(200);
});

test('a superseded initial load does not overwrite the newer one', async () => {
  const store = makeStore();
  let resolveSlow;
  api.getKlines.mockReturnValueOnce(new Promise((r) => { resolveSlow = r; }));
  const slow = store.dispatch(fetchKlines({ assetId: 1, interval: '1h' }));
  await loadInitial(store, 500, 600);

  resolveSlow(respond(rawKlines(0, 100)));
  await slow;
  expect(store.getState().chart.klines[0].open_time).toBe(500 * HOUR);
  expect(store.getState().chart.loading).toBe(false);
});
