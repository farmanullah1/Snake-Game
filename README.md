# 🐍 Modern Snake Game

[![Live Demo](https://img.shields.io/badge/🎮_Play_Now-Live_Demo-00c6ff?style=for-the-badge)](https://farmanullah1.github.io/Snake-Game/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

A sleek, **fully-responsive**, high-performance Snake game built with **React 19**, **TypeScript**, and **HTML5 Canvas**. Designed to work flawlessly from 320 px feature phones to 4K desktops, with modern glassmorphism UI, haptic feedback, and touch-optimized controls.

---

## ✨ Features

| Category | Details |
|---|---|
| 🎮 **Gameplay** | 3 difficulty modes · 2 game modes (Classic / Free Roam) · power-ups · bonus food · combo streaks |
| 🌓 **Themes** | Light mode (soft gradient) · Dark mode (neon cyber glow) · smooth transitions |
| 🎨 **Skins** | 6 snake skins including animated Rainbow |
| 🏆 **Progress** | 14 achievements · per-difficulty high scores · level tracking |
| 📱 **Mobile** | Swipe gestures · on-screen D-pad (WCAG 46px+ touch targets) · haptic vibration · safe-area support |
| ⚡ **Performance** | DPR-aware canvas · `requestAnimationFrame` loop · background-tab skip · per-frame DPR guard |
| 🎯 **Responsiveness** | Pixel-perfect grid snapping · landscape support · viewport-based sizing · scrollable layout |
| ♿ **Accessibility** | Keyboard (Arrow / WASD / Space / Enter) · pointer events on D-pad · `aria-label` on controls |

---

## 🛠️ Technical Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI & state management |
| TypeScript | 6 | Type safety |
| Vite | 8 | Build & dev server |
| HTML5 Canvas | — | Game rendering |
| Web Vibration API | — | Haptic feedback |
| CSS `env()` safe-area | — | Notch / home-indicator support |

---

## 📐 Architecture

### Canvas Rendering Strategy

The game uses a **two-coordinate-space** approach that prevents blurry rendering on HiDPI screens:

```
Logical drawing space: 400 × 400 px (20 × 20 grid, 20 px/cell)
Physical canvas size : 400 × 400 × devicePixelRatio px
CSS display size     : boardSize px  (responsive, 200–600 px)

ctx.setTransform(dpr, 0, 0, dpr, 0, 0)  ← scales drawing to physical pixels
canvas.style.width = boardSize + 'px'   ← CSS scales physical → display
```

Each frame re-applies the DPR transform, guarding against context resets.

### Responsive Board Size

Board size is calculated **synchronously on mount** using `window.visualViewport` and adapts to:
- **Portrait phones** (320–430 px) — compact chrome budget
- **Landscape phones** — reduced chrome budget for more canvas space
- **Tablets & desktops** (768 px+) — full-size layout

The board is floored to the nearest grid-column multiple (20px) for pixel-perfect cell rendering:

```ts
const floored = Math.floor(available / COLS) * COLS;
return Math.max(200, Math.min(600, floored));
```

### Performance Optimizations

- **Background tab skip**: Animation loop returns early when `document.hidden` is true
- **Per-frame DPR guard**: `ctx.setTransform` re-applied each frame to prevent blur after monitor changes
- **DPR change detection**: `matchMedia('(resolution: Xdppx)')` listener triggers canvas resize
- **No heavy deps**: Zero external game libraries; pure React + Canvas

### Swipe Detection

- Origin stored only on `touchstart`
- Reset to current touch position after a direction is committed (chains rapid swipes)
- Axis ratio filter prevents diagonal micro-drags

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 20.19
- npm ≥ 10

### Install & Run

```bash
git clone https://github.com/farmanullah1/Snake-Game.git
cd Snake-Game
npm install
npm run dev
```

Open `http://localhost:5173` — or scan the QR code Vite prints in the terminal for mobile testing on the same network.

### Build & Deploy

```bash
npm run build     # TypeScript compile + Vite bundle → dist/
npm run preview   # Preview production build locally
npm run deploy    # gh-pages publish to GitHub Pages
```

---

## 🎮 Controls

| Input | Action |
|---|---|
| `↑ ↓ ← →` / `W A S D` | Steer |
| `Space` / `Escape` / `P` | Pause / Resume |
| `Enter` | Start / Restart |
| **Swipe** (touch) | Steer |
| **D-pad** (touch) | Steer (with hold-to-repeat) |

---

## 📱 Tested Screen Sizes

| Width | Device class | Status |
|---|---|---|
| 320 px | Small Android / iPhone SE 1st gen | ✅ |
| 375 px | iPhone SE / 12 mini | ✅ |
| 390 px | iPhone 14 | ✅ |
| 430 px | iPhone 14 Pro Max | ✅ |
| 768 px | iPad / tablet portrait | ✅ |
| 1280 px+ | Desktop | ✅ |
| Landscape | Phone rotated | ✅ |

---

## 🐛 Bug Fixes & Improvements

| Issue | Root Cause | Fix |
|---|---|---|
| Blurry canvas on Retina | DPR not re-applied after context reset | Per-frame `setTransform` + DPR change listener |
| Wrong board size on first render | `getBoundingClientRect` race | `useVisualViewport` synchronous calculation |
| Swipe drop on fast movement | Origin reset on every `touchmove` | Origin fixed to `touchstart`; resets on commit |
| Content clips on iOS notch | Missing `viewport-fit=cover` | Added `env(safe-area-inset-*)` padding |
| Layout overflow on 320 px | D-pad and score grid too wide | Viewport-scaled D-pad, 2-column score grid |
| Mobile toolbar jump | `100vh` doesn't account for toolbar | `100svh` / `-webkit-fill-available` + fixed body |
| Wasted battery on hidden tabs | Animation loop runs when tab not visible | `document.hidden` early-exit in rAF loop |
| D-pad too small on some phones | Fixed breakpoint-based sizing | `Math.max(46, Math.min(64, vw * 0.12))` |
| Duplicate CSS `bottom` on toast | Object literal had duplicate key | Consolidated into single `bottom` property |

---

## 📁 Project Structure

```
src/
├── SnakeGame.tsx   # Main game component (types, canvas draw, game logic, UI)
├── App.tsx         # Root component
├── App.css         # (empty — all styles inline in SnakeGame)
├── main.tsx        # React DOM entry point
└── index.css       # Global reset + mobile viewport fixes
index.html          # SEO meta, viewport, structured data
vite.config.ts      # Vite config with base path for GitHub Pages
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [Farmanullah Ansari](https://github.com/farmanullah1)