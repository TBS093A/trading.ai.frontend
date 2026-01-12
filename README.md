# Trading AI Frontend

A React-based trading dashboard with TradingView Lightweight Charts for cryptocurrency technical analysis, featuring harmonic pattern detection and Fibonacci levels visualization.

## Features

### 📊 Chart Dashboard
- **TradingView Lightweight Charts** - Professional-grade candlestick charts
- **Multiple Timeframes** - 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M
- **Real-time data** - Fetches klines from Binance via backend API

### 🎯 Harmonic Patterns
- Visual display of detected harmonic patterns (Gartley, Bat, Butterfly, Crab, Shark, etc.)
- Pattern points (X, A, B, C, D) marked on chart
- **Hover tooltips** - Shows pattern name and direction
- **Click to expand** - Opens right panel with detailed analysis

### 📐 Fibonacci Levels
When a pattern is selected, toggle visibility of:
- **Internal Fibo Retracements** - 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 88.6%, 100%
- **External Fibo Extensions** - 113%, 127.2%, 141.4%, 161.8%, 200%, 261.8%, etc.
- **Fibonacci FE** - Pattern-specific extensions (ABC, BCD)
- **TP/PRZ/SL Levels** - Take Profit, Potential Reversal Zone, Stop Loss

### 📈 Technical Indicators
- **Volume** - Bar chart at bottom of main chart
- **RSI(14)** - Relative Strength Index with overbought/oversold zones
- **MACD(12,26,9)** - Moving Average Convergence Divergence
- **OBV** - On-Balance Volume

### 🎨 UI/UX
- **Cyberpunk dark theme** - Deep space colors with neon accents
- **Responsive layout** - Works on desktop and tablet
- **Smooth animations** - Fade-in effects and hover states
- **JetBrains Mono** - Monospace font for data
- **Outfit** - Modern sans-serif for UI

## Tech Stack

- **React 18** - UI framework
- **Redux Toolkit** - State management
- **Lightweight Charts** - TradingView charting library
- **Axios** - HTTP client

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend API running (trading.ai.backend)

### Installation

```bash
cd trading.ai.frontend
npm install
```

### Configuration

Create a `.env` file or set environment variable:

```bash
REACT_APP_API_URL=http://localhost:8000
```

### Run Development Server

```bash
npm start
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── Chart/
│   │   └── TradingViewChart.js    # Main chart with patterns
│   ├── Dashboard/
│   │   └── Dashboard.js           # Main dashboard layout
│   ├── IndicatorControls/
│   │   └── IndicatorControls.js   # Indicator toggle buttons
│   ├── PatternTooltip/
│   │   └── PatternTooltip.js      # Hover tooltip for patterns
│   ├── RightPanel/
│   │   └── RightPanel.js          # Fibonacci levels panel
│   └── Sidebar/
│       └── Sidebar.js             # Exchange/asset selection
├── services/
│   └── api.js                     # Backend API client
├── store/
│   ├── slices/
│   │   ├── analysisSlice.js       # Harmonic patterns state
│   │   ├── assetsSlice.js         # Assets state
│   │   ├── chartSlice.js          # Klines/chart state
│   │   ├── exchangesSlice.js      # Exchanges state
│   │   └── uiSlice.js             # UI state
│   └── store.js                   # Redux store config
├── styles/
│   └── global.css                 # Global styles & theme
├── utils/
│   └── indicators.js              # RSI, MACD, OBV calculations
├── App.js
└── index.js
```

## API Endpoints Used

### Exchanges
- `GET /exchanges/list` - List exchanges
- `GET /exchanges/klines/{asset_id}/{interval}` - Get candlestick data

### Assets
- `GET /assets/exchange/{exchange_id}` - Get assets for exchange
- `GET /assets/search/asset/{name}` - Search assets

### Technical Analysis
- `GET /analysis/technical/asset/{asset_id}/interval/{interval}` - Get harmonic patterns

## Usage

1. **Select Exchange** - Choose from dropdown in sidebar
2. **Select Asset** - Click on asset in the list (or search)
3. **View Chart** - Candlesticks load automatically with detected patterns
4. **Hover Pattern** - See pattern name popup
5. **Click Pattern** - Open right panel with Fibonacci levels
6. **Toggle Fibonacci** - Show/hide different level types
7. **Toggle Indicators** - Enable Volume, RSI, MACD, OBV

## Theme Colors

| Purpose | Color | CSS Variable |
|---------|-------|--------------|
| Bullish | #00ff88 | `--chart-bullish` |
| Bearish | #ff3366 | `--chart-bearish` |
| Accent Cyan | #00f0ff | `--accent-cyan` |
| Accent Purple | #9945ff | `--accent-purple` |
| Background | #060810 | `--bg-primary` |

## License

MIT

