import { configureStore } from '@reduxjs/toolkit';
import api from '../../services/api';
import tradingReducer, {
  fetchRiskFields, fetchTradingAccounts, createTradingAccount, setAccountKillSwitch, updateTradingAccount,
} from './tradingSlice';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    getRiskFields: jest.fn(), getTradingAccounts: jest.fn(), createTradingAccount: jest.fn(),
    updateTradingAccount: jest.fn(), setKillSwitch: jest.fn(),
  },
}));

const makeStore = () => configureStore({ reducer: { trading: tradingReducer } });
beforeEach(() => jest.resetAllMocks());

test('risk fields, presets and defaults are loaded', async () => {
  const store = makeStore();
  api.getRiskFields.mockResolvedValueOnce({ data: {
    fields: [{ key: 'risk_per_trade_pct', min: 0.05, max: 5, step: 0.05 }],
    presets: [{ key: 'balanced', settings: { risk_per_trade_pct: 0.5 } }],
    defaults: { risk_per_trade_pct: 0.5 }, exchanges: ['paper'], entry_modes: ['touch'],
  } });
  await store.dispatch(fetchRiskFields());
  const { meta } = store.getState().trading;
  expect(meta.fields).toHaveLength(1);
  expect(meta.presets[0].key).toBe('balanced');
  expect(meta.entryModes).toEqual(['touch']);
});

test('create adds the account; 409 keeps the API message', async () => {
  const store = makeStore();
  api.getTradingAccounts.mockResolvedValueOnce({ data: { accounts: [{ id: 1, name: 'A' }] } });
  await store.dispatch(fetchTradingAccounts());
  api.createTradingAccount.mockResolvedValueOnce({ data: { id: 2, name: 'B' } });
  await store.dispatch(createTradingAccount({ name: 'B' }));
  expect(store.getState().trading.accounts.list.map((a) => a.id)).toEqual([1, 2]);
  expect(store.getState().trading.save.status).toBe('saved');

  api.createTradingAccount.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'nie udało się utworzyć konta: nazwa zajęta' } } });
  await store.dispatch(createTradingAccount({ name: 'B' }));
  expect(store.getState().trading.save).toEqual({ status: 'failed', error: 'nie udało się utworzyć konta: nazwa zajęta' });
});

test('kill switch and updates replace the account in the list', async () => {
  const store = makeStore();
  api.getTradingAccounts.mockResolvedValueOnce({ data: { accounts: [{ id: 1, kill_switch: false, enabled: true }] } });
  await store.dispatch(fetchTradingAccounts());
  api.setKillSwitch.mockResolvedValueOnce({ data: { id: 1, kill_switch: true, kill_reason: 'test', enabled: true } });
  await store.dispatch(setAccountKillSwitch({ accountId: 1, on: true, reason: 'test' }));
  expect(api.setKillSwitch).toHaveBeenCalledWith(1, true, 'test');
  expect(store.getState().trading.accounts.list[0]).toMatchObject({ kill_switch: true, kill_reason: 'test' });

  api.updateTradingAccount.mockResolvedValueOnce({ data: { id: 1, kill_switch: true, enabled: false } });
  await store.dispatch(updateTradingAccount({ accountId: 1, body: { enabled: false } }));
  expect(store.getState().trading.accounts.list[0].enabled).toBe(false);
});

test('Polish plurals used in the wizard', () => {
  const { plural } = require('../../components/Trading/tradingFormat');
  expect(plural(1, 'zmiana', 'zmiany', 'zmian')).toBe('1 zmiana');
  expect(plural(3, 'zmiana', 'zmiany', 'zmian')).toBe('3 zmiany');
  expect(plural(5, 'zmiana', 'zmiany', 'zmian')).toBe('5 zmian');
  expect(plural(12, 'zmiana', 'zmiany', 'zmian')).toBe('12 zmian');
  expect(plural(22, 'zmiana', 'zmiany', 'zmian')).toBe('22 zmiany');
});
