import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  fetchSetupSection,
  highlightSetup,
  setShowSetupsOnChart,
} from '../../store/slices/setupsSlice';
import { atr, distanceToPrz, currentR, formatR } from '../../utils/setupMath';
import { strengthTint, StrengthBadge, StrengthSection } from './PatternStrength';
import { SetupBadge } from './PatternSetup';
import ConfluenceCategories from './ConfluenceCategories';

const SECTIONS = [
  { key: 'active', title: 'Aktywne', hint: 'Czekają na PRZ albo mają otwartą pozycję' },
  { key: 'won', title: 'Wygrane', hint: 'Doszły do TP1' },
  { key: 'lost', title: 'Przegrane', hint: 'Doszły do SL' },
  { key: 'junk', title: 'Śmieciowe', hint: 'Expired, no entry i invalidated' },
];
const OPEN_KEY = 'setups.sectionsOpen';
const DEFAULT_OPEN = { active: true, won: false, lost: false, junk: false };

const loadOpen = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(OPEN_KEY));
    return stored && typeof stored === 'object' ? { ...DEFAULT_OPEN, ...stored } : DEFAULT_OPEN;
  } catch {
    return DEFAULT_OPEN;
  }
};

const fmtPrice = (v) => (v == null ? '—' : Number(v).toPrecision(6));
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtSigned = (v, digits, suffix) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}${suffix}`);

// Strongest first, unscored last, then most recently created (active section)
const byStrength = (a, b) => {
  const sa = a.strength?.score ?? -1;
  const sb = b.strength?.score ?? -1;
  return sb !== sa ? sb - sa : (b.created_time || 0) - (a.created_time || 0);
};

const SetupDetails = ({ setup, price, atrValue }) => {
  const [collapsedCats, setCollapsedCats] = useState({});
  const pts = setup.points_json || {};
  const isOpen = setup.status === 'open';
  const isWaiting = setup.status === 'waiting';
  const dist = isWaiting ? distanceToPrz(setup, price, atrValue) : null;
  const liveR = isOpen ? currentR(setup, price) : null;
  // Entry confluences once the trade is on; level-only ones (known before entry) while waiting
  const conf = setup.confluences_json || (isWaiting ? setup.pre_confluences_json : null);
  const preOnly = !setup.confluences_json && !!setup.pre_confluences_json;

  return (
    <div className="pattern-details">
      <div className="details-section">
        <div className="details-title">Przebieg</div>
        <dl className="setup-section-grid">
          <dt>Utworzony</dt><dd>{fmtTime(setup.created_time)}</dd>
          <dt>Wejście</dt>
          <dd>{setup.entry_time ? `${fmtTime(setup.entry_time)} @ ${fmtPrice(setup.entry_price)}` : (isWaiting ? 'czeka na PRZ' : '—')}</dd>
          <dt>Wyjście</dt>
          <dd>{setup.exit_time ? fmtTime(setup.exit_time) : (isOpen ? 'pozycja otwarta' : '—')}</dd>
          {dist && (
            <>
              <dt>Do PRZ</dt>
              <dd>{fmtSigned(dist.pct, 2, '%')}{dist.atr != null && ` · ${fmtSigned(dist.atr, 1, ' ATR')}`}</dd>
            </>
          )}
        </dl>
      </div>

      {(setup.r_multiple != null || liveR != null || setup.mfe_r != null) && (
        <div className="details-section">
          <div className="details-title">Wynik</div>
          <dl className="setup-section-grid">
            {setup.r_multiple != null && (
              <><dt>Wynik</dt><dd className={setup.r_multiple > 0 ? 'pos' : setup.r_multiple < 0 ? 'neg' : ''}>{formatR(setup.r_multiple, 2)}</dd></>
            )}
            {liveR != null && (
              <><dt>Teraz</dt><dd className={liveR > 0 ? 'pos' : liveR < 0 ? 'neg' : ''}>{formatR(liveR, 2)}</dd></>
            )}
            {(setup.mfe_r != null || setup.mae_r != null) && (
              <><dt>MFE / MAE</dt><dd>{formatR(setup.mfe_r, 2) || '—'} / {formatR(setup.mae_r, 2) || '—'}</dd></>
            )}
          </dl>
        </div>
      )}

      <div className="details-section">
        <div className="details-title">Poziomy</div>
        <div className="points-row">
          {['X', 'A', 'B', 'C'].filter((n) => pts[n]).map((n) => (
            <div key={n} className="point-mini">
              <span className="point-label">{n}</span>
              <span className="point-value">{fmtPrice(pts[n].price)}</span>
            </div>
          ))}
        </div>
        <dl className="setup-section-grid levels">
          <dt>PRZ</dt><dd>{fmtPrice(setup.prz_min)} – {fmtPrice(setup.prz_max)}</dd>
          {setup.entry_price != null && (<><dt>Wejście</dt><dd>{fmtPrice(setup.entry_price)}</dd></>)}
          {setup.sl != null && (<><dt className="neg">SL</dt><dd className="neg">{fmtPrice(setup.sl)}</dd></>)}
          {setup.tp1 != null && (<><dt className="pos">TP1</dt><dd className="pos">{fmtPrice(setup.tp1)}</dd></>)}
          {setup.tp2 != null && (<><dt className="pos">TP2</dt><dd className="pos">{fmtPrice(setup.tp2)}{setup.tp2_reached ? ' ✓' : ''}</dd></>)}
        </dl>
      </div>

      {conf ? (
        <ConfluenceCategories
          confluences={conf}
          isBullish={setup.is_bullish}
          collapsed={collapsedCats}
          onToggle={(e, cat) => {
            e.stopPropagation();
            setCollapsedCats((prev) => ({ ...prev, [cat]: prev[cat] === false }));
          }}
          title={preOnly ? 'Konfluencje' : 'Konfluencje (przy wejściu)'}
          note={preOnly ? 'poziomowe, przed wejściem' : null}
        />
      ) : (
        <div className="details-section">
          <div className="details-title">Konfluencje</div>
          <p className="strength-muted">Brak danych o konfluencjach.</p>
        </div>
      )}

      <StrengthSection strength={setup.strength} title="Siła" />

      <div className="details-section strategy-section">
        <div className="details-title">Strategia</div>
        <div className="strategy-row">
          <div className="strategy-item" title="Peak spacing used to detect the structure">
            <span className="strategy-label">Peak Spacing</span>
            <span className="strategy-value">{setup.spacing != null ? `${setup.spacing} candles` : 'N/A'}</span>
          </div>
          <div className="strategy-item" title="Where SL/TP come from: chart rules (app) or the fallback">
            <span className="strategy-label">Targets</span>
            <span className="strategy-value">{setup.targets_source || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SetupItem = ({ setup, expanded, onToggle, onOpen, pinned, price, atrValue }) => {
  const tint = strengthTint(setup.strength);
  const isOpen = setup.status === 'open';
  const isWaiting = setup.status === 'waiting';
  const liveR = isOpen ? currentR(setup, price) : null;
  const dist = isWaiting ? distanceToPrz(setup, price, atrValue) : null;
  const when = setup.exit_time || setup.entry_time || setup.created_time;

  return (
    <div
      className={`pattern-item setup-item ${expanded ? 'expanded' : ''} ${pinned ? 'selected' : ''} ${tint ? 'has-strength' : ''}`}
      style={tint ? { '--strength-tint': tint } : undefined}
    >
      <div className="pattern-header">
        <button className="pattern-header-main" onClick={onOpen} title="Pokaż na wykresie">
          <div className="pattern-main">
            <span className={`pattern-direction ${setup.is_bullish ? 'bullish' : 'bearish'}`}>
              {setup.is_bullish ? '▲' : '▼'}
            </span>
            <span className="pattern-name-block">
              <span className="pattern-name">{setup.pattern_type}</span>
              <SetupBadge setup={setup} />
            </span>
          </div>
          {liveR != null && <span className={`setup-live ${liveR > 0 ? 'pos' : liveR < 0 ? 'neg' : ''}`}>{formatR(liveR, 2)}</span>}
          {dist && <span className="setup-live" title="Odległość do bliższej krawędzi PRZ">{fmtSigned(dist.pct, 1, '%')}</span>}
          <StrengthBadge strength={setup.strength} />
          <span className="pattern-date">{fmtTime(when)}</span>
        </button>
        <button className={`expand-btn ${expanded ? 'expanded' : ''}`} onClick={onToggle} title={expanded ? 'Collapse' : 'Expand'}>
          <span className="expand-icon">▾</span>
        </button>
      </div>
      {expanded && <SetupDetails setup={setup} price={price} atrValue={atrValue} />}
    </div>
  );
};

/**
 * Tracked setups for the asset/interval on the chart, in sections:
 * Active / Won / Lost always, Junk (expired, no entry, invalidated) when enabled in the panel settings.
 */
const SetupSections = ({ onCenter }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const active = useSelector((state) => state.setups.active);
  const sections = useSelector((state) => state.setups.sections);
  const showJunk = useSelector((state) => state.setups.showJunk);
  const highlightedId = useSelector((state) => state.setups.highlightedId);
  const klines = useSelector((state) => state.chart.klines);
  const datasetId = useSelector((state) => state.chart.datasetId);

  const [open, setOpen] = useState(loadOpen);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(open)); } catch { /* not remembered */ }
  }, [open]);

  const price = klines.length ? klines[klines.length - 1].close : null;
  const atrValue = useMemo(() => atr(klines.slice(-200)), [klines]);
  const activeSorted = useMemo(() => [...active.list].sort(byStrength), [active.list]);

  // Load a closed section when it is open and not loaded for this asset/interval yet
  useEffect(() => {
    const { chart: chartState, assets } = store.getState();
    const asset = assets.selectedAsset;
    if (!asset || datasetId === 0) return;
    ['won', 'lost', ...(showJunk ? ['junk'] : [])].forEach((section) => {
      const list = sections.lists[section];
      const key = `${asset.id}:${chartState.interval}`;
      if (open[section] && (!list.loaded || sections.key !== key) && !list.loading && !list.error) {
        dispatch(fetchSetupSection({ assetId: asset.id, interval: chartState.interval, section }));
      }
    });
  }, [open, showJunk, sections, datasetId, dispatch, store]);

  const loadMore = (section) => {
    const { chart: chartState, assets } = store.getState();
    if (!assets.selectedAsset) return;
    dispatch(fetchSetupSection({
      assetId: assets.selectedAsset.id,
      interval: chartState.interval,
      section,
      offset: sections.lists[section].items.length,
    }));
  };

  const retry = (section) => {
    const { chart: chartState, assets } = store.getState();
    if (!assets.selectedAsset) return;
    dispatch(fetchSetupSection({ assetId: assets.selectedAsset.id, interval: chartState.interval, section }));
  };

  const openOnChart = (s) => {
    dispatch(setShowSetupsOnChart(true));
    dispatch(highlightSetup(s.id));
    onCenter?.({ x_point_timestamp: s.x_time, d_point_timestamp: s.exit_time || s.entry_time || s.c_time });
  };

  const totalCount = Object.values(sections.counts).reduce((a, b) => a + b, 0) + (sections.key ? 0 : active.list.length);
  if (totalCount === 0 && active.list.length === 0 && !active.loading) return null;

  return (
    <section className="setup-sections">
      {SECTIONS.filter((sec) => sec.key !== 'junk' || showJunk).map((sec) => {
        const isActive = sec.key === 'active';
        const list = isActive
          ? { items: activeSorted, loading: active.loading, error: active.error, hasMore: false }
          : sections.lists[sec.key];
        const count = isActive ? (sections.counts.active ?? active.list.length) : (sections.counts[sec.key] ?? list.items.length);
        const isOpenSection = !!open[sec.key];
        return (
          <div key={sec.key} className={`setup-section-block ${sec.key}`}>
            <button
              type="button"
              className="active-setups-head"
              onClick={() => setOpen((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))}
              title={sec.hint}
              aria-expanded={isOpenSection}
            >
              <span className="active-setups-chevron">{isOpenSection ? '▾' : '▸'}</span>
              <span className="active-setups-title">{sec.title}</span>
              <span className={`active-setups-count ${sec.key}`}>{count}</span>
              {list.loading && <span className="active-setups-muted">⟳</span>}
            </button>

            {isOpenSection && (
              <div className="setup-section-list">
                {list.error && (
                  <div className="active-setups-error">
                    {list.error}
                    {!isActive && <button type="button" className="setup-more" onClick={() => retry(sec.key)}>Ponów</button>}
                  </div>
                )}
                {!list.loading && !list.error && list.items.length === 0 && (
                  <div className="active-setups-muted setup-section-empty">Brak setupów</div>
                )}
                {list.items.map((s) => (
                  <SetupItem
                    key={s.id}
                    setup={s}
                    expanded={expandedId === s.id}
                    onToggle={(e) => { e.stopPropagation(); setExpandedId(expandedId === s.id ? null : s.id); }}
                    onOpen={() => openOnChart(s)}
                    pinned={highlightedId === s.id}
                    price={price}
                    atrValue={atrValue}
                  />
                ))}
                {list.hasMore && (
                  <button type="button" className="setup-more" onClick={() => loadMore(sec.key)} disabled={list.loading}>
                    {list.loading ? 'Ładowanie…' : 'Pokaż więcej'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default SetupSections;
