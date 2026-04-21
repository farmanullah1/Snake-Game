# 🐍 Modern Snake Game

A sleek, **fully-responsive**, high-performance Snake game built with **React 19**, **TypeScript**, and **HTML5 Canvas**. Designed to work flawlessly from 320 px feature phones to 4K desktops.

🚀 **Live Demo:** [https://farmanullah1.github.io/Snake-Game/](https://farmanullah1.github.io/Snake-Game/)

---

## ✨ Features

| Category | Details |
|---|---|
| 🎮 **Gameplay** | 3 difficulty modes · 2 game modes · power-ups · bonus food · combos |
| 🌓 **Themes** | Light mode (soft gradient) · Dark mode (neon cyber glow) |
| 🎨 **Skins** | 6 snake skins including animated Rainbow |
| 🏆 **Progress** | 14 achievements · per-difficulty high scores · level tracking |
| 📱 **Mobile** | Swipe gestures · on-screen D-pad · haptic vibration · safe-area support |
| ⚡ **Performance** | DPR-aware canvas · `requestAnimationFrame` loop · no heavy deps |
| ♿ **Accessibility** | Keyboard (Arrow / WASD / Space / Enter) · pointer events on D-pad |

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
CSS display size     : boardSize px  (responsive, 220–520 px)

ctx.setTransform(dpr, 0, 0, dpr, 0, 0)  ← scales drawing to physical pixels
canvas.style.width = boardSize + 'px'   ← CSS scales physical → display
```

This means game logic always operates on a fixed 20×20 grid regardless of screen size, while the canvas renders pixel-perfectly at any resolution.

### Responsive Board Size

Board size is calculated **synchronously on mount** using `window.visualViewport` (which handles virtual keyboard on mobile) rather than `getBoundingClientRect`, avoiding the layout-measurement race condition that caused wrong sizes on first render:

```ts
const vw = window.visualViewport?.width ?? window.innerWidth;
const vh = window.visualViewport?.height ?? window.innerHeight;
const available = Math.min(vw - padding, vh - chromeBudget);
const boardSize = clamp(MIN_BOARD, available, MAX_BOARD); // 220–520 px
```

### Swipe Detection Fix

The original implementation reset the swipe origin on every `touchmove`, which dropped rapid swipes. The fix:
- Store origin only on `touchstart`
- Reset origin to **current touch position** (not original) only after a direction is committed
- This chains rapid swipes naturally (e.g. right → down in one fluid motion)

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
| **D-pad** (touch) | Steer |

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

---

## 🐛 Bug Fixes in This Version

| Bug | Root Cause | Fix |
|---|---|---|
| Blurry canvas on Retina | DPR not applied to `setTransform` consistently | Applied before every draw; stable across resize |
| Wrong board size on first render | `getBoundingClientRect` race with ResizeObserver | `useVisualViewport` synchronous calculation on mount |
| Swipe drops after fast movement | `tsRef` origin reset on each `touchmove` | Origin fixed to `touchstart`; resets only on committed direction |
| Content clips on iOS notch | Missing `viewport-fit=cover` + `env(safe-area-inset-*)` | Added to `<meta viewport>` and all fixed-position containers |
| Layout overflow on 320 px | D-pad and score grid too wide | D-pad scales to `50 px` buttons; score switches to 2-column grid |
| Mobile browser toolbar jump | `100vh` doesn't account for dynamic toolbar | Switched to `100svh` / `-webkit-fill-available` + `position:fixed` body |

---

## 📁 Project Structure

```
src/
├── SnakeGame.tsx   # Main game component (types, canvas draw, game logic, UI)
├── App.tsx         # Root component
├── main.tsx        # React DOM entry point
└── index.css       # Global reset + mobile viewport fixes
index.html          # SEO meta, viewport, structured data
vite.config.ts      # Vite config with base path for GitHub Pages
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📄 License

MIT © [Farmanullah Ansari](https://github.com/farmanullah1)