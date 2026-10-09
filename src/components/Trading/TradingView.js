import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAdmin } from '../../store/slices/authSlice';
import { fetchRiskFields, fetchTradingAccounts } from '../../store/slices/tradingSlice';
import AccountsList from './AccountsList';
import AccountWizard from './AccountWizard';
import AccountView from './AccountView';
import '../Stats/StatsView.css';
import '../Stats/StrengthModelView.css';
import './Trading.css';

/**
 * Paper trading on setup signals: accounts list -> account (equity, positions, signals, orders,
 * journal, signal trace) and the new-account wizard (admin).
 */
const TradingView = () => {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const { accounts } = useSelector((state) => state.trading);
  const [view, setView] = useState({ name: 'list' }); // list | wizard | account(id)

  useEffect(() => {
    dispatch(fetchRiskFields());
    dispatch(fetchTradingAccounts());
  }, [dispatch]);

  const backToList = () => {
    dispatch(fetchTradingAccounts());
    setView({ name: 'list' });
  };

  return (
    <div className="stats-view trading-view">
      {view.name === 'list' && (
        <>
          <header className="stats-header sm-header">
            <div>
              <h2 className="stats-title">Trading</h2>
              <p className="stats-subtitle">
                Konta paper handlują same na sygnałach setupów śledzonych assetów: wejście limitem na bliższej krawędzi PRZ,
                SL/TP z reguł wykresu, wielkość pozycji z ustawień ryzyka. Wypełnienia liczone na prawdziwych świecach.
              </p>
            </div>
            {isAdmin && (
              <div className="sm-actions">
                <button className="btn-small primary" onClick={() => setView({ name: 'wizard' })}>+ Nowe konto</button>
              </div>
            )}
          </header>
          {accounts.error && <div className="stats-error">{accounts.error}</div>}
          {accounts.list.length === 0 && !accounts.loading ? (
            <div className="stats-empty sm-card">
              Nie ma jeszcze kont.{isAdmin ? ' Utwórz pierwsze przyciskiem „Nowe konto” - kreator pokaże skutki ustawień ryzyka na historii.' : ''}
            </div>
          ) : (
            <AccountsList accounts={accounts.list} onOpen={(id) => setView({ name: 'account', id })} />
          )}
        </>
      )}

      {view.name === 'wizard' && (
        <AccountWizard onCancel={backToList} onCreated={(id) => setView({ name: 'account', id })} />
      )}

      {view.name === 'account' && <AccountView accountId={view.id} onBack={backToList} />}
    </div>
  );
};

export default TradingView;
