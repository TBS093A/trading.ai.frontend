import React, { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * Pattern strength from the backend model:
 * strength = null | { score 0-100 (percentile), p_win 0-1, factors [{feature, label, impact}], model_trained_at }
 */

const hasScore = (strength) => strength != null && typeof strength.score === 'number';

// Green tint whose alpha follows the score; text stays readable even at 100
export const strengthTint = (strength) => {
  if (!hasScore(strength)) return null;
  const score = Math.max(0, Math.min(100, strength.score));
  return `rgba(0, 255, 136, ${(0.04 + 0.30 * (score / 100)).toFixed(3)})`;
};

// Strongest first; patterns without a score go last; ties fall back to newest D
export const compareByStrength = (a, b, dTime) => {
  const sa = hasScore(a.strength) ? a.strength.score : -1;
  const sb = hasScore(b.strength) ? b.strength.score : -1;
  if (sb !== sa) return sb - sa;
  return dTime(b) - dTime(a);
};

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export const StrengthBadge = ({ strength }) => {
  if (!hasScore(strength)) {
    return <span className="pattern-strength-badge none" title="Strength not available yet">–</span>;
  }
  return (
    <span
      className="pattern-strength-badge"
      style={{ '--strength-tint': strengthTint(strength) }}
      title={`Siła formacji: ${Math.round(strength.score)}/100 · szansa TP1 przed SL ${pct(strength.p_win)}`}
    >
      {Math.round(strength.score)}
    </span>
  );
};

// The model description is the same for every pattern - fetch it once per page load.
// Response: { model, pre_model } (older backends: { model } only)
let modelPromise = null;
const loadModels = () => {
  if (!modelPromise) {
    modelPromise = api.getStrengthModel()
      .then(({ data }) => ({ model: data.model || null, preModel: data.pre_model || null }))
      .catch(() => {
        modelPromise = null; // try again next time
        return null;
      });
  }
  return modelPromise;
};

const ModelMetrics = ({ title, model }) => {
  if (!model) return null;
  const m = model.metrics || {};
  return (
    <div className="strength-model-block">
      <p className="strength-model-title">{title}</p>
      <p className="strength-muted">
        Model z {model.trained_at ? new Date(model.trained_at).toLocaleDateString() : '?'}
        {m.samples != null && ` · ${m.samples} próbek`}
        {` · AUC (test) ${m.auc_test != null ? Number(m.auc_test).toFixed(2) : '–'}`}
        {m.base_win_rate_test != null && ` · bazowy win rate ${pct(m.base_win_rate_test)}`}
      </p>
      {Array.isArray(m.quintiles_test) && m.quintiles_test.length > 0 && (
        <table className="strength-quintiles">
          <thead>
            <tr><th>Kwintyl siły</th><th>n</th><th>Win rate</th><th>Avg R</th></tr>
          </thead>
          <tbody>
            {m.quintiles_test.map((q) => (
              <tr key={q.quintile}>
                <td>Q{q.quintile}</td>
                <td>{q.n}</td>
                <td>{pct(q.win_rate)}</td>
                <td className={q.avg_r > 0 ? 'pos' : q.avg_r < 0 ? 'neg' : ''}>
                  {q.avg_r == null ? '—' : `${q.avg_r > 0 ? '+' : ''}${Number(q.avg_r).toFixed(2)}R`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ModelInfo = () => {
  const [models, setModels] = useState(undefined); // undefined = loading
  useEffect(() => {
    let alive = true;
    loadModels().then((m) => { if (alive) setModels(m); });
    return () => { alive = false; };
  }, []);

  if (models === undefined) return <p className="strength-muted">Ładowanie opisu modelu…</p>;
  if (!models || (!models.model && !models.preModel)) {
    return <p className="strength-muted">Opis modelu jest niedostępny.</p>;
  }

  return (
    <div className="strength-model">
      <p>
        Score to percentyl przewidywanej szansy, że cena dojdzie do TP1 przed SL, liczony modelem
        nauczonym na historii setupów (100 = najsilniejsza, 50 = mediana).
        Siła <em>wstępna</em> jest liczona, zanim cena dojdzie do PRZ - tylko z konfluencji poziomowych;
        siła pełna - od wejścia.
      </p>
      <ModelMetrics title="Siła pełna (od wejścia)" model={models.model} />
      <ModelMetrics title="Siła wstępna (przed PRZ)" model={models.preModel} />
    </div>
  );
};

export const StrengthSection = ({ strength }) => {
  const [showModel, setShowModel] = useState(false);

  return (
    <div className="details-section strength-section">
      <div className="details-title">Siła formacji</div>
      {!hasScore(strength) ? (
        <p className="strength-muted">
          Brak oceny - model nie jest jeszcze nauczony albo dla tej formacji nie da się policzyć cech.
        </p>
      ) : (
        <>
          <div className="strength-summary">
            <span className="strength-score" style={{ '--strength-tint': strengthTint(strength) }}>
              {Math.round(strength.score)}<span className="strength-of">/100</span>
            </span>
            <span className="strength-pwin" title="Przewidywana szansa, że cena dojdzie do TP1 przed SL">
              szansa TP1 przed SL: <strong>{pct(strength.p_win)}</strong>
            </span>
          </div>
          {Array.isArray(strength.factors) && strength.factors.length > 0 && (
            <ul className="strength-factors">
              {strength.factors.map((f) => (
                <li key={f.feature} className={f.impact > 0 ? 'pos' : f.impact < 0 ? 'neg' : ''}>
                  <span className="strength-impact">{f.impact > 0 ? '+' : f.impact < 0 ? '−' : '·'}</span>
                  {f.label || f.feature}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button type="button" className="strength-model-toggle" onClick={() => setShowModel(!showModel)}>
        {showModel ? '▾' : '▸'} Jak liczona jest siła
      </button>
      {showModel && <ModelInfo />}
    </div>
  );
};
