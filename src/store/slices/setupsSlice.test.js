import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import chartReducer, { fetchKlines } from './chartSlice';
import setupsReducer, {
  buildStatsParams,
  fetchSetupStats,
  fetchChartSetups,
  setShowSetupsOnChart,
  toggleGroupBy,
  toggleSetupStatus,
  soloSetupStatus,
  SETUP_STATUSES,
  fetchSetupSectionCounts,
  fetchSetupSection,
  setShowJunk,
  SECTION_PAGE,
} from './setupsSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { getHarmonicStats: jest.fn(), getHarmonicSetups: jest.fn(), getTrackedSetups: jest.fn(), getKlines: jest.fn(), getSetupSections: jest.fn() },
}));

const makeStore = () => configureStore({
  reducer: { chart: chartReducer, setups: setupsReducer },
  middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
});

beforeEach(() => jest.resetAllMocks());

test('stats query leaves out "all" filters and maps direction to is_bullish', () => {
  expect(buildStatsParams({ groupBy: ['pattern_type'], interval: '', assetId: '', direction: 'all', source: '', minTrades: 0 }))
    .toEqual({ group_by: 'pattern_type' });
  expect(buildStatsParams({ groupBy: ['pattern_type', 'interval'], interval: '1h', assetId: '7', direction: 'bearish', source: 'live', minTrades: 5 }))
    .toEqual({ group_by: 'pattern_type,interval', interval: '1h', asset_id: '7', is_bullish: false, source: 'live', min_trades: 5 });
});

test('group_by toggles but never becomes empty', () => {
  const store = makeStore();
  store.dispatch(toggleGroupBy('interval'));
  expect(store.getState().setups.filters.groupBy).toEqual(['pattern_type', 'interval']);
  store.dispatch(toggleGroupBy('pattern_type'));
  store.dispatch(toggleGroupBy('interval'));
  expect(store.getState().setups.filters.groupBy).toEqual(['interval']);
});

test('stats load and errors (422 detail) are stored', async () => {
  const store = makeStore();
  api.getHarmonicStats.mockResolvedValueOnce({ data: { group_by: ['pattern_type'], groups: [{ pattern_type: 'gartley', setups: 3 }] } });
  await store.dispatch(fetchSetupStats(store.getState().setups.filters));
  expect(api.getHarmonicStats).toHaveBeenCalledWith({ group_by: 'pattern_type' });
  expect(store.getState().setups.stats.data.groups[0].pattern_type).toBe('gartley');

  api.getHarmonicStats.mockRejectedValueOnce({ response: { data: { detail: 'Unknown group_by: foo' } } });
  await store.dispatch(fetchSetupStats(store.getState().setups.filters));
  expect(store.getState().setups.stats.error).toBe('Unknown group_by: foo');
});

test('chart setups are requested for the asset/interval and cleared on a new dataset or when hidden', async () => {
  const store = makeStore();
  store.dispatch(setShowSetupsOnChart(true));
  api.getHarmonicSetups.mockResolvedValueOnce({ data: { setups: [{ id: 1 }] } });
  await store.dispatch(fetchChartSetups({ assetId: 3, interval: '4h' }));
  expect(api.getHarmonicSetups).toHaveBeenCalledWith({ asset_id: 3, interval: '4h', limit: 500 });
  expect(store.getState().setups.chart.setups).toHaveLength(1);

  api.getKlines.mockResolvedValueOnce({ data: { interval: '1h', klines: [] } });
  await store.dispatch(fetchKlines({ assetId: 4, interval: '1h' }));
  expect(store.getState().setups.chart.setups).toEqual([]);

  api.getHarmonicSetups.mockResolvedValueOnce({ data: { setups: [{ id: 2 }] } });
  await store.dispatch(fetchChartSetups({ assetId: 4, interval: '1h' }));
  store.dispatch(setShowSetupsOnChart(false));
  expect(store.getState().setups.chart.setups).toEqual([]);
});

test('status filter toggles, solos and is remembered', () => {
  localStorage.removeItem('setups.hiddenStatuses');
  const store = makeStore();
  store.dispatch(toggleSetupStatus('invalidated'));
  expect(store.getState().setups.hiddenStatuses).toEqual(['invalidated']);
  expect(JSON.parse(localStorage.getItem('setups.hiddenStatuses'))).toEqual(['invalidated']);

  store.dispatch(soloSetupStatus('waiting'));
  expect(store.getState().setups.hiddenStatuses).toEqual(SETUP_STATUSES.filter((st) => st !== 'waiting'));
  // Soloing the same status again shows everything
  store.dispatch(soloSetupStatus('waiting'));
  expect(store.getState().setups.hiddenStatuses).toEqual([]);

  store.dispatch(toggleSetupStatus('loss'));
  expect(JSON.parse(localStorage.getItem('setups.hiddenStatuses'))).toEqual(['loss']);
});

test('section counts and paged closed sections', async () => {
  const store = makeStore();
  api.getSetupSections.mockResolvedValueOnce({ data: {
    sections: { active: { statuses: ['waiting', 'open'], count: 3 }, won: { count: 60 }, lost: { count: 4 }, junk: { count: 9 } },
    by_status: { win: 60 },
  } });
  await store.dispatch(fetchSetupSectionCounts({ assetId: 1, interval: '1h' }));
  expect(store.getState().setups.sections.counts).toEqual({ active: 3, won: 60, lost: 4, junk: 9 });

  const page = (from, n) => Array.from({ length: n }, (_, i) => ({ id: from + i }));
  api.getHarmonicSetups.mockResolvedValueOnce({ data: { setups: page(1, SECTION_PAGE) } });
  await store.dispatch(fetchSetupSection({ assetId: 1, interval: '1h', section: 'won' }));
  expect(api.getHarmonicSetups).toHaveBeenLastCalledWith({ asset_id: 1, interval: '1h', section: 'won', limit: SECTION_PAGE, offset: 0 });
  expect(store.getState().setups.sections.lists.won.hasMore).toBe(true);

  // "show more" appends and drops duplicates; a short page means the end
  api.getHarmonicSetups.mockResolvedValueOnce({ data: { setups: page(SECTION_PAGE, 10) } });
  await store.dispatch(fetchSetupSection({ assetId: 1, interval: '1h', section: 'won', offset: SECTION_PAGE }));
  const won = store.getState().setups.sections.lists.won;
  expect(won.items).toHaveLength(SECTION_PAGE + 9);
  expect(won.hasMore).toBe(false);
});

test('a section answer for another asset/interval is ignored', async () => {
  const store = makeStore();
  let resolveOld;
  api.getHarmonicSetups.mockReturnValueOnce(new Promise((r) => { resolveOld = r; }));
  const old = store.dispatch(fetchSetupSection({ assetId: 1, interval: '1h', section: 'lost' }));
  api.getSetupSections.mockResolvedValueOnce({ data: { sections: {}, by_status: {} } });
  await store.dispatch(fetchSetupSectionCounts({ assetId: 2, interval: '4h' }));
  resolveOld({ data: { setups: [{ id: 1 }] } });
  await old;
  expect(store.getState().setups.sections.key).toBe('2:4h');
  expect(store.getState().setups.sections.lists.lost.items).toEqual([]);
});

test('junk section toggle is remembered', () => {
  const store = makeStore();
  store.dispatch(setShowJunk(true));
  expect(store.getState().setups.showJunk).toBe(true);
  expect(localStorage.getItem('setups.showJunk')).toBe('true');
});
