import api from '../services/api';
import { setMainView } from '../store/slices/uiSlice';
import { setSelectedAsset } from '../store/slices/assetsSlice';
import { setInterval as setChartInterval, focusChartAt } from '../store/slices/chartSlice';
import { clearAnalysis } from '../store/slices/analysisSlice';
import { setShowSetupsOnChart, setHighlightQuery } from '../store/slices/setupsSlice';

/**
 * Links from alert e-mails, e.g.
 *   /?view=chart&asset_id=5&interval=4h&t=1700000000000&pattern=bat&x=1699000000000&c=1699500000000
 * Missing or malformed parameters are ignored.
 */

const positiveInt = (v) => {
  if (v == null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
};

export const DEEP_LINK_PARAMS = ['view', 'asset_id', 'interval', 't', 'pattern', 'x', 'c'];

export const parseDeepLink = (search, availableIntervals = null) => {
  const q = new URLSearchParams(search || '');
  if (!DEEP_LINK_PARAMS.some((p) => q.has(p))) return null;
  const interval = q.get('interval');
  const link = {
    view: q.get('view') === 'chart' ? 'chart' : null,
    assetId: positiveInt(q.get('asset_id')),
    interval: interval && (!availableIntervals || availableIntervals.includes(interval)) ? interval : null,
    t: positiveInt(q.get('t')),
    pattern: q.get('pattern') || null,
    x: positiveInt(q.get('x')),
    c: positiveInt(q.get('c')),
  };
  return Object.values(link).some((v) => v != null) ? link : null;
};

// Drop the link parameters from the address bar, keeping anything else
export const clearDeepLinkFromUrl = () => {
  try {
    const url = new URL(window.location.href);
    DEEP_LINK_PARAMS.forEach((p) => url.searchParams.delete(p));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Old browser / sandbox - leaving the parameters is harmless
  }
};

// Open the chart the link points at: asset, interval, setups overlay, centered on t, setup pinned
export const applyDeepLink = async (link, dispatch, getState) => {
  if (!link) return;
  if (link.view === 'chart' || link.assetId) dispatch(setMainView('chart'));

  if (link.assetId) {
    let asset = { id: link.assetId };
    try {
      const { data } = await api.getAssetById(link.assetId);
      if (data?.id) asset = data;
    } catch {
      // Unknown asset name - the chart still loads by id
    }
    dispatch(setSelectedAsset(asset));
    dispatch(clearAnalysis());
  }
  if (link.interval) dispatch(setChartInterval(link.interval));

  const assetId = link.assetId ?? getState().assets.selectedAsset?.id;
  const interval = link.interval ?? getState().chart.interval;
  if (!assetId) return;

  dispatch(setShowSetupsOnChart(true));
  if (link.t) dispatch(focusChartAt({ time: link.t, assetId, interval }));
  if (link.pattern || link.x || link.c) {
    dispatch(setHighlightQuery({ pattern: link.pattern, x: link.x, c: link.c }));
  }
};
