import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import strengthReducer, {
  fetchStrengthModels, fetchStrengthHistory, fetchStrengthData, fitStrengthModel, dismissFit,
} from './strengthSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { getStrengthModel: jest.fn(), getStrengthHistory: jest.fn(), getStrengthData: jest.fn(), fitStrengthModel: jest.fn() },
}));

const makeStore = () => configureStore({ reducer: { strength: strengthReducer } });

beforeEach(() => jest.resetAllMocks());

test('loads both models, per-kind history and weekly data', async () => {
  const store = makeStore();
  api.getStrengthModel.mockResolvedValueOnce({ data: { model: { trained_at: 't1' }, pre_model: null } });
  api.getStrengthHistory.mockResolvedValueOnce({ data: { runs: [{ id: 1 }] } });
  api.getStrengthData.mockResolvedValueOnce({ data: { weeks: [{ week: '2026-10-05', trades: 3 }], totals: { win: 1 } } });
  await store.dispatch(fetchStrengthModels());
  await store.dispatch(fetchStrengthHistory({ kind: 'pre' }));
  await store.dispatch(fetchStrengthData());
  const st = store.getState().strength;
  expect(st.models.entry.trained_at).toBe('t1');
  expect(st.models.pre).toBeNull();
  expect(api.getStrengthHistory).toHaveBeenCalledWith('pre', 50);
  expect(st.history.pre.runs).toHaveLength(1);
  expect(st.history.entry.runs).toHaveLength(0);
  expect(st.data.weeks[0].trades).toBe(3);
});

test('fit: started with task id, failure keeps the API detail', async () => {
  const store = makeStore();
  api.fitStrengthModel.mockResolvedValueOnce({ data: { task_id: 'abc' } });
  await store.dispatch(fitStrengthModel());
  expect(store.getState().strength.fit).toMatchObject({ status: 'started', taskId: 'abc' });
  store.dispatch(dismissFit());
  expect(store.getState().strength.fit.status).toBe('idle');

  api.fitStrengthModel.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Admin only' } } });
  await store.dispatch(fitStrengthModel());
  expect(store.getState().strength.fit).toMatchObject({ status: 'failed', error: 'Admin only' });
});
