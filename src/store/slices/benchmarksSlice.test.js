import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import benchmarksReducer, { fetchVariantReport, fetchVariantReports, runVariantBenchmark } from './benchmarksSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { getVariantReports: jest.fn(), getVariantReport: jest.fn(), runVariantBenchmark: jest.fn() },
}));

const makeStore = () => configureStore({ reducer: { benchmarks: benchmarksReducer } });

beforeEach(() => jest.resetAllMocks());

test('latest report loads; a 404 means there is no report yet', async () => {
  const store = makeStore();
  api.getVariantReport.mockResolvedValueOnce({ data: { report_id: 3, complete: true, variants: [] } });
  await store.dispatch(fetchVariantReport(null));
  expect(api.getVariantReport).toHaveBeenCalledWith(null);
  expect(store.getState().benchmarks.report.data.report_id).toBe(3);

  api.getVariantReport.mockRejectedValueOnce({ response: { status: 404, data: { detail: 'No report' } } });
  await store.dispatch(fetchVariantReport(null));
  expect(store.getState().benchmarks.report.data).toBeNull();
  expect(store.getState().benchmarks.report.error).toBeNull();
});

test('a slow answer for a report the user switched away from is dropped', async () => {
  const store = makeStore();
  let resolveOld;
  api.getVariantReport.mockReturnValueOnce(new Promise((r) => { resolveOld = r; }));
  const old = store.dispatch(fetchVariantReport(1));
  api.getVariantReport.mockResolvedValueOnce({ data: { report_id: 2 } });
  await store.dispatch(fetchVariantReport(2));
  resolveOld({ data: { report_id: 1 } });
  await old;
  expect(store.getState().benchmarks.report.data.report_id).toBe(2);
});

test('reports list and run errors', async () => {
  const store = makeStore();
  api.getVariantReports.mockResolvedValueOnce({ data: { reports: [{ id: 1 }, { id: 2 }] } });
  await store.dispatch(fetchVariantReports());
  expect(store.getState().benchmarks.reports.list).toHaveLength(2);

  api.runVariantBenchmark.mockResolvedValueOnce({ data: { report_id: 9, cutoff_ms: 1, pairs: 40 } });
  await store.dispatch(runVariantBenchmark(5000));
  expect(api.runVariantBenchmark).toHaveBeenCalledWith(5000);
  expect(store.getState().benchmarks.run.status).toBe('started');

  api.runVariantBenchmark.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Admin only' } } });
  await store.dispatch(runVariantBenchmark(5000));
  expect(store.getState().benchmarks.run).toEqual({ status: 'failed', error: 'Admin only' });
});
