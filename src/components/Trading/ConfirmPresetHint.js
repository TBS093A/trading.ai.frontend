import React from 'react';

const SUGGESTED = 'confirm_strong';

/**
 * Entry mode "confirm" works best with the confirm_strong risk preset - suggest it, never apply it
 * on its own. Hidden when the risk settings already match the preset.
 */
const ConfirmPresetHint = ({ entryMode, presets, risk, onApply }) => {
  const preset = presets.find((p) => p.key === SUGGESTED);
  if (entryMode !== 'confirm' || !preset) return null;
  const matches = risk && Object.entries(preset.settings).every(([k, v]) => risk[k] === v);
  if (matches) return null;
  return (
    <div className="notice-block hint-block">
      <span>
        Do wejścia z potwierdzeniem pasuje wariant ryzyka <strong>„{preset.label}”</strong>
        {preset.description ? ` - ${preset.description}` : ''}
      </span>
      {onApply && <button type="button" className="btn-small" onClick={() => onApply(preset)}>Użyj tego wariantu</button>}
    </div>
  );
};

export default ConfirmPresetHint;
