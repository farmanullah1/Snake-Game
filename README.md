# 🐍 Modern Snake Game

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff.svg?logo=vite)](https://vitejs.dev/)

> A sleek, high-performance Snake game built with React + TypeScript featuring **60+ FPS** gameplay, stunning glassmorphism UI, and mobile-first controls.

## 🎮 Live Demo

[**Play Now →**](https://farmanullah1.github.io/Snake-Game/)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **60+ FPS Performance** | Optimized game loop with delta-time accumulator and requestAnimationFrame |
| 📱 **Mobile-First Design** | Touch-friendly D-pad, swipe controls, and responsive canvas scaling |
| 🎨 **Glassmorphism UI** | Modern backdrop blur effects with smooth dark/light mode transitions |
| 🔊 **Web Audio API** | Procedural sound effects using OscillatorNode (no external files) |
| 🏆 **High Score Tracking** | Persistent leaderboard via localStorage |
| ⚡ **Power-Ups** | Ghost mode, shield, slow motion, and double score |
| 🔥 **Combo System** | Chain food collection for multiplier bonuses |
| 🌐 **Responsive Canvas** | DPR-aware rendering for crisp graphics on all displays |
| ♿ **Accessible Controls** | WCAG-compliant button sizes with aria-labels |

---

## 🛠️ Architecture & Performance Optimizations

### Key Technical Improvements

#### 1. Game State Management
```typescript
// ❌ BEFORE: Causes re-renders on every tick
const [snake, setSnake] = useState<Position[]>([]);
const [direction, setDirection] = useState<Direction>('RIGHT');

// ✅ AFTER: Mutable ref - zero re-renders during gameplay
const gameRef = useRef<GameRefData>({
  snake: [{ x: 10, y: 10 }],
  direction: 'RIGHT',
  nextDirection: 'RIGHT',
  // ... other mutable state
});
```

#### 2. Delta-Time Game Loop
```typescript
// Uses requestAnimationFrame with accumulator pattern
const animate = (currentTime: number) => {
  const deltaTime = currentTime - lastTimeRef.current;
  accumulatorRef.current += deltaTime;
  
  while (accumulatorRef.current >= effectiveTickRate) {
    tick();      // Update game logic
    syncUI();    // Sync only changed values to React state
    accumulatorRef.current -= effectiveTickRate;
  }
  
  drawCanvas();  // Render at full 60 FPS
};
```

#### 3. Selective UI Syncing
```typescript
const syncUI = useCallback(() => {
  setUiState(prev => {
    const updates: Partial<typeof prev> = {};
    
    // Only update if value actually changed
    if (prev.score !== game.score) updates.score = game.score;
    if (prev.level !== game.level) updates.level = game.level;
    
    return Object.keys(updates).length > 0 
      ? { ...prev, ...updates } 
      : prev;
  });
}, []);
```

#### 4. Canvas DPR Scaling
```typescript
// Handles high-DPI displays correctly
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.floor(boardSize * dpr);
canvas.height = Math.floor(boardSize * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

---

## 📋 Bug Fixes

| Issue | Root Cause | Solution |
|-------|------------|----------|
| **14 FPS on mobile** | 2-12 React re-renders per tick | Moved game state to `useRef`, added `syncUI()` |
| **Snake not moving** | Frozen state updates | Implemented proper delta-time accumulator loop |
| **No touch response** | Missing touch handlers | Added swipe detection + D-pad with proper thresholds |
| **Overlapping elements** | Fixed positioning | Flexbox layout with overflow handling |
| **Blurry canvas** | No DPR scaling | Applied `ctx.setTransform(dpr)` per frame |
| **Battery drain** | Running in background tabs | Early return when `document.hidden` is true |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/farmanullah1/Snake-Game.git
cd Snake-Game

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (hot reload) |
| `npm run build` | Production build with minification |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on source files |

---

## 🎮 Controls

### Desktop
- **Arrow Keys** / **WASD**: Move snake
- **P** / **Esc**: Pause/Resume
- **Enter** / **Space**: Start game

### Mobile
- **Swipe**: Change direction
- **D-Pad**: Precise directional control
- **Tap buttons**: Settings, theme toggle, mute

---

## 📱 Responsive Breakpoints

| Screen Size | Behavior |
|-------------|----------|
| 320px - 375px | Compact UI, smaller buttons |
| 376px - 768px | Standard mobile layout |
| 769px+ | Desktop layout (D-pad hidden) |
| Landscape | Scrollable shell for D-pad access |

---

## 🎨 Customization

### Modify Game Speed
Edit `INITIAL_SPEED` and `MIN_SPEED` constants in `SnakeGame.tsx`:
```typescript
const INITIAL_SPEED = 150;  // Starting tick rate (ms)
const MIN_SPEED = 60;       // Fastest possible (ms)
```

### Change Grid Size
```typescript
const GRID_SIZE = 20;  // Cells per row/column
```

### Adjust Power-Up Spawn Rate
```typescript
const POWER_UP_CHANCE = 0.15;  // 15% chance per food eaten
```

---

## 🤝 Contributing

Contributions are welcome! Please follow this workflow:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style Guidelines
- Use TypeScript strict mode
- Follow existing component patterns
- Add JSDoc comments for complex functions
- Test on both desktop and mobile viewports

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/)
- Bundled with [Vite](https://vitejs.dev/)
- Icons and SVG assets from community resources

---

## 📬 Contact

**Farmanullah Ansari** - [GitHub](https://github.com/farmanullah1)

Project Link: [https://github.com/farmanullah1/Snake-Game](https://github.com/farmanullah1/Snake-Game)

---

<div align="center">

**Made with ❤️ using React + TypeScript**

⭐ Star this repo if you enjoy the game!

</div>
