import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import chartReducer, { focusChartAt, clearChartFocus } from './chartSlice';
import alertsReducer, {
  fetchTrackedAssets,
  saveTrackedAsset,
  removeTrackedAsset,
  saveAlertSettings,
  sendTestAlert,
  fetchAlertEvents,
  dismissBackfillNotice,
} from './alertsSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    getTrackedAssets: jest.fn(),
    putTrackedAsset: jest.fn(),
    deleteTrackedAsset: jest.fn(),
    putAlertSettings: jest.fn(),
    sendTestAlert: jest.fn(),
    getAlertEvents: jest.fn(),
  },
}));

const makeStore = () => configureStore({
  reducer: { alerts: alertsReducer, chart: chartReducer },
  middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
});

const row = (id, intervals = ['1h']) => ({ asset_id: id, asset: `A${id}`, quote: 'USDT', patterns_sync: true, setup_intervals: intervals });

beforeEach(() => jest.resetAllMocks());

test('saving a tracked asset updates the row and remembers which backfills started', async () => {
  const store = makeStore();
  api.getTrackedAssets.mockResolvedValueOnce({ data: { tracked: [row(1)] } });
  await store.dispatch(fetchTrackedAssets());

  api.putTrackedAsset.mockResolvedValueOnce({ data: {
    tracked: row(1, ['1h', '4h']),
    backfill_tasks: [{ asset_id: 1, interval: '4h', task_id: 't1' }],
  } });
  await store.dispatch(saveTrackedAsset({ assetId: 1, patternsSync: true, setupIntervals: ['1h', '4h'] }));
  expect(api.putTrackedAsset).toHaveBeenCalledWith(1, { patternsSync: true, setupIntervals: ['1h', '4h'], backfillCandles: undefined });

  const { tracked } = store.getState().alerts;
  expect(tracked.list[0].setup_intervals).toEqual(['1h', '4h']);
  expect(tracked.backfill[1]).toEqual(['4h']);
  expect(tracked.saving[1]).toBeUndefined();
  store.dispatch(dismissBackfillNotice(1));
  expect(store.getState().alerts.tracked.backfill[1]).toBeUndefined();
});

test('adding a new asset appends it; a 422 is kept as the row error', async () => {
  const store = makeStore();
  api.putTrackedAsset.mockResolvedValueOnce({ data: { tracked: row(7), backfill_tasks: [] } });
  await store.dispatch(saveTrackedAsset({ assetId: 7, patternsSync: true, setupIntervals: ['1h'], backfillCandles: 5000 }));
  expect(store.getState().alerts.tracked.list.map((t) => t.asset_id)).toEqual([7]);

  api.putTrackedAsset.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Unknown interval: 2h' } } });
  await store.dispatch(saveTrackedAsset({ assetId: 7, patternsSync: true, setupIntervals: ['2h'] }));
  expect(store.getState().alerts.tracked.rowErrors[7]).toBe('Unknown interval: 2h');
});

test('removing drops the row', async () => {
  const store = makeStore();
  api.getTrackedAssets.mockResolvedValueOnce({ data: { tracked: [row(1), row(2)] } });
  await store.dispatch(fetchTrackedAssets());
  api.deleteTrackedAsset.mockResolvedValueOnce({ data: { deleted: true } });
  await store.dispatch(removeTrackedAsset(1));
  expect(store.getState().alerts.tracked.list.map((t) => t.asset_id)).toEqual([2]);
});

test('alert settings save and show the 422 detail', async () => {
  const store = makeStore();
  api.putAlertSettings.mockResolvedValueOnce({ data: { email: 'a@b.c', email_enabled: true, statuses: ['win'] } });
  await store.dispatch(saveAlertSettings({ email: 'a@b.c', email_enabled: true, statuses: ['win'], asset_ids: null, intervals: null }));
  expect(store.getState().alerts.settings.data.email).toBe('a@b.c');
  expect(store.getState().alerts.settings.savedAt).not.toBeNull();

  api.putAlertSettings.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'email_enabled requires an e-mail address' } } });
  await store.dispatch(saveAlertSettings({ email: null, email_enabled: true, statuses: [] }));
  expect(store.getState().alerts.settings.error).toBe('email_enabled requires an e-mail address');
});

test('test e-mail: success, and status codes explained when there is no detail', async () => {
  const store = makeStore();
  api.sendTestAlert.mockResolvedValueOnce({ data: { sent_to: 'a@b.c' } });
  await store.dispatch(sendTestAlert());
  expect(store.getState().alerts.test).toEqual({ status: 'sent', message: 'a@b.c' });

  api.sendTestAlert.mockRejectedValueOnce({ response: { status: 503, data: {} } });
  await store.dispatch(sendTestAlert());
  expect(store.getState().alerts.test.status).toBe('failed');
  expect(store.getState().alerts.test.message).toMatch(/SMTP/);

  api.sendTestAlert.mockRejectedValueOnce({ response: { status: 502, data: { detail: 'Connection refused' } } });
  await store.dispatch(sendTestAlert());
  expect(store.getState().alerts.test.message).toBe('Connection refused');
});

test('events are requested with the filters', async () => {
  const store = makeStore();
  api.getAlertEvents.mockResolvedValueOnce({ data: { events: [{ id: 1 }] } });
  await store.dispatch(fetchAlertEvents({ assetId: '3', interval: '4h' }));
  expect(api.getAlertEvents).toHaveBeenCalledWith({ limit: 100, asset_id: '3', interval: '4h' });
  expect(store.getState().alerts.events.list).toHaveLength(1);
});

test('chart focus target is stored and cleared', () => {
  const store = makeStore();
  store.dispatch(focusChartAt({ time: 123, assetId: 1, interval: '1h' }));
  expect(store.getState().chart.focusTime).toEqual({ time: 123, assetId: 1, interval: '1h' });
  store.dispatch(clearChartFocus());
  expect(store.getState().chart.focusTime).toBeNull();
});
