# Trading AI Frontend

## Project Overview

React-based trading dashboard for cryptocurrency technical analysis with harmonic pattern detection and Fibonacci levels visualization. Uses TradingView Lightweight Charts library.

## Tech Stack

- **React 18** - UI framework with functional components and hooks
- **Redux Toolkit** - State management with slices pattern
- **Lightweight Charts** - TradingView charting library (v4.1.1)
- **Axios** - HTTP client for backend API communication

## Project Structure

```
src/
├── components/           # React components (each with .js + .css)
│   ├── Chart/           # TradingView chart with patterns overlay
│   ├── Dashboard/       # Main layout with header and chart container
│   ├── IndicatorControls/  # Toggle buttons for VOL, RSI, MACD, OBV
│   ├── PatternTooltip/  # Hover popup for harmonic patterns
│   ├── RightPanel/      # Fibonacci levels side panel
│   ├── Sidebar/         # Exchange/asset selection
│   └── SyncPanel/       # Sync operations panel (exchanges, technical analysis)
├── services/
│   └── api.js           # Axios-based API client
├── store/
│   ├── store.js         # Redux store configuration
│   └── slices/          # Redux Toolkit slices
│       ├── analysisSlice.js   # Harmonic patterns & indicators state
│       ├── assetsSlice.js     # Assets list and selection
│       ├── chartSlice.js      # Klines data and interval
│       ├── exchangesSlice.js  # Exchanges list and selection
│       ├── syncSlice.js       # Sync operations state (tasks, loading)
│       └── uiSlice.js         # UI state (panels, tooltips)
├── styles/
│   └── global.css       # Theme variables and base styles
├── utils/
│   └── indicators.js    # Client-side indicator calculations
├── App.js               # Root component with layout
└── index.js             # Entry point with Redux Provider
```

## State Management (Redux Toolkit)

### Slices

| Slice | Purpose | Key State |
|-------|---------|-----------|
| `exchanges` | Exchange data | `list`, `selectedExchange`, `loading` |
| `assets` | Asset data | `list`, `filteredList`, `selectedAsset`, `searchTerm` |
| `chart` | Chart data | `klines`, `interval`, `asset`, `quote` |
| `analysis` | Technical analysis | `harmonicPatterns`, `selectedPattern`, `panelOptions`, `indicators` |
| `ui` | UI state | `sidebarOpen`, `rightPanelOpen`, `tooltipPosition`, `tooltipContent` |
| `sync` | Sync operations | `isPanelOpen`, `activeSection`, `exchanges/technical/bulk` states, `activeTasks` |

### Data Flow

1. User selects exchange → `fetchExchanges` → updates `exchanges.selectedExchange`
2. Exchange selected → `fetchAssetsByExchange` → populates `assets.list`
3. User selects asset → updates `assets.selectedAsset`
4. Asset selected → `fetchKlines` → populates `chart.klines`
5. Klines loaded → `fetchTechnicalAnalysis` → populates `analysis.harmonicPatterns`

### Sync Operations Flow

1. User opens SyncPanel → `toggleSyncPanel` action
2. User expands section → `setActiveSection` action
3. User configures params and clicks sync → dispatches async thunk (`syncExchanges`/`syncTechnicalAnalysis`/`syncBulkAssets`)
4. Backend returns task_id → stored in `activeTasks` with status tracking
5. Task status updates reflected in UI with status icons (✓/✗/⟳)

## Backend API Integration

API base URL configured via `REACT_APP_API_URL` environment variable (default: `http://localhost:8000`)

### Key Endpoints Used

```javascript
// Exchanges
GET /exchanges/list                          // List all exchanges
GET /exchanges/klines/{asset_id}/{interval}  // Get candlestick data

// Assets
GET /assets/exchange/{exchange_id}           // Assets for exchange
GET /assets/search/asset/{name}              // Search assets

// Technical Analysis
GET /analysis/technical/asset/{asset_id}/interval/{interval}  // Harmonic patterns

// Sync Operations
POST /exchanges/sync                         // Sync exchanges from APIs
POST /analysis/technical/sync                // Sync technical analysis
POST /analysis/technical/sync/assets         // Bulk sync for specific asset IDs
GET  /sync/status/{task_id}                  // Get Celery task status
```

### Sync Endpoints Parameters

| Endpoint | Parameters |
|----------|------------|
| `POST /exchanges/sync` | `test_mode` (bool), `custom_dependencies` (array) |
| `POST /analysis/technical/sync` | `limit` (1-1000), `offset` (≥0), `test_mode`, `custom_dependencies` |
| `POST /analysis/technical/sync/assets` | `asset_ids` (array, required), `test_mode`, `custom_dependencies` |

## Component Patterns

### Chart Component (`TradingViewChart.js`)

- Uses `useRef` for chart instance management
- Subscribes to chart events (click, crosshair move)
- Creates price lines for Fibonacci levels
- Uses markers for pattern points (X, A, B, C, D)

### Panel Components

- Controlled by Redux UI slice
- Toggle visibility with `togglePanelOption` action
- Fibonacci sections conditionally rendered based on `panelOptions`

### SyncPanel Component

Floating panel for triggering backend sync operations:

- **Toggle button** - Fixed position with refresh icon (⟳), shows pulse badge when tasks are running
- **Expandable sections** - Each sync type collapsable with parameters
- **Active tasks list** - Shows running/completed tasks with status indicators
- **Quick select** - For bulk assets, shows chips from loaded assets list

```javascript
// SyncPanel actions (syncSlice.js)
dispatch(syncExchanges({ testMode: false }));
dispatch(syncTechnicalAnalysis({ limit: 50, offset: 0, testMode: false }));
dispatch(syncBulkAssets({ assetIds: [1, 2, 3], testMode: false }));
```

## Styling Conventions

### CSS Variables (defined in `global.css`)

```css
/* Colors */
--bg-primary: #060810;        /* Main background */
--accent-cyan: #00f0ff;       /* Primary accent */
--chart-bullish: #00ff88;     /* Green for bullish */
--chart-bearish: #ff3366;     /* Red for bearish */

/* Spacing */
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;

/* Layout */
--sidebar-width: 280px;
--right-panel-width: 360px;
```

### Fonts

- **JetBrains Mono** - Monospace for data, prices, code
- **Outfit** - Sans-serif for UI text

### Component CSS Pattern

Each component has its own `.css` file imported at top of `.js` file:
```javascript
import './ComponentName.css';
```

## Technical Analysis Data Structure

Harmonic patterns from backend have this structure:

```javascript
{
  id: number,
  asset_id: number,
  interval: string,
  x_point_timestamp: number,  // milliseconds
  a_point_timestamp: number,
  b_point_timestamp: number,
  c_point_timestamp: number,
  d_point_timestamp: number,
  ta_object_json: {
    pattern_type: string,        // "Gartley", "Bat", etc.
    pattern_name: string,
    is_bullish: boolean,
    is_formed: boolean,
    completion_max_price: number,
    completion_min_price: number,
    retraces: { XAB: number, ABC: number, BCD: number, XABCD: number },
    points: {
      X: { index: number, price: number },
      A: { index: number, price: number },
      B: { index: number, price: number },
      C: { index: number, price: number },
      D: { index: number, price: number }
    },
    fibonacci_levels: {
      retracement: { "0.236": price, "0.382": price, ... },
      extension: { "1.272": price, "1.618": price, ... },
      fe_extensions: { "FE_ABC_127": { price, level, type }, ... },
      all_targets: { "TP_1": { price, type }, ... }
    }
  }
}
```

## Indicator Calculations (`utils/indicators.js`)

Client-side calculations for chart display only (backend has authoritative data):

- `calculateRSI(klines, period=14)` → RSI values with time
- `calculateMACD(klines, fast=12, slow=26, signal=9)` → { macdLine, signalLine, histogram }
- `calculateOBV(klines)` → On-Balance Volume values

## Development Commands

```bash
npm install       # Install dependencies
npm start         # Development server (port 3000)
npm run build     # Production build
npm test          # Run tests
```

## Common Patterns

### Fetching data on dependency change
```javascript
useEffect(() => {
  if (selectedAsset && interval) {
    dispatch(fetchKlines({ assetId: selectedAsset.id, interval }));
  }
}, [dispatch, selectedAsset, interval]);
```

### Memoized callbacks for chart events
```javascript
const handleChartClick = useCallback((param) => {
  // Handle click
}, [dispatch, harmonicPatterns]);
```

### Conditional rendering based on Redux state
```javascript
{panelOptions.showInternalFibo && fibLevels.retracement && (
  <FibonacciSection levels={fibLevels.retracement} />
)}
```

## Notes

- All harmonic pattern calculations done on backend - frontend only displays
- Chart uses timestamp in seconds (API returns milliseconds, divide by 1000)
- Pattern markers sorted by time before setting on chart
- Right panel opens automatically when pattern is clicked
- Sync operations run as Celery tasks on backend - frontend triggers and tracks status
- SyncPanel is fixed positioned in top-right corner for easy access

