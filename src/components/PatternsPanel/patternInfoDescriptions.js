/**
 * Hardcoded pattern guides for harmonic families (ABCD / XABCD).
 * Keys are normalized via normalizePatternTypeKey(); add aliases when API uses variants.
 */

const DEFAULT_INFO = {
  displayName: 'Harmonic pattern',
  structure: 'ABCD or XABCD',
  purpose:
    'Harmonic structures map Elliott-style swings into Fibonacci-defined PRZ (Potential Reversal Zones). They encode where institutional-sized reversals or continuations are statistically likely after a symmetry condition is met.',
  prediction:
    'The model does not forecast price path with certainty; it estimates where corrective legs often terminate and where reaction probability rises. Outcomes still depend on higher-timeframe trend, liquidity, and news.',
  usage:
    'Mixed — use analytically to mark zones early; treat as transactional only once D is forming or confirmed with risk defined (stop beyond invalidation, targets from Fib extensions / structure).',
};

/** @type {Record<string, typeof DEFAULT_INFO>} */
export const PATTERN_INFO = {
  gartley: {
    displayName: 'Gartley',
    structure: 'XABCD',
    purpose:
      'The Gartley defines a deep retracement followed by a corrective rally and a final swing into a tight PRZ. It is designed to catch medium-term reversals after a completed M/W structure with strict Fibonacci symmetry.',
    prediction:
      'Anticipates a directional reaction from the PRZ: bullish Gartley expects rejection higher from support zone; bearish Gartley expects rejection lower from resistance. Failure beyond the invalidation level usually implies pattern negation, not a delayed entry.',
    usage:
      'Primarily transactional at point D when alignment with trend and volume confirm; highly analytical beforehand for planning entries, stops, and scaling.',
  },

  bat: {
    displayName: 'Bat',
    structure: 'XABCD',
    purpose:
      'The Bat prioritizes a shallow XAB retracement and a deep point D parked near the 0.886 XA retracement. It spots reversals where price “over-extends” slightly beyond what classical Gartley allows, often at exhaustion wicks.',
    prediction:
      'Expects mean-reversion or trend resumption from a narrow PRZ tied to 0.886 XA and BC extension ratios. Useful when markets fake a breakout then snap back into the Bat box.',
    usage:
      'Strongly transactional at D with clear invalidation; analytically valuable for intraday PRZ boxes on higher timeframes.',
  },

  alternate_bat: {
    displayName: 'Alternate Bat',
    structure: 'XABCD',
    purpose:
      'A variant of the Bat family that tolerates a deeper XA context and different B placement. It targets reversals when price stretches further before D, often in volatile or news-driven tape.',
    prediction:
      'Forecasts exhaustion and reversal from an extended PRZ versus the classic Bat; failure modes include continuation if the XA leg was an impulse continuation rather than correction.',
    usage:
      'Mixed — use analytically to avoid forcing classic Bat rules on distorted swings; transactional once D respects PRZ with spread/volume confirmation.',
  },

  butterfly: {
    displayName: 'Butterfly',
    structure: 'XABCD',
    purpose:
      'The Butterfly seeks an aggressive point D that can exceed X (1.27–1.618 extension territory), signalling climax and blow-off moves. It frames climactic reversals after parabolic stretches.',
    prediction:
      'Predicts potential sharp reversal after an extension beyond X; bullish Butterfly resolves from an epic sell-off; bearish Butterfly from a vertical rally. Invalidation is often beyond the extreme D print.',
    usage:
      'More analytical for context and climax identification; transactional only for experienced size-down entries with wide stops and scaled targets.',
  },

  crab: {
    displayName: 'Crab',
    structure: 'XABCD',
    purpose:
      'The Crab is tuned for extremes: D is allowed to spike to 1.618 XA and beyond, capturing stop-hunts and liquidity grabs before mean reversion. It fits volatile assets and session spikes.',
    prediction:
      'Anticipates violent rejection from an extended PRZ after a liquidity sweep. Works best when point D coincides with equal highs/lows or obvious run-stops.',
    usage:
      'Highly transactional at D for fade strategies; analytically useful for mapping “trap” zones ahead of time.',
  },

  deep_crab: {
    displayName: 'Deep Crab',
    structure: 'XABCD',
    purpose:
      'The Deep Crab pushes D further than the standard Crab—an even more extended harmonic. It targets exhaustion reversals after prolonged overextension and emotional continuation.',
    prediction:
      'Expects snapback or regime shift once the deepest PRZ is filled; failures often mean trend continuation rather than immediate harmonic resolution—use wider invalidation.',
    usage:
      'Primarily analytical until D prints; transactional entries should be smaller size with staged exits because extensions can overshoot.',
  },

  shark: {
    displayName: 'Shark',
    structure: 'XABCD',
    purpose:
      'The Shark (including its BC-based extensions) focuses on stop-hunt reversals using a distinct B/C geometry versus classic Carney patterns. It highlights liquidity engineering before a reversal.',
    prediction:
      'Forecasts a reversal after an aggressive C-D spike that clears nearby liquidity; especially relevant when D pierces prior swing extremes briefly.',
    usage:
      'Transactional at D with tight process: confirmation candle and invalidation beyond the spike; analytical for building watchlists of liquidity voids.',
  },

  deep_shark: {
    displayName: 'Deep Shark',
    structure: 'XABCD',
    purpose:
      'A more stretched Shark variant with deeper D expectations. It tracks capitulation or blow-off sequences where retail shorts/long chasers are forced out.',
    prediction:
      'Anticipates a violent reversal only after the deepest harmonic target prints; false signals increase if volatility remains one-directional.',
    usage:
      'More analytical and context-driven; transactional only with reduced leverage and clear macro bias alignment.',
  },

  cypher: {
    displayName: 'Cypher',
    structure: 'XABCD',
    purpose:
      'The Cypher uses asymmetric leg ratios (notably the BC extension and tight D vs XC) to catch trend-continuation pullbacks that terminate in precise Fib pockets before resuming the trend.',
    prediction:
      'Expects trend resumption after a shallow-to-moderate retracement; differs from many reversals-only harmonics because it leans on corrective termination within a dominant trend.',
    usage:
      'Mixed — analytically powerful for trend pullback entries; transactional with tight stops because failed Cyphers can reprice quickly.',
  },

  five_zero: {
    displayName: '5-0',
    structure: 'XABCD',
    purpose:
      'The 5-0 structure models a retracement and re-entry after an extended B-C move, blending retracement and continuation behaviour. It often appears late in corrective cycles.',
    prediction:
      'Anticipates either a controlled pullback completion or a measured reversal depending on broader trend context; point D marks probability bifurcation.',
    usage:
      'Analytically strong for mapping late-cycle entries; transactional with confirmation from momentum divergence or structure break after D.',
  },

  abcd: {
    displayName: 'ABCD',
    structure: 'ABCD',
    purpose:
      'The classical AB=CD leg symmetry pattern (four points) describes corrective rhythm: BC retraces AB, and CD mirrors AB in length/time. It is the simplest harmonic unit inside many XABCD families.',
    prediction:
      'Predicts completion of a corrective leg at D when CD ≈ AB and BC lies in the expected retracement pocket—often a launching pad for the next impulse.',
    usage:
      'Highly transactional for pullback entries in trends; analytical when nested inside larger XABCD to confirm PRZ precision.',
  },

  leonardo: {
    displayName: 'Leonardo',
    structure: 'XABCD',
    purpose:
      'The Leonardo (custom / extended family) aligns XAB, ABC, BCD, and XAD ratios to a specific Fibonacci set (including 0.786 XAD) to highlight PRZs tuned for deeper trend corrections.',
    prediction:
      'Similar to Gartley-like behaviour with emphasis on 0.786 XAD confluence—anticipates reversal once D respects the defined PRZ bundle.',
    usage:
      'Treat as analytical first (understand ratio tolerances used by your scanner); transactional like other XABCD once D validates with price rejection.',
  },

  three_drives: {
    displayName: 'Three Drives',
    structure: 'ABCD / multi-leg',
    purpose:
      'Three Drives maps a sequence of three symmetrical push/pull legs into a terminal drive, highlighting chronic extension before exhaustion. Often used as confirmation alongside ABCD symmetry.',
    prediction:
      'Anticipates trend exhaustion after the third drive completes, especially when aligned with higher-timeframe reversal pressure or divergence.',
    usage:
      'Primarily analytical for context and timing windows; transactional only on the third drive with strict confirmation because earlier drives can extend.',
  },

  __default__: DEFAULT_INFO,
};

PATTERN_INFO.alt_bat = { ...PATTERN_INFO.alternate_bat };

/**
 * Normalize API pattern name (e.g. "Deep Crab", "5-0", "alternate bat") to lookup key.
 * @param {string | undefined | null} raw
 * @returns {string}
 */
export function normalizePatternTypeKey(raw) {
  if (raw == null || typeof raw !== 'string') return '__default__';
  if (!raw.trim()) return '__default__';
  let s = raw
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, '_')
    .replace(/_+/g, '_');

  if (s === '5_0' || s === '5o' || s === 'five0' || s === 'five_0') s = 'five_zero';

  const aliases = {
    deepcrab: 'deep_crab',
    deepshark: 'deep_shark',
    alt_bat: 'alternate_bat',
    alternatebat: 'alternate_bat',
    '5_0': 'five_zero',
    ab_cd: 'abcd',
    abcd_pattern: 'abcd',
  };

  if (aliases[s]) return aliases[s];
  if (PATTERN_INFO[s]) return s;

  // Contains keyword fallback (order: more specific first)
  if (s.includes('deep') && s.includes('crab')) return 'deep_crab';
  if (s.includes('deep') && s.includes('shark')) return 'deep_shark';
  if (s.includes('alternate') && s.includes('bat')) return 'alternate_bat';
  if (s.includes('three') && s.includes('drive')) return 'three_drives';
  if (s.includes('gartley')) return 'gartley';
  if (s.includes('butterfly')) return 'butterfly';
  if (s.includes('cypher')) return 'cypher';
  if (s.includes('crab')) return 'crab';
  if (s.includes('shark')) return 'shark';
  if (s.includes('leonardo')) return 'leonardo';
  if (s.includes('abcd') && !s.includes('xabcd')) return 'abcd';

  return PATTERN_INFO[s] ? s : '__default__';
}

/**
 * @param {string | undefined | null} patternType from ta_object_json.pattern_type
 * @returns {typeof DEFAULT_INFO & { key: string }}
 */
export function getPatternInfo(patternType) {
  const key = normalizePatternTypeKey(patternType);
  const data = PATTERN_INFO[key] || PATTERN_INFO.__default__;
  return { ...data, key };
}
