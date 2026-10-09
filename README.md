# trading.ai frontend

React dashboard for the trading.ai platform: candlestick charts with harmonic pattern detection
(XABCD), tracked trade setups with statistics, a strength model that scores every setup, variant
benchmarks, e-mail alerts and paper trading accounts that trade the setups on live candles.

The UI talks to [trading.ai.backend](https://git.00x097.com/tbs093a/trading.ai.backend) over REST.
The interface text is mostly Polish; code, comments and docs are English.

- Production: <https://00x097.com>; API: <https://api.00x097.com>
- Repository: <https://git.00x097.com/tbs093a/trading.ai.frontend> (Gitea, main), mirrored to GitHub
  (`TBS093A/trading.ai.frontend`)

> **Not financial advice.** Strength scores, statistics, calculators and paper trading are
> research tools. Paper accounts simulate fills on real candles; they never touch real money.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [State management](#state-management)
- [Backend API](#backend-api)
- [Security](#security)
- [Persisted UI state](#persisted-ui-state)
- [Deep links](#deep-links)
- [Development conventions](#development-conventions)
- [Testing](#testing)
- [CI/CD and supply chain](#cicd-and-supply-chain)
- [Docker and nginx](#docker-and-nginx)
- [Git workflow](#git-workflow)

## Features

The layout is a narrow **nav rail** on the left, the main view in the middle and the
**patterns panel** on the right. The rail opens side panels (Markets, Saved analyses,
Synchronization) and switches the main view between the chart and four dashboard groups.

### Chart

- **TradingView Lightweight Charts** (v4) candlesticks for every tracked asset and interval.
- **Lazy history**: the chart loads the most recent candles first and fetches older pages
  (`startTime` / `endTime`) when you scroll left, so long histories don't lag the browser or load
  the backend.
- **Indicators**: Volume, RSI(14), MACD(12,26,9), OBV, computed client-side
  (`src/utils/indicators.js`) in panes below the price.
- **Harmonic patterns** (Gartley, Bat, Butterfly, Crab, Shark, Cypher, …) drawn as XABCD shapes.
  Hover shows the name and direction; click opens the details in the right panel.
- **Fibonacci levels** per pattern: internal retracements, external extensions, pattern-specific
  FE (ABC, BCD) and TP / PRZ / SL levels, each toggleable. Lines can be shared to other intervals.
- **Harmonic tools** (toolbar): scan a selected range for patterns, or draw XABCD manually and
  validate it against the Fibonacci ratios (`POST /harmonics/validate`).
- **Setups overlay**: tracked setups as entry / SL / TP levels, colored by status (waiting, open,
  win, loss, invalidated, expired), with a status filter and a hover tooltip showing SL / TP / R.

### Patterns panel (right)

- Every pattern on the current chart, sortable by **strength** (0–100 percentile from the
  backend model; a green tint follows the score).
- Per pattern: setup levels, **confluences** grouped in six categories (RSI / stochastic,
  candlesticks, Fibonacci cluster, higher-TF S/R, volume / MACD / OBV, higher-TF trend) and the
  strength breakdown (factors with their impact, pre-PRZ vs full strength).
- **Setup sections**: active setups grouped by state across all tracked assets.

### Dashboard groups

| Rail button | Group | Tabs |
|---|---|---|
| ◔ Setup performance | `stats` | **Performance**: win rate, average R and outcomes per pattern / interval / direction, a trade calculator (position size and P/L from account size and risk %) and a long / short trading guide |
| ▥ Strength model & benchmarks | `model` | **Model siły**: current model metrics (AUC, quintiles), top weights, fit history, training data and a "Naucz teraz" button, with a training guide. **Benchmarki**: variant reports (strength filters, entry modes) against the baseline, equity curves, breakdowns, with a guide |
| ⇅ Paper trading | `trading` | **TradingView**: paper trading accounts (see below) |
| ✉ Alerts & tracked assets | `alerts` | **Alerts**: e-mail alert settings, event log, test e-mail. **Tracked assets**: which assets / intervals the backend tracks, pattern sync and backfill |

Each group remembers its last tab.

### Paper trading

- **Accounts list** with equity, P/L, drawdown and kill-switch state.
- **Account wizard** in four steps:
  1. Risk preset.
  2. Fine-tune the risk fields, with a live preview simulated on history and compared to the presets.
  3. What the account trades: assets, intervals, patterns, direction, entry mode (touch PRZ / confirmation).
  4. Summary.
- **Risk fields** come from the backend (`GET /trading/risk/fields`) and render generically:
  numeric fields as a slider plus number input (nullable ones get a "bez filtra" switch),
  `select` fields (e.g. the higher-TF trend filter) as a dropdown with per-option descriptions.
- **Account view**:
  - equity curve
  - signals, positions, orders and the event log
  - backtest vs account comparison (`execution_cost_r`)
  - kill switch
  - settings: filters and entry mode, saved separately from risk; changes apply from the next hourly run
- **Signal trace**: the full path of one signal (setup → signal → orders → fills → position →
  events) on a mini chart, with higher-TF trend badges.

### Other

- Login with session verification, profile and avatar, password change, user admin (admins).
- Saved analyses (store and restore a chart state).
- Synchronization panel (admins): exchange / technical-analysis sync tasks and their status.
- Deep links from alert e-mails open the chart on the exact setup.

## Tech stack

| | |
|---|---|
| UI | React 18 (function components and hooks), Create React App (`react-scripts` 5) |
| State | Redux Toolkit 2 (`createSlice`, `createAsyncThunk`), react-redux 9 |
| Charts | `lightweight-charts` 4 for candles; small SVG charts in `Stats/charts/MiniCharts.js` |
| HTTP | axios with auth / CSRF interceptors |
| Tests | Jest via `react-scripts test` |
| Runtime | nginx (unprivileged, alpine) serving the static build |

## Getting started

### Prerequisites

- Node.js 24 (the CI and Docker image use `node:24.12.0-bookworm`), npm 11
- A running backend (local or remote)

```bash
nvm install 24
npm ci
cp .env.example .env    # set REACT_APP_API_URL
npm start               # http://localhost:3000
```

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server with hot reload |
| `npm test` | Jest in watch mode (`CI=true npm test -- --watchAll=false` for one run) |
| `npm run build` | Production build in `build/` |
| `npx eslint --no-eslintrc -c .eslintrc.ci.json src` | Lint exactly as the CI gate does |

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `REACT_APP_API_URL` | `http://localhost:8000` | Backend base URL. CRA bakes it into the bundle **at build time**; in Docker pass it as a build `ARG` (default `https://api.00x097.com`) |

When you change the API host for production, update `connect-src` in `nginx.conf` (CSP) too.

## Project structure

```
src/
├── App.js                      # auth routing, main view switch (chart | dashboard group), deep links
├── index.js                    # entry, Redux Provider
├── components/
│   ├── Chart/
│   │   ├── TradingViewChart.js # candles, lazy history, indicators, patterns, Fibonacci lines
│   │   ├── SetupsOverlay.js    # tracked setups as levels + status filter + tooltip
│   │   └── HarmonicTools.js    # range scan and manual XABCD drawing
│   ├── Harmonics/              # harmonic tools toolbar
│   ├── Dashboard/              # chart layout, save-analysis modal
│   ├── IndicatorControls/      # VOL / RSI / MACD / OBV toggles
│   ├── Login/                  # login page
│   ├── PatternTooltip/         # pattern hover popup
│   ├── PatternsPanel/          # right panel: patterns, setups, confluences, strength, sections
│   ├── Sidebar/                # NavRail, Markets, Saved analyses, Sync, account modal
│   ├── Stats/                  # dashboard groups (SetupsHub) and their views and guides
│   └── Trading/                # paper trading: list, wizard, account view, risk form/preview,
│                               #   filters, signal trace, formatting helpers
├── services/api.js             # axios instance + every backend call
├── store/
│   ├── store.js
│   └── slices/                 # one slice per domain (see below)
├── styles/global.css           # theme tokens (CSS variables) and base classes
└── utils/
    ├── indicators.js           # RSI, MACD, OBV
    ├── setupMath.js            # setup levels, R multiples
    ├── tradeMath.js            # calculator math
    ├── deepLink.js             # parse / apply e-mail deep links
    └── security.js             # CSRF token cache, input sanitising
```

Every component has its own `.css` next to the `.js`.

## State management

| Slice | Holds |
|---|---|
| `auth` | user, token, session verification, avatar |
| `exchanges`, `assets` | exchange and asset lists, selection, search |
| `chart` | klines (paged history), interval, focus time |
| `analysis` | harmonic patterns, selection, panel options (Fibonacci toggles, shared lines) |
| `harmonics` | range scan and manual XABCD state |
| `setups` | tracked setups, sections, overlay filters, highlight |
| `strength` | strength model, history, training data, fit |
| `benchmarks` | variant reports and runs |
| `alerts` | alert settings, events, tracked assets |
| `trading` | risk field metadata and presets, filter options, accounts, account detail, save status |
| `savedAnalysis` | saved chart states |
| `sync` | sync tasks and health |
| `ui` | main view, side panels, tooltips |

Thunks use `createAsyncThunk` with `condition` to skip duplicate requests and `requestId` to
ignore stale responses.

## Backend API

All calls are in `src/services/api.js`.

| Area | Endpoints |
|---|---|
| Auth / user | `POST /user/auth/login`, `POST /user/auth/logout`, `GET /user/auth/verify`, `GET\|PUT /user/me`, `POST /user/me/password`, `GET\|POST\|DELETE /user/me/avatar`, user admin under `/user/*` |
| Saved analyses | `/user/saved-analyses` (CRUD) |
| Exchanges / assets | `GET /exchanges/list`, `/exchanges/active`, `/exchanges/{id}`, `/exchanges/klines/{asset_id}/{interval}` (`limit`, `start_time`, `end_time`), `/assets/*`, `/assets/with-harmonic-patterns` |
| Harmonics | `GET /harmonics/{asset_id}/{interval}`, `POST /harmonics/validate`, `GET /harmonics/stats`, `/harmonics/setups`, `/harmonics/setups/tracked`, `/harmonics/setups/sections` |
| Strength model | `GET /harmonics/strength/model`, `/strength/history`, `/strength/data`, `POST /harmonics/strength/fit` |
| Benchmarks | `GET /harmonics/variants/reports`, `/variants/report`, `POST /harmonics/variants/run` |
| Tracked assets / alerts | `GET /harmonics/tracked-assets`, `PUT\|DELETE /harmonics/tracked-assets/{asset_id}`, `GET\|PUT /harmonics/alerts/settings`, `GET /harmonics/alerts/events`, `POST /harmonics/alerts/test` |
| Paper trading | `GET /trading/risk/fields`, `GET /trading/filter-options`, `POST /trading/risk/preview`, `GET\|POST /trading/accounts`, `GET\|PATCH /trading/accounts/{id}`, `POST /trading/accounts/{id}/kill-switch`, `GET /trading/accounts/{id}/{equity,signals,positions,orders,events,compare}`, `GET /trading/signals/{id}/trace` |
| Technical analysis | `/analysis/technical/*` (patterns, counts, stats, sync) |
| Sync | `POST /exchanges/sync`, `/analysis/technical/sync`, `/analysis/technical/sync/assets`, `GET\|DELETE /sync/status[/{task_id}]`, `/sync/health`, `/sync/workflow` |

Contract notes:

- Symbols are `BASE/QUOTE`, e.g. `BTC/USDT`. Times are epoch milliseconds.
- Account `filters` omit empty lists, so a missing key means no filter. `PATCH {filters, entry_mode}` and
  `PATCH {risk}` are sent separately.
- Risk fields and presets are defined by the backend. The UI never hard-codes field names, apart from
  short summaries. It hard-codes no benchmark variant names except `baseline`.
- `execution_cost_r = backtest − account` (positive = the account did worse than the backtest).

## Security

- The bearer token lives in `localStorage` (`authToken`, `authUser`). A `401` clears it and fires
  `auth:unauthorized`, which logs the user out.
- Modifying requests (POST / PUT / PATCH / DELETE, except login) carry an `X-CSRF-Token` from
  `GET /csrf-token`. The token is cached until shortly before it expires. A `403 CSRF Validation Failed`
  drops the cache.
- `429` fires `api:rate-limited` with `retryAfter` for the UI.
- JSON bodies are sanitised (`utils/security.js`) before sending.
- Admin-only UI (sync, user admin, account settings) is hidden for other roles; the backend
  enforces the same rules.
- nginx sends CSP, `X-Frame-Options: DENY`, `nosniff` and a restrictive `Permissions-Policy`
  (see [Docker and nginx](#docker-and-nginx)).

## Persisted UI state

Per-browser conveniences in `localStorage`. Every read is guarded, so the app works without them.

| Key | What |
|---|---|
| `ui.sidebarPanel`, `ui.expandedGroups` | open side panel, expanded groups |
| `setups.hiddenStatuses`, `setups.showJunk`, `setups.sectionsOpen` | overlay filter and sections |
| `dashboards.<group>.tab` | last tab per dashboard group |
| `dashboards.model.guideOpen`, `dashboards.benchmarks.guideOpen` | guide collapsed / open |
| `stats.calculator` | calculator inputs |

## Deep links

Alert e-mails link straight to a setup:

```
/?view=chart&asset_id=5&interval=4h&t=1700000000000&pattern=bat&x=1699000000000&c=1699500000000
```

| Param | Meaning |
|---|---|
| `view` | `chart` |
| `asset_id` | asset |
| `interval` | interval (must be one the app knows) |
| `t` | time to focus |
| `pattern` | pattern type to highlight |
| `x`, `c` | X and C point times, used to pick the exact pattern |

Malformed parameters are ignored. The parameters are removed from the address bar after use
(`utils/deepLink.js`).

## Development conventions

- **No `eslint-disable … react-hooks/*` comments.** The CRA build has no react-hooks plugin, so
  such a comment fails the build ("Definition for rule … was not found"). Use `useCallback`,
  `useMemo`, refs or stable JSON keys instead.
- Lint must have **0 errors** (`.eslintrc.ci.json`). Warnings don't block the gate.
- Keep components small and colocated with their CSS. Use theme tokens (`var(--accent-cyan)`, …)
  from `styles/global.css`, never raw colors, except validated chart palettes.
- **Chart colors**: categorical series use fixed, validated slots in fixed order, never cycled.
  - Variants: `#3987e5`, `#d95926`, `#199e70`, `#c98500`, `#d55181`.
  - Risk-preview presets: `#199e70`, `#c98500`, `#d55181` next to the blue "your settings" line.
  - Baseline: `#b7bec6`, dashed.
  - Legends and tables always carry the identity too, so color is never the only cue.
- Meta-driven UI: render what the backend describes (risk fields, presets, entry modes, filter
  options) instead of hard-coding lists.

## Testing

```bash
CI=true npm test -- --watchAll=false            # all tests once
CI=true npm test -- --coverage --watchAll=false # with coverage, as in CI
```

Tests cover slices (reducers and thunks with a mocked API) and pure helpers (deep links, setup
and trade math, formatting, filters). `@testing-library/react` is not installed; keep component
logic in testable functions.

**Manual checks against a mock backend:** run a small Node HTTP server that answers the endpoints
you need. Then start the dev server against it:

```bash
BROWSER=none PORT=3456 REACT_APP_API_URL=http://localhost:8765 npx react-scripts start
```

To log in without a backend, set `localStorage.authToken` and `authUser`
(`{"id":1,"username":"…","role":"administrator"}`).

## CI/CD and supply chain

Every change goes through `Jenkinsfile.build` (Jenkins, same model as the terraform pipelines in
`cloud.config`):

```
PR -> PRE-MERGE gate -> merge -> POST-MERGE -> RELEASE -> production
```

- **PRE-MERGE** runs on every PR. Required status: `jenkins/pre-merge` on `main`. Stages:
  1. gitleaks
  2. ESLint (errors block)
  3. Jest and coverage threshold (`MIN_COVERAGE`, only ever raised)
  4. Semgrep (ERROR blocks)
  5. Trivy on dependencies, then on the built image (scanned before it is ever pushed)

  The gate scripts come from `main`, not from the PR under test. Results land in a `jenkins-bot`
  comment on the PR.
- **POST-MERGE** runs only for a `main` commit that merges a PR with a passing gate:
  1. push by digest
  2. CycloneDX SBOM
  3. cosign signature, verified against [`cosign.pub`](cosign.pub)
- **RELEASE** stages:
  1. optional approval
  2. image tag bumped in `cloud.config` (ArgoCD)
  3. rollout, smoke and health checks, automatic rollback by reverting the bump
  4. OWASP ZAP baseline (DAST)

  Progress goes to a comment on the merged PR.

Helper scripts (same files in trading.ai.backend; keep them in sync):

| File | Role |
|---|---|
| `ci-gate.py` | hard gates: coverage, semgrep, trivy, zap, tool results → `gate-results.json` |
| `gitea.py` | minimal Gitea API client (commit status, PR comments) |
| `start-pr-comment.py` | "build started" PR comment |
| `build-pr-comment.py` | results table, edits the comment in place |

Verify a deployed image yourself:

```bash
cosign verify --key cosign.pub --insecure-ignore-tlog=true registry.00x097.com/trading-ai-frontend@sha256:<digest>
```

`--insecure-ignore-tlog` is needed because signatures are not uploaded to the public Rekor log
(the registry is private).

## Docker and nginx

```bash
docker build --build-arg REACT_APP_API_URL=https://api.00x097.com -t trading-ai-frontend .
docker run --rm -p 8080:8080 trading-ai-frontend
```

- Build stage: `node:24.12.0-bookworm`, `npm ci`, `npm run build` with `CI=true` and
  `GENERATE_SOURCEMAP=false`.
- Runtime: `nginxinc/nginx-unprivileged:1.29-alpine`, upgraded with `apk upgrade` (Trivy), running as UID 101
  on port **8080** (the k8s manifest drops all capabilities).
- `nginx.conf`:
  - SPA fallback to `index.html`
  - security headers
  - CSP allowing only `self`, Google Fonts and the API in `connect-src`

  COEP and SRI on Google Fonts are left out on purpose; the reasons are in the file.

## Git workflow

- `main` is protected and accepts changes only through pull requests on Gitea.
- Work on a feature branch (`feat/…`, `fix/…`, `docs/…`) from `main`, open a PR, wait for
  `jenkins/pre-merge`, merge. The merge deploys to production.
- Conventional commit subjects: `feat(scope): …`, `fix(scope): …`, `docs: …`.
- GitHub (`origin`) is a mirror: fast-forward its `main` to Gitea `main` after merges.

## License

MIT
