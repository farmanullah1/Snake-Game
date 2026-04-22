import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════
type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'OVER' | 'COUNTDOWN';
type GameMode = 'CLASSIC' | 'FREE_ROAM';
type Difficulty = 'CHILL' | 'NORMAL' | 'TURBO';
type PowerUpType = 'SHIELD' | 'SLOW' | 'DOUBLE' | 'GHOST_MODE';
type SkinId = 'classic' | 'neon' | 'fire' | 'ice' | 'gold' | 'rainbow';

type Achievement = {
  id: string;
  label: string;
  icon: string;
  desc: string;
  unlocked: boolean;
  ts?: number;
};

type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type HudState = {
  score: number;
  level: number;
  length: number;
  combo: number;
  activePower: { type: PowerUpType; ttl: number } | null;
  ghostMode: boolean;
  shieldActive: boolean;
  slowActive: boolean;
  doubleScore: boolean;
  totalTime: number;
  foodEaten: number;
  gameState: GameState;
  countdown: number;
  highScore: number;
};

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
const COLS = 20;
const ROWS = 20;
const LOGICAL_CELL = 20;
const LOGICAL_SIZE = LOGICAL_CELL * COLS;

const MIN_BOARD = 200;
const MAX_BOARD = 600;

const SPEED: Record<Difficulty, { base: number; min: number; inc: number }> = {
  CHILL:  { base: 200, min: 100, inc: 3 },
  NORMAL: { base: 140, min: 55,  inc: 5 },
  TURBO:  { base: 75,  min: 25,  inc: 7 },
};

const SKIN_DEFS: Record<SkinId, {
  name: string;
  head: [string, string];
  body: [string, string];
  glow: string;
  icon: string;
}> = {
  classic: { name:'Classic', head:['#0052d4','#4364f7'], body:['#00c6ff','#0072ff'], glow:'#0072ff', icon:'🔵' },
  neon:    { name:'Neon',    head:['#00ffa6','#00e5ff'], body:['#00ff87','#60efff'], glow:'#00ff87', icon:'💚' },
  fire:    { name:'Fire',    head:['#ff4e00','#ec9f05'], body:['#ff6b35','#f7c59f'], glow:'#ff4e00', icon:'🔥' },
  ice:     { name:'Ice',     head:['#a8edea','#fed6e3'], body:['#d3f9d8','#a8edea'], glow:'#a8edea', icon:'❄️' },
  gold:    { name:'Gold',    head:['#f7971e','#ffd200'], body:['#ffb347','#ffd700'], glow:'#ffd200', icon:'⭐' },
  rainbow: { name:'Rainbow', head:['#ff0080','#7928ca'], body:['#ff0080','#7928ca'], glow:'#ff0080', icon:'🌈' },
};

const DIFFS: Difficulty[] = ['CHILL', 'NORMAL', 'TURBO'];

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked'>[] = [
  { id:'first_food',  icon:'🍎', label:'First Bite',    desc:'Eat your first food' },
  { id:'score_50',    icon:'⭐', label:'Rising Star',    desc:'Score 50 points' },
  { id:'score_100',   icon:'🌟', label:'Century',        desc:'Score 100 points' },
  { id:'score_250',   icon:'💫', label:'Legend',         desc:'Score 250 points' },
  { id:'score_500',   icon:'🏆', label:'Champion',       desc:'Score 500 points' },
  { id:'length_10',   icon:'🐍', label:'Growing Strong', desc:'Reach length 10' },
  { id:'length_20',   icon:'🐉', label:'Dragon Mode',    desc:'Reach length 20' },
  { id:'survive_60',  icon:'🧱', label:'Wall Dodger',    desc:'Survive 60 seconds' },
  { id:'power_up',    icon:'⚡', label:'Powered Up',     desc:'Collect a power-up' },
  { id:'bonus_food',  icon:'✨', label:'Bonus Hunter',   desc:'Eat bonus food' },
  { id:'turbo_100',   icon:'🚀', label:'Speed Demon',    desc:'Score 100 in TURBO mode' },
  { id:'chill_250',   icon:'🧊', label:'Zen Master',     desc:'Score 250 in CHILL mode' },
  { id:'combo_5',     icon:'🔥', label:'Combo King',     desc:'5x food combo streak' },
  { id:'shield_used', icon:'🛡️', label:'Shielded',       desc:'Block a death with shield' },
];

const THEMES = {
  light: {
    bg:        ['#f0fffe','#e8f4fd','#f5f9ff'],
    gridLine:  'rgba(100,160,200,0.10)',
    border:    'rgba(0,114,255,0.18)',
    uiText:    '#0a0f1e',
    uiSub:     '#5a6a7a',
    uiAccent:  '#0072ff',
    uiAccent2: '#00c6ff',
    scoreBg:   'rgba(0,114,255,0.05)',
    btnPri:    'linear-gradient(135deg,#00c6ff,#0072ff)',
    btnPriTxt: '#fff',
    btnSec:    'rgba(0,114,255,0.08)',
    btnSecBdr: 'rgba(0,114,255,0.35)',
    btnSecTxt: '#0072ff',
    food1:     '#ff416c',
    food2:     '#ff4b2b',
    foodGlow:  '#ff416c',
    pauseOvl:  'rgba(240,255,254,0.88)',
    modalBg:   'rgba(248,255,254,0.97)',
    dark:      false,
  },
  dark: {
    bg:        ['#060614','#0d0b2b','#140a20'],
    gridLine:  'rgba(96,239,255,0.038)',
    border:    'rgba(96,239,255,0.18)',
    uiText:    '#e8f4ff',
    uiSub:     '#7a90b0',
    uiAccent:  '#60efff',
    uiAccent2: '#00ff87',
    scoreBg:   'rgba(96,239,255,0.055)',
    btnPri:    'linear-gradient(135deg,#00ff87,#60efff)',
    btnPriTxt: '#060614',
    btnSec:    'rgba(96,239,255,0.07)',
    btnSecBdr: 'rgba(96,239,255,0.35)',
    btnSecTxt: '#60efff',
    food1:     '#ff00cc',
    food2:     '#ff6a00',
    foodGlow:  '#ff00cc',
    pauseOvl:  'rgba(6,6,20,0.88)',
    modalBg:   'rgba(6,6,20,0.97)',
    dark:      true,
  },
};

type ThemeKey = 'light' | 'dark';
type Theme = typeof THEMES['light'];

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const randomCell = (exclude: Point[]): Point => {
  let p: Point;
  do {
    p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (exclude.some(e => e.x === p.x && e.y === p.y));
  return p;
};

const vibrate = (p: number | number[]) => {
  try { navigator.vibrate?.(p); } catch {}
};

const lsGet = (k: string, fb: string) => {
  try { return localStorage.getItem(k) ?? fb; } catch { return fb; }
};

const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch {}
};

// ═════════════════════════════════════════════════════════════════════════════
// SOUND ENGINE (Web Audio API)
// ═════════════════════════════════════════════════════════════════════════════
class SoundEngine {
  ctx: AudioContext | null = null;
  muted = false;

  private ensureCtx() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  private osc(freq: number, type: OscillatorType, duration: number, gainVal = 0.08) {
    if (this.muted || !this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration / 1000);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + duration / 1000);
  }

  playEat() {
    this.ensureCtx();
    this.osc(440, 'sine', 40, 0.06);
    setTimeout(() => this.osc(880, 'sine', 40, 0.06), 30);
  }

  playBonus() {
    this.ensureCtx();
    this.osc(600, 'square', 60, 0.04);
    setTimeout(() => this.osc(900, 'square', 60, 0.04), 70);
  }

  playPowerUp() {
    this.ensureCtx();
    this.osc(523, 'sine', 80, 0.06);
    setTimeout(() => this.osc(659, 'sine', 80, 0.06), 90);
    setTimeout(() => this.osc(784, 'sine', 120, 0.06), 180);
  }

  playDie() {
    this.ensureCtx();
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.1, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.3);
  }

  playTick() {
    this.ensureCtx();
    this.osc(1200, 'triangle', 20, 0.03);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CANVAS DRAWING
// ═════════════════════════════════════════════════════════════════════════════
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface DrawState {
  snake: Point[];
  food: { pos: Point; pulse: number };
  bonusFood: { pos: Point; ttl: number } | null;
  powerUp: { pos: Point; type: PowerUpType; pulse: number } | null;
  gameState: GameState;
  theme: Theme;
  dark: boolean;
  skin: SkinId;
  countdown: number;
  particles: Particle[];
  floats: FloatingText[];
  ghostMode: boolean;
  shieldActive: boolean;
  rainbowHue: number;
  showGrid: boolean;
}

function drawCanvas(ctx: CanvasRenderingContext2D, d: DrawState) {
  const { snake, food, bonusFood, powerUp, gameState, theme, dark, skin, countdown,
          particles, floats, ghostMode, shieldActive, rainbowHue, showGrid } = d;
  const C = LOGICAL_CELL;
  const W = LOGICAL_SIZE;
  const H = LOGICAL_SIZE;
  const T = theme;

  // Background
  const bgG = ctx.createLinearGradient(0, 0, W, H);
  T.bg.forEach((c, i) => bgG.addColorStop(i / (T.bg.length - 1), c));
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, W, H);

  // Scanlines (dark mode)
  if (dark) {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  // Grid
  if (showGrid) {
    ctx.strokeStyle = T.gridLine;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * C, 0); ctx.lineTo(i * C, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * C); ctx.lineTo(W, i * C); ctx.stroke();
    }
  }

  // Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = dark ? 8 : 3;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Power-up
  if (powerUp) {
    const px = powerUp.pos.x * C + C / 2;
    const py = powerUp.pos.y * C + C / 2;
    const pulse = 0.78 + Math.sin(powerUp.pulse) * 0.22;
    const r = (C / 2 - 1) * pulse;
    ctx.save();
    ctx.shadowColor = '#ffd200';
    ctx.shadowBlur = dark ? 22 : 10;
    const pG = ctx.createRadialGradient(px, py, 1, px, py, r);
    pG.addColorStop(0, '#fffacc');
    pG.addColorStop(1, '#ffd200');
    ctx.fillStyle = pG;
    rrect(ctx, px - r, py - r, r * 2, r * 2, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    const icons: Record<PowerUpType, string> = { SHIELD: '🛡', SLOW: '🐢', DOUBLE: '×2', GHOST_MODE: '👻' };
    ctx.font = `bold ${C - 5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[powerUp.type], px, py);
    ctx.restore();
  }

  // Bonus food
  if (bonusFood) {
    const bx = bonusFood.pos.x * C + C / 2;
    const by = bonusFood.pos.y * C + C / 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, bonusFood.ttl / 40);
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = dark ? 20 : 9;
    const bG = ctx.createRadialGradient(bx, by, 1, bx, by, C / 2 - 1);
    bG.addColorStop(0, '#ff00cc');
    bG.addColorStop(1, '#7b00ff');
    ctx.fillStyle = bG;
    rrect(ctx, bonusFood.pos.x * C + 2, bonusFood.pos.y * C + 2, C - 4, C - 4, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${C - 5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', bx, by);
    ctx.restore();
  }

  // Main food
  {
    const fx = food.pos.x * C + C / 2;
    const fy = food.pos.y * C + C / 2;
    const pulse = 0.84 + Math.sin(food.pulse) * 0.16;
    const r = (C / 2 - 1.5) * pulse;
    ctx.save();
    ctx.shadowColor = T.foodGlow;
    ctx.shadowBlur = dark ? 20 : 9;
    const fG = ctx.createRadialGradient(fx - r * 0.25, fy - r * 0.25, 0, fx, fy, r);
    fG.addColorStop(0, T.food1);
    fG.addColorStop(1, T.food2);
    ctx.fillStyle = fG;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(fx - r * 0.3, fy - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Snake
  const sk = SKIN_DEFS[skin];
  snake.forEach((seg, i) => {
    const x = seg.x * C + 1;
    const y = seg.y * C + 1;
    const sz = C - 2;
    const rad = i === 0 ? 7 : 4;
    const ratio = snake.length > 1 ? i / (snake.length - 1) : 0;
    ctx.save();
    ctx.globalAlpha = ghostMode ? (i === 0 ? 0.55 : 0.35) : 1;
    if (dark) {
      const hue = skin === 'rainbow' ? (rainbowHue + i * 18) % 360 : -1;
      ctx.shadowBlur = i === 0 ? 22 : 13;
      ctx.shadowColor = hue >= 0 ? `hsl(${hue},100%,60%)` : (i === 0 ? sk.head[0] : sk.glow);
    }
    let fill: string | CanvasGradient;
    if (skin === 'rainbow') {
      const h = (rainbowHue + i * 18) % 360;
      const h2 = (h + 30) % 360;
      const rg = ctx.createLinearGradient(x, y, x + sz, y + sz);
      rg.addColorStop(0, `hsl(${h},100%,${i === 0 ? 52 : 58}%)`);
      rg.addColorStop(1, `hsl(${h2},100%,62%)`);
      fill = rg;
    } else if (i === 0) {
      const hg = ctx.createLinearGradient(x, y, x + sz, y + sz);
      hg.addColorStop(0, sk.head[0]);
      hg.addColorStop(1, sk.head[1]);
      fill = hg;
    } else {
      const bg = ctx.createLinearGradient(x, y, x + sz, y + sz);
      bg.addColorStop(0, sk.body[0]);
      bg.addColorStop(1, sk.body[1]);
      ctx.globalAlpha = ghostMode ? 0.28 : (1 - ratio * 0.28);
      fill = bg;
    }
    ctx.fillStyle = fill;
    rrect(ctx, x, y, sz, sz, rad);
    ctx.fill();

    // Shield ring
    if (i === 0 && shieldActive) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffd200';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffd200';
      ctx.shadowBlur = 14;
      rrect(ctx, x - 2.5, y - 2.5, sz + 5, sz + 5, rad + 3);
      ctx.stroke();
      ctx.restore();
    }

    // Eyes
    if (i === 0) {
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      const hp = snake[0];
      const nx2 = snake[1] ?? { x: hp.x - 1, y: hp.y };
      const dx = hp.x - nx2.x;
      const dy = hp.y - nx2.y;
      const cx = hp.x * C + C / 2;
      const cy = hp.y * C + C / 2;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + dy * 4 + dx * 3, cy - dx * 4 + dy * 3, 2.8, 0, Math.PI * 2);
      ctx.arc(cx - dy * 4 + dx * 3, cy + dx * 4 + dy * 3, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#001133';
      ctx.beginPath();
      ctx.arc(cx + dy * 4 + dx * 4.3, cy - dx * 4 + dy * 4.3, 1.4, 0, Math.PI * 2);
      ctx.arc(cx - dy * 4 + dx * 4.3, cy + dx * 4 + dy * 4.3, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // Floating texts
  floats.forEach(ft => {
    ctx.save();
    ctx.font = `bold 13px 'Orbitron',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 8;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });

  // Pause overlay
  if (gameState === 'PAUSED') {
    ctx.fillStyle = T.pauseOvl;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.font = `900 34px 'Orbitron',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dark ? '#60efff' : '#0072ff';
    ctx.shadowColor = dark ? '#60efff' : '#0072ff';
    ctx.shadowBlur = dark ? 22 : 8;
    ctx.fillText('PAUSED', W / 2, H / 2 - 14);
    ctx.shadowBlur = 0;
    ctx.font = `600 11px 'Rajdhani',sans-serif`;
    ctx.fillStyle = dark ? '#7a90b0' : '#5a6a7a';
    ctx.fillText('PRESS SPACE TO RESUME', W / 2, H / 2 + 16);
    ctx.restore();
  }

  // Countdown
  if (gameState === 'COUNTDOWN') {
    ctx.fillStyle = T.pauseOvl;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.font = `900 68px 'Orbitron',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dark ? '#60efff' : '#0072ff';
    ctx.shadowColor = dark ? '#60efff' : '#0072ff';
    ctx.shadowBlur = dark ? 35 : 14;
    ctx.fillText(countdown > 0 ? String(countdown) : 'GO!', W / 2, H / 2);
    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// BOARD SIZE HOOK
// ═════════════════════════════════════════════════════════════════════════════
function useResponsiveBoardSize() {
  const calc = useCallback(() => {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const isLandscape = vw > vh;
    const isCompactW = vw <= 375;
    const isCompactH = vh <= 700;

    // Chrome budget: space needed for UI above and below canvas
    const chromeBudget = isLandscape
      ? (isCompactH ? 180 : 220)
      : (isCompactH
          ? (isCompactW ? 300 : 320)
          : (isCompactW ? 350 : 370));

    const hPad = isCompactW ? 16 : 24;
    const available = Math.min(vw - hPad, vh - chromeBudget);
    const raw = Math.max(MIN_BOARD, Math.min(MAX_BOARD, Math.floor(available)));
    // Snap to nearest multiple of COLS for pixel-perfect cells
    return Math.floor(raw / COLS) * COLS;
  }, []);

  const [size, setSize] = useState(calc);

  useEffect(() => {
    const update = () => setSize(calc());
    const vvp = window.visualViewport;
    if (vvp) {
      vvp.addEventListener('resize', update);
      vvp.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (vvp) {
        vvp.removeEventListener('resize', update);
        vvp.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [calc]);

  return size;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const SnakeGame: React.FC = () => {
  const boardSize = useResponsiveBoardSize();

  const vw = typeof window !== 'undefined' ? (window.visualViewport?.width ?? window.innerWidth) : 400;
  const vh = typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800;
  const isTiny = vw <= 340;
  const isCompact = vw <= 390 || vh <= 700;
  const isMobile = vw <= 768;
  const isLandscape = vw > vh;

  // ── Preferences (persisted) ─────────────────────────────────────────────
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => lsGet('sng_theme', 'light') as ThemeKey);
  const [skin, setSkin] = useState<SkinId>(() => lsGet('sng_skin', 'classic') as SkinId);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => lsGet('sng_diff', 'NORMAL') as Difficulty);
  const [gameMode, setGameMode] = useState<GameMode>(() => lsGet('sng_mode', 'CLASSIC') as GameMode);
  const [showGrid, setShowGrid] = useState(() => lsGet('sng_grid', '1') === '1');
  const [haptics, setHaptics] = useState(() => lsGet('sng_haptic', '1') === '1');
  const [soundOn, setSoundOn] = useState(() => lsGet('sng_sound', '1') === '1');

  const T = THEMES[themeKey];
  const isDark = themeKey === 'dark';

  useEffect(() => { lsSet('sng_theme', themeKey); }, [themeKey]);
  useEffect(() => { lsSet('sng_skin', skin); }, [skin]);
  useEffect(() => { lsSet('sng_diff', difficulty); }, [difficulty]);
  useEffect(() => { lsSet('sng_mode', gameMode); }, [gameMode]);
  useEffect(() => { lsSet('sng_grid', showGrid ? '1' : '0'); }, [showGrid]);
  useEffect(() => { lsSet('sng_haptic', haptics ? '1' : '0'); }, [haptics]);
  useEffect(() => { lsSet('sng_sound', soundOn ? '1' : '0'); }, [soundOn]);

  // ── Sound engine ────────────────────────────────────────────────────────
  const soundRef = useRef(new SoundEngine());
  useEffect(() => { soundRef.current.muted = !soundOn; }, [soundOn]);

  // ── High scores & achievements ──────────────────────────────────────────
  const [highScores, setHighScores] = useState<Record<Difficulty, number>>(() => {
    try { return JSON.parse(lsGet('sng_hs2', 'null')) ?? { CHILL: 0, NORMAL: 0, TURBO: 0 }; }
    catch { return { CHILL: 0, NORMAL: 0, TURBO: 0 }; }
  });
  const highScoresRef = useRef(highScores);
  useEffect(() => { highScoresRef.current = highScores; }, [highScores]);

  const [savedLevels, setSavedLevels] = useState<Record<GameMode, number>>(() => {
    try { return JSON.parse(lsGet('sng_saved_levels', 'null')) ?? { CLASSIC: 1, FREE_ROAM: 1 }; }
    catch { return { CLASSIC: 1, FREE_ROAM: 1 }; }
  });

  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    try {
      const saved = JSON.parse(lsGet('sng_ach', '[]')) as { id: string; ts?: number }[];
      return ACHIEVEMENT_DEFS.map(d => ({
        ...d,
        unlocked: saved.some(s => s.id === d.id),
        ts: saved.find(s => s.id === d.id)?.ts,
      }));
    } catch {
      return ACHIEVEMENT_DEFS.map(d => ({ ...d, unlocked: false }));
    }
  });

  const [newAch, setNewAch] = useState<Achievement | null>(null);
  const achTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlock = useCallback((id: string) => {
    setAchievements(prev => {
      if (prev.find(a => a.id === id)?.unlocked) return prev;
      const next = prev.map(a => a.id === id ? { ...a, unlocked: true, ts: Date.now() } : a);
      lsSet('sng_ach', JSON.stringify(next.filter(a => a.unlocked).map(a => ({ id: a.id, ts: a.ts }))));
      const ach = next.find(a => a.id === id)!;
      setNewAch(ach);
      if (achTimerRef.current) clearTimeout(achTimerRef.current);
      achTimerRef.current = setTimeout(() => setNewAch(null), 3600);
      return next;
    });
  }, []);

  // ── Game ref (ALL mutable game state) ───────────────────────────────────
  const INIT_SNAKE: Point[] = useMemo(() => [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], []);

  const gameRef = useRef({
    snake: INIT_SNAKE,
    direction: 'RIGHT' as Direction,
    pendingDir: 'RIGHT' as Direction,
    queuedDir: null as Direction | null,
    inputLocked: false,
    food: { pos: randomCell(INIT_SNAKE), pulse: 0 },
    bonusFood: null as { pos: Point; ttl: number } | null,
    powerUp: null as { pos: Point; type: PowerUpType; pulse: number } | null,
    activePower: null as { type: PowerUpType; ttl: number } | null,
    gameState: 'IDLE' as GameState,
    score: 0,
    level: 1,
    countdown: 3,
    countdownAcc: 0,
    comboStreak: 0,
    comboTimer: 0,
    ghostMode: false,
    shieldActive: false,
    slowActive: false,
    doubleScore: false,
    totalTime: 0,
    timeAcc: 0,
    foodEaten: 0,
    particles: [] as Particle[],
    floats: [] as FloatingText[],
    floatId: 0,
    pulse: 0,
    rainbowHue: 0,
  });

  // ── HUD state (only what React needs to render) ─────────────────────────
  const defaultHud: HudState = {
    score: 0, level: 1, length: 3, combo: 0, activePower: null,
    ghostMode: false, shieldActive: false, slowActive: false,
    doubleScore: false, totalTime: 0, foodEaten: 0,
    gameState: 'IDLE', countdown: 3, highScore: 0,
  };

  const hudRef = useRef<HudState>(defaultHud);
  const [hud, setHud] = useState<HudState>(defaultHud);

  const syncUI = useCallback(() => {
    const g = gameRef.current;
    const next: HudState = {
      score: g.score,
      level: g.level,
      length: g.snake.length,
      combo: g.comboStreak,
      activePower: g.activePower,
      ghostMode: g.ghostMode,
      shieldActive: g.shieldActive,
      slowActive: g.slowActive,
      doubleScore: g.doubleScore,
      totalTime: g.totalTime,
      foodEaten: g.foodEaten,
      gameState: g.gameState,
      countdown: g.countdown,
      highScore: highScoresRef.current[difficulty] ?? 0,
    };

    const keys = Object.keys(next) as (keyof HudState)[];
    const changed = keys.some(k => next[k] !== hudRef.current[k]);
    if (changed) {
      hudRef.current = next;
      setHud(next);
    }
  }, [difficulty]);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [panel, setPanel] = useState<null | 'settings' | 'skins' | 'achievements' | 'scores'>(null);

  // ── Canvas ref ──────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dprRef = useRef(Math.max(1, Math.min(window.devicePixelRatio || 1, 3)));

  // Resize canvas buffer on DPR change
  useEffect(() => {
    const mq = window.matchMedia(`(resolution: ${dprRef.current}dppx)`);
    const handler = () => {
      dprRef.current = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = dprRef.current;
    canvas.width = Math.round(LOGICAL_SIZE * dpr);
    canvas.height = Math.round(LOGICAL_SIZE * dpr);
    canvas.style.width = `${boardSize}px`;
    canvas.style.height = `${boardSize}px`;
  }, [boardSize]);

  // ── Game logic helpers ──────────────────────────────────────────────────
  const getTickRate = useCallback((sc: number, diff: Difficulty, slow: boolean): number => {
    const { base, min, inc } = SPEED[diff];
    const s = Math.max(min, base - Math.floor(sc / 5) * inc);
    return slow ? Math.round(s * 1.65) : s;
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string, n = 13) => {
    const g = gameRef.current;
    const next = [...g.particles.slice(-90)];
    for (let i = 0; i < n; i++) {
      next.push({
        x, y,
        vx: (Math.random() - 0.5) * 4.5,
        vy: (Math.random() - 0.5) * 4.5 - 0.8,
        life: 0.8 + Math.random() * 0.2,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
    g.particles = next;
  }, []);

  const addFloat = useCallback((x: number, y: number, text: string, color: string) => {
    const g = gameRef.current;
    g.floatId++;
    g.floats = [...g.floats.slice(-10), { id: g.floatId, x, y, text, color, life: 1 }];
  }, []);

  // ── Core tick (mutates gameRef, ZERO React re-renders) ──────────────────
  const tick = useCallback(() => {
    const g = gameRef.current;
    if (g.gameState !== 'RUNNING') return;

    const cur = g.snake;
    const d = g.pendingDir;
    const head = cur[0];

    let nx = head.x;
    let ny = head.y;
    if (d === 'UP') ny--;
    if (d === 'DOWN') ny++;
    if (d === 'LEFT') nx--;
    if (d === 'RIGHT') nx++;

    // Wall collision / wrap
    if (gameMode === 'FREE_ROAM') {
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      if (g.shieldActive) {
        g.shieldActive = false;
        nx = Math.max(0, Math.min(COLS - 1, nx));
        ny = Math.max(0, Math.min(ROWS - 1, ny));
        if (haptics) vibrate([40, 20, 40]);
        unlock('shield_used');
      } else {
        if (haptics) vibrate([60, 40, 200]);
        g.gameState = 'OVER';
        soundRef.current.playDie();
        return;
      }
    }

    const nh = { x: nx, y: ny };

    // Self collision
    if (!g.ghostMode && cur.slice(0, -1).some(s => s.x === nx && s.y === ny)) {
      if (g.shieldActive) {
        g.shieldActive = false;
        if (haptics) vibrate([40, 20, 40]);
        unlock('shield_used');
      } else {
        if (haptics) vibrate([60, 40, 200]);
        g.gameState = 'OVER';
        soundRef.current.playDie();
        return;
      }
    }

    const ateMain = nh.x === g.food.pos.x && nh.y === g.food.pos.y;
    const ateBonus = g.bonusFood && nh.x === g.bonusFood.pos.x && nh.y === g.bonusFood.pos.y;
    const atePU = g.powerUp && nh.x === g.powerUp.pos.x && nh.y === g.powerUp.pos.y;
    const newSnake = ateMain || ateBonus ? [nh, ...cur] : [nh, ...cur.slice(0, -1)];

    // Consume queued direction
    const nextQ = g.queuedDir;
    if (nextQ && nextQ !== OPPOSITE[d] && nextQ !== d) {
      g.pendingDir = nextQ;
      g.queuedDir = null;
      g.inputLocked = true;
    } else {
      g.inputLocked = false;
    }

    g.snake = newSnake;
    g.direction = d;

    if (ateMain) {
      g.foodEaten++;
      g.comboStreak++;
      g.comboTimer = 2600;

      const pts = (10 + (g.comboStreak > 1 ? g.comboStreak * 2 : 0)) * (g.doubleScore ? 2 : 1);
      g.score += pts;
      g.level = Math.floor(g.score / 50) + 1;

      const px = nh.x * LOGICAL_CELL + LOGICAL_CELL / 2;
      const py = nh.y * LOGICAL_CELL + LOGICAL_CELL / 2;
      spawnParticles(px, py, T.foodGlow, 14);
      addFloat(px, py, g.comboStreak > 1 ? `+${pts} ×${g.comboStreak}` : `+${pts}`, isDark ? '#60efff' : '#0072ff');
      if (haptics) vibrate(7);
      soundRef.current.playEat();

      g.food = { pos: randomCell(newSnake), pulse: g.pulse };

      if (Math.random() < 0.22 && !g.bonusFood) {
        g.bonusFood = { pos: randomCell(newSnake), ttl: 130 };
      }
      if (Math.random() < 0.13 && !g.powerUp) {
        const types: PowerUpType[] = ['SHIELD', 'SLOW', 'DOUBLE', 'GHOST_MODE'];
        g.powerUp = { pos: randomCell(newSnake), type: types[Math.floor(Math.random() * 4)], pulse: g.pulse };
      }

      // Persist high score
      const best = highScoresRef.current[difficulty] ?? 0;
      if (g.score > best) {
        const next = { ...highScoresRef.current, [difficulty]: g.score };
        highScoresRef.current = next;
        setHighScores(next);
        lsSet('sng_hs2', JSON.stringify(next));
      }

      // Persist level
      setSavedLevels(prev => {
        const bestLevel = prev[gameMode] ?? 1;
        if (g.level > bestLevel) {
          const next = { ...prev, [gameMode]: g.level };
          lsSet('sng_saved_levels', JSON.stringify(next));
          return next;
        }
        return prev;
      });

      // Achievements
      if (g.foodEaten === 1) unlock('first_food');
      if (g.score >= 50) unlock('score_50');
      if (g.score >= 100) unlock('score_100');
      if (g.score >= 250) unlock('score_250');
      if (g.score >= 500) unlock('score_500');
      if (newSnake.length >= 10) unlock('length_10');
      if (newSnake.length >= 20) unlock('length_20');
      if (g.comboStreak >= 5) unlock('combo_5');
      if (g.score >= 100 && difficulty === 'TURBO') unlock('turbo_100');
      if (g.score >= 250 && difficulty === 'CHILL') unlock('chill_250');
    }

    if (ateBonus && g.bonusFood) {
      g.bonusFood = null;
      const pts = g.doubleScore ? 50 : 25;
      g.score += pts;

      const best = highScoresRef.current[difficulty] ?? 0;
      if (g.score > best) {
        const next = { ...highScoresRef.current, [difficulty]: g.score };
        highScoresRef.current = next;
        setHighScores(next);
        lsSet('sng_hs2', JSON.stringify(next));
      }

      const px = nh.x * LOGICAL_CELL + LOGICAL_CELL / 2;
      const py = nh.y * LOGICAL_CELL + LOGICAL_CELL / 2;
      spawnParticles(px, py, '#ff00cc', 20);
      addFloat(px, py, `+${pts}★`, '#ff00cc');
      if (haptics) vibrate([8, 4, 8]);
      soundRef.current.playBonus();
      unlock('bonus_food');
    }

    if (atePU && g.powerUp) {
      const pt = g.powerUp.type;
      g.powerUp = null;
      g.activePower = { type: pt, ttl: 200 };

      const px = nh.x * LOGICAL_CELL + LOGICAL_CELL / 2;
      const py = nh.y * LOGICAL_CELL + LOGICAL_CELL / 2;
      spawnParticles(px, py, '#ffd200', 18);
      const labs: Record<PowerUpType, string> = { SHIELD: '🛡 SHIELD!', SLOW: '🐢 SLOW-MO!', DOUBLE: '×2 DOUBLE!', GHOST_MODE: '👻 GHOST!' };
      addFloat(px, py, labs[pt], '#ffd200');
      if (haptics) vibrate([5, 3, 5, 3, 10]);
      soundRef.current.playPowerUp();

      if (pt === 'SHIELD') g.shieldActive = true;
      if (pt === 'SLOW') g.slowActive = true;
      if (pt === 'DOUBLE') g.doubleScore = true;
      if (pt === 'GHOST_MODE') g.ghostMode = true;
      unlock('power_up');
    }

    // Bonus food timer
    if (g.bonusFood) {
      g.bonusFood.ttl--;
      if (g.bonusFood.ttl <= 0) g.bonusFood = null;
    }

    // Active power-up timer
    if (g.activePower) {
      g.activePower.ttl--;
      if (g.activePower.ttl <= 0) {
        const tp = g.activePower.type;
        if (tp === 'SHIELD') g.shieldActive = false;
        if (tp === 'SLOW') g.slowActive = false;
        if (tp === 'DOUBLE') g.doubleScore = false;
        if (tp === 'GHOST_MODE') g.ghostMode = false;
        g.activePower = null;
      }
    }

    // Combo timer
    if (g.comboTimer > 0) {
      g.comboTimer -= getTickRate(g.score, difficulty, g.slowActive);
      if (g.comboTimer <= 0) g.comboStreak = 0;
    }
  }, [gameMode, difficulty, haptics, isDark, T.foodGlow, unlock, spawnParticles, addFloat, getTickRate]);

  // ── Start / Reset ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.snake = INIT_SNAKE;
    g.direction = 'RIGHT';
    g.pendingDir = 'RIGHT';
    g.queuedDir = null;
    g.inputLocked = false;
    g.food = { pos: randomCell(INIT_SNAKE), pulse: 0 };
    g.bonusFood = null;
    g.powerUp = null;
    g.activePower = null;
    g.gameState = 'COUNTDOWN';
    g.score = 0;
    g.level = 1;
    g.countdown = 3;
    g.countdownAcc = 0;
    g.comboStreak = 0;
    g.comboTimer = 0;
    g.ghostMode = false;
    g.shieldActive = false;
    g.slowActive = false;
    g.doubleScore = false;
    g.totalTime = 0;
    g.timeAcc = 0;
    g.foodEaten = 0;
    g.particles = [];
    g.floats = [];
    g.pulse = 0;
    soundRef.current.playTick();
    syncUI();
  }, [INIT_SNAKE, syncUI]);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.gameState === 'RUNNING') {
      g.gameState = 'PAUSED';
    } else if (g.gameState === 'PAUSED') {
      g.gameState = 'RUNNING';
    }
    syncUI();
  }, [syncUI]);

  // ── Input handling ──────────────────────────────────────────────────────
  const requestDirection = useCallback((next: Direction, vibratePattern?: number | number[]) => {
    const g = gameRef.current;
    const intended = g.inputLocked ? g.pendingDir : g.direction;
    if (next === intended || next === g.queuedDir) return false;
    if (next === OPPOSITE[intended]) return false;

    if (!g.inputLocked) {
      g.pendingDir = next;
      g.queuedDir = null;
      g.inputLocked = true;
      if (haptics && vibratePattern !== undefined) vibrate(vibratePattern);
      soundRef.current.playTick();
      return true;
    }
    if (!g.queuedDir && next !== OPPOSITE[g.pendingDir]) {
      g.queuedDir = next;
      if (haptics && vibratePattern !== undefined) vibrate(vibratePattern);
      soundRef.current.playTick();
      return true;
    }
    return false;
  }, [haptics]);

  // Keyboard
  useEffect(() => {
    const km: Record<string, Direction> = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
      W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
    };
    const h = (e: KeyboardEvent) => {
      if ([' ', 'Escape', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
        const g = gameRef.current;
        if (g.gameState === 'RUNNING' || g.gameState === 'PAUSED') togglePause();
        return;
      }
      if (e.key === 'Enter' && (gameRef.current.gameState === 'IDLE' || gameRef.current.gameState === 'OVER')) {
        startGame();
        return;
      }
      const nd = km[e.key];
      if (nd) {
        e.preventDefault();
        requestDirection(nd);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [requestDirection, togglePause, startGame]);

  // Swipe handling (Pointer events for universal touch/mouse support)
  const swipeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef(false);

  const SWIPE_THRESHOLD = useMemo(() => Math.max(20, Math.round(boardSize * 0.07)), [boardSize]);
  const AXIS_RATIO = 1.3;

  const trySwipe = useCallback((dx: number, dy: number) => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dominant = Math.max(absX, absY);
    const weaker = Math.min(absX, absY);
    if (dominant < SWIPE_THRESHOLD) return false;
    if (weaker > dominant / AXIS_RATIO) return false;
    const nd: Direction = absX > absY ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP');
    return requestDirection(nd, 6);
  }, [SWIPE_THRESHOLD, requestDirection]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      swipeOriginRef.current = { x: e.clientX, y: e.clientY };
      swipeHandledRef.current = false;
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!swipeOriginRef.current || swipeHandledRef.current) return;
    const dx = e.clientX - swipeOriginRef.current.x;
    const dy = e.clientY - swipeOriginRef.current.y;
    if (trySwipe(dx, dy)) {
      swipeHandledRef.current = true;
      swipeOriginRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [trySwipe]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!swipeOriginRef.current) return;
    if (!swipeHandledRef.current) {
      trySwipe(e.clientX - swipeOriginRef.current.x, e.clientY - swipeOriginRef.current.y);
    }
    swipeOriginRef.current = null;
    swipeHandledRef.current = false;
  }, [trySwipe]);

  // D-pad
  const [pressedDir, setPressedDir] = useState<Direction | null>(null);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dStart = useCallback((d: Direction) => {
    if (holdRef.current) clearInterval(holdRef.current);
    setPressedDir(d);
    requestDirection(d, 8);
    holdRef.current = setInterval(() => requestDirection(d), 130);
  }, [requestDirection]);

  const dEnd = useCallback(() => {
    setPressedDir(null);
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => () => {
    if (holdRef.current) clearInterval(holdRef.current);
    if (achTimerRef.current) clearTimeout(achTimerRef.current);
  }, []);

  // ── MAIN GAME LOOP (requestAnimationFrame + delta time) ─────────────────
  useEffect(() => {
    let af: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      // Skip when tab is hidden to save battery
      if (document.hidden) {
        af = requestAnimationFrame(loop);
        return;
      }

      const delta = now - lastTime;
      lastTime = now;
      const g = gameRef.current;

      // Update visual animations (runs every frame at 60 FPS)
      g.pulse += 0.08;
      g.rainbowHue = (g.rainbowHue + 1.5) % 360;

      // Update particles
      g.particles = g.particles
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.07, life: p.life - 0.024 }))
        .filter(p => p.life > 0);

      // Update floats
      g.floats = g.floats
        .map(f => ({ ...f, y: f.y - 0.85 }))
        .filter(f => f.y > -20);

      // Countdown logic
      if (g.gameState === 'COUNTDOWN') {
        g.countdownAcc += delta;
        if (g.countdownAcc >= 800) {
          g.countdownAcc -= 800;
          g.countdown--;
          if (g.countdown <= 0) {
            g.gameState = 'RUNNING';
            g.countdown = 0;
          } else {
            soundRef.current.playTick();
          }
          syncUI();
        }
      }

      // One-second timer
      if (g.gameState === 'RUNNING') {
        g.timeAcc += delta;
        if (g.timeAcc >= 1000) {
          g.timeAcc -= 1000;
          g.totalTime++;
          if (g.totalTime >= 60) unlock('survive_60');
        }
      }

      // Game tick accumulator
      if (g.gameState === 'RUNNING') {
        const tickRate = getTickRate(g.score, difficulty, g.slowActive);
        g.lastTick = (g.lastTick || 0) + delta;
        while (g.lastTick >= tickRate) {
          tick();
          g.lastTick -= tickRate;
        }
      }

      // Sync UI only when needed
      if (g.gameState !== 'COUNTDOWN') {
        syncUI();
      }

      // Draw canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = dprRef.current;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawCanvas(ctx, {
            snake: g.snake,
            food: { ...g.food, pulse: g.pulse },
            bonusFood: g.bonusFood,
            powerUp: g.powerUp ? { ...g.powerUp, pulse: g.pulse } : null,
            gameState: g.gameState,
            theme: T,
            dark: isDark,
            skin,
            countdown: g.countdown,
            particles: g.particles,
            floats: g.floats,
            ghostMode: g.ghostMode,
            shieldActive: g.shieldActive,
            rainbowHue: g.rainbowHue,
            showGrid,
          });
        }
      }

      af = requestAnimationFrame(loop);
    };

    af = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(af);
  }, [T, isDark, skin, showGrid, difficulty, tick, syncUI, getTickRate, unlock]);

  // ── Derived values ──────────────────────────────────────────────────────
  const isRunning = hud.gameState === 'RUNNING';
  const isOver = hud.gameState === 'OVER';
  const isIdle = hud.gameState === 'IDLE';
  const isPaused = hud.gameState === 'PAUSED';
  const isCounting = hud.gameState === 'COUNTDOWN';
  const unlockedCnt = achievements.filter(a => a.unlocked).length;

  const dPadBtnSize = Math.max(46, Math.min(64, vw * 0.12));

  const speedLabel = useMemo(() => {
    const { base, inc } = SPEED[difficulty];
    return Math.round((base - getTickRate(hud.score, difficulty, hud.slowActive)) / inc + 1);
  }, [hud.score, difficulty, hud.slowActive, getTickRate]);

  // ── Styles ──────────────────────────────────────────────────────────────
  const rootGradient = isDark
    ? 'radial-gradient(circle at top left, rgba(96,239,255,0.20), transparent 34%), radial-gradient(circle at bottom right, rgba(255,0,204,0.16), transparent 30%), linear-gradient(145deg,#040511 0%,#0c1028 42%,#140a20 100%)'
    : 'radial-gradient(circle at top left, rgba(0,198,255,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(255,99,146,0.16), transparent 30%), linear-gradient(145deg,#f7fffe 0%,#eef5ff 45%,#edf3ff 100%)';

  const glassPanel: React.CSSProperties = {
    background: isDark ? 'rgba(11,16,36,0.58)' : 'rgba(255,255,255,0.58)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)'}`,
    boxShadow: isDark
      ? '0 18px 44px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)'
      : '0 20px 40px rgba(90,125,170,0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  };

  const softInset = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 30px rgba(0,0,0,0.22)'
    : 'inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -14px 30px rgba(123,161,214,0.12)';

  const btnPri: React.CSSProperties = {
    background: T.btnPri,
    color: T.btnPriTxt,
    border: 'none',
    borderRadius: '14px',
    fontFamily: "'Orbitron',monospace",
    fontWeight: 800,
    fontSize: isTiny ? '10px' : isCompact ? '11px' : '12px',
    letterSpacing: '0.12em',
    padding: isTiny ? '9px 12px' : isCompact ? '10px 14px' : '11px 20px',
    cursor: 'pointer',
    boxShadow: isDark
      ? `0 18px 34px ${T.uiAccent2}20, inset 0 1px 0 rgba(255,255,255,0.18)`
      : '0 16px 30px rgba(0,114,255,0.18), inset 0 1px 0 rgba(255,255,255,0.55)',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
  };

  const btnSec: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)',
    color: T.btnSecTxt,
    border: `1px solid ${T.btnSecBdr}`,
    borderRadius: '14px',
    fontFamily: "'Orbitron',monospace",
    fontWeight: 700,
    fontSize: isTiny ? '10px' : isCompact ? '11px' : '12px',
    letterSpacing: '0.1em',
    padding: isTiny ? '8px 10px' : isCompact ? '9px 12px' : '10px 16px',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, background 0.18s ease',
    backdropFilter: 'blur(12px)',
  };

  const scoreBox: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(180deg, rgba(20,26,52,0.70), rgba(8,10,26,0.72))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(243,248,255,0.86))',
    border: `1px solid ${T.border}`,
    borderRadius: '16px',
    padding: isTiny ? '8px 10px' : isCompact ? '10px 12px' : '12px 14px',
    textAlign: 'center',
    boxShadow: `${glassPanel.boxShadow}, ${softInset}`,
  };

  // ── Panel components ────────────────────────────────────────────────────
  const PanelShell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: isDark ? 'rgba(6,8,20,0.82)' : 'rgba(240,247,255,0.78)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 12px', overflowY: 'auto', gap: '10px',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    }}>
      {children}
    </div>
  );

  const panelTitle = (txt: string) => (
    <h2 style={{
      fontFamily: "'Orbitron',monospace", color: T.uiAccent, margin: 0,
      letterSpacing: '0.14em', fontSize: 'clamp(15px,4vw,20px)', textTransform: 'uppercase',
      textShadow: isDark ? `0 0 24px ${T.uiAccent}55` : '0 8px 22px rgba(0,114,255,0.16)',
    }}>
      {txt}
    </h2>
  );

  const DBtn = ({ d, lbl, ariaLabel }: { d: Direction; lbl: string; ariaLabel: string }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      style={{
        width: dPadBtnSize,
        height: dPadBtnSize,
        borderRadius: '12px',
        background: pressedDir === d ? `${T.uiAccent}33` : (isDark ? 'rgba(18,24,46,0.72)' : 'rgba(255,255,255,0.72)'),
        border: `1.5px solid ${pressedDir === d ? T.uiAccent : T.border}`,
        color: pressedDir === d ? T.uiAccent : T.uiSub,
        fontSize: isTiny ? '16px' : '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.08s',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
        boxShadow: pressedDir === d
          ? `0 10px 22px ${T.uiAccent}22, inset 0 1px 0 rgba(255,255,255,0.18)`
          : `${softInset}, 0 8px 18px rgba(0,0,0,0.08)`,
        backdropFilter: 'blur(16px)',
      }}
      onPointerDown={(e) => { e.preventDefault(); dStart(d); }}
      onPointerUp={dEnd}
      onPointerLeave={dEnd}
      onPointerCancel={dEnd}
    >
      {lbl}
    </button>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html { height: 100%; }
        body { height: 100%; overflow: hidden; overscroll-behavior: none; position: fixed; width: 100%; }
        #root { width:100%; height:100%; }
        button { outline:none; -webkit-tap-highlight-color:transparent; }
        button:active { transform:scale(0.93); }
        @keyframes achSlide{from{transform:translateX(110%);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseGlow{0%,100%{opacity:0.8;}50%{opacity:1;}}
        @keyframes floatOrb{0%,100%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(0,-16px,0) scale(1.06);}}
        @keyframes softSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes staggerIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: rootGradient,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Rajdhani',sans-serif",
        overflow: 'hidden',
        transition: 'background 0.5s',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}>
        {/* Ambient orbs */}
        <div style={{
          position: 'absolute', inset: '-8% auto auto -12%', width: '42vw', height: '42vw',
          minWidth: 180, minHeight: 180, borderRadius: '50%',
          background: isDark ? 'rgba(96,239,255,0.13)' : 'rgba(0,198,255,0.14)',
          filter: 'blur(22px)', animation: 'floatOrb 9s ease-in-out infinite', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 'auto -10% -14% auto', width: '38vw', height: '38vw',
          minWidth: 180, minHeight: 180, borderRadius: '50%',
          background: isDark ? 'rgba(255,0,204,0.12)' : 'rgba(255,120,120,0.12)',
          filter: 'blur(24px)', animation: 'floatOrb 12s ease-in-out infinite reverse', pointerEvents: 'none',
        }} />

        {/* Main shell */}
        <div style={{
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          maxWidth: isLandscape ? '900px' : '580px',
          padding: isTiny ? '6px' : isCompact ? '8px' : '10px 12px',
          gap: isTiny ? '4px' : isCompact ? '5px' : '7px',
          alignItems: 'stretch', position: 'relative', zIndex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {/* Top Bar */}
          <div style={{
            ...glassPanel,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '6px', flexShrink: 0, flexWrap: 'nowrap',
            padding: isTiny ? '10px' : isCompact ? '10px 12px' : '12px 16px',
            borderRadius: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <h1 style={{
                fontFamily: "'Orbitron',monospace", fontWeight: 900,
                fontSize: isTiny ? '14px' : isCompact ? '16px' : 'clamp(16px,3.4vw,22px)',
                color: T.uiAccent, letterSpacing: '0.2em',
                textShadow: isDark ? `0 0 22px ${T.uiAccent}99` : '0 10px 24px rgba(0,114,255,0.18)',
                margin: 0, flexShrink: 0,
              }}>
                SNAKE
              </h1>
              <span style={{
                fontFamily: "'Orbitron',monospace", fontSize: '9px', fontWeight: 700,
                color: T.uiAccent2, background: `${T.uiAccent2}18`,
                border: `1px solid ${T.uiAccent2}44`, borderRadius: '999px',
                padding: '3px 6px', flexShrink: 0,
              }}>
                LV{hud.level}
              </span>
              {gameMode === 'FREE_ROAM' && (
                <span style={{
                  fontSize: '8px', color: T.uiAccent2, fontWeight: 700,
                  background: `${T.uiAccent2}14`, border: `1px solid ${T.uiAccent2}33`,
                  borderRadius: '4px', padding: '1px 4px', flexShrink: 0,
                }}>
                  🌀WRAP
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              {[
                { icon: '🎨', tip: 'Skins', p: 'skins' as const },
                { icon: '🏆', tip: 'Achievements', p: 'achievements' as const },
                { icon: '📊', tip: 'Scores', p: 'scores' as const },
                { icon: '⚙️', tip: 'Settings', p: 'settings' as const },
              ].map(btn => (
                <button key={btn.p} title={btn.tip} onClick={() => setPanel(btn.p)} style={{
                  ...glassPanel, border: `1px solid ${T.border}`, borderRadius: '12px',
                  color: T.uiSub, cursor: 'pointer',
                  padding: isTiny ? '6px 7px' : '7px 8px',
                  fontSize: isTiny ? '12px' : '13px',
                  lineHeight: '1', display: 'flex', alignItems: 'center', gap: '3px',
                  transition: 'transform 0.18s ease',
                }}>
                  {btn.icon}
                  {btn.p === 'achievements' && (
                    <span style={{ fontSize: '8px', color: T.uiAccent }}>{unlockedCnt}</span>
                  )}
                </button>
              ))}
              <button style={{
                ...glassPanel, border: `1px solid ${T.border}`, borderRadius: '12px',
                color: isDark ? '#ffd200' : T.uiSub, cursor: 'pointer',
                padding: isTiny ? '6px 7px' : '7px 8px',
                fontSize: isTiny ? '12px' : '13px',
                transition: 'transform 0.18s ease',
              }} onClick={() => setThemeKey(k => k === 'dark' ? 'light' : 'dark')}>
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* Score Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isTiny ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))',
            gap: isTiny ? '4px' : '6px',
            flexShrink: 0,
          }}>
            {[
              { l: 'Score', v: hud.score, accent: false },
              { l: 'Best', v: hud.highScore, accent: true },
              { l: 'Speed', v: `${speedLabel}x`, accent: false },
              { l: 'Length', v: hud.length, accent: false },
            ].map(it => (
              <div key={it.l} style={{ ...scoreBox, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', inset: '0 auto auto 0', width: '40%', height: '1px',
                  background: `linear-gradient(90deg, ${T.uiAccent}66, transparent)`,
                }} />
                <span style={{
                  display: 'block', fontSize: '7px', fontWeight: 700,
                  letterSpacing: '0.16em', color: T.uiSub, textTransform: 'uppercase', marginBottom: '4px',
                }}>
                  {it.l}
                </span>
                <span style={{
                  display: 'block', fontFamily: "'Orbitron',monospace",
                  fontSize: isTiny ? '12px' : isCompact ? '13px' : 'clamp(12px,2.5vw,17px)',
                  fontWeight: 800, color: it.accent ? T.uiAccent : T.uiText, lineHeight: '1.1',
                }}>
                  {it.v}
                </span>
              </div>
            ))}
          </div>

          {/* Canvas Area */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 0, position: 'relative',
          }}>
            <div
              style={{
                position: 'relative', width: boardSize, height: boardSize,
                borderRadius: '24px', overflow: 'hidden',
                background: isDark ? 'rgba(8,12,28,0.56)' : 'rgba(255,255,255,0.60)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)'}`,
                boxShadow: isDark
                  ? `0 20px 50px rgba(0,0,0,0.45), 0 0 0 1.5px ${T.border}, inset 0 1px 0 rgba(255,255,255,0.10)`
                  : `0 20px 46px rgba(77,119,191,0.18), 0 0 0 1.5px ${T.border}, inset 0 1px 0 rgba(255,255,255,0.78)`,
                backdropFilter: 'blur(20px)',
                touchAction: 'none',
                flexShrink: 0,
                transition: 'box-shadow 0.5s ease',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* Running glow */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '24px', pointerEvents: 'none', zIndex: 2,
                boxShadow: isRunning ? `inset 0 0 30px ${isDark ? 'rgba(96,239,255,0.15)' : 'rgba(0,114,255,0.12)'}` : 'none',
                transition: 'box-shadow 0.5s ease',
              }} />

              {/* Sheen */}
              <div style={{
                position: 'absolute', inset: '0 0 auto 0', height: '30%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.10), transparent)',
                pointerEvents: 'none', zIndex: 1, borderRadius: '24px 24px 0 0',
              }} />

              <canvas ref={canvasRef} style={{ display: 'block', width: boardSize, height: boardSize }} />

              {/* Idle Overlay */}
              {isIdle && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(8,12,28,0.92), rgba(8,12,28,0.80))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.90), rgba(245,249,255,0.80))',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: isTiny ? '10px' : '13px',
                  borderRadius: '24px', backdropFilter: 'blur(18px) saturate(145%)',
                  padding: isTiny ? '14px' : isCompact ? '16px' : '24px',
                  animation: 'fadeUp 0.35s ease',
                  zIndex: 3,
                }}>
                  <div style={{
                    fontFamily: "'Orbitron',monospace",
                    fontSize: isTiny ? '28px' : isCompact ? '32px' : 'clamp(28px,7vw,46px)',
                    fontWeight: 900, color: T.uiAccent, letterSpacing: '0.18em',
                    textShadow: isDark ? `0 0 28px ${T.uiAccent}` : '0 12px 28px rgba(0,114,255,0.20)',
                  }}>
                    SNAKE
                  </div>

                  {!isTiny && (
                    <p style={{
                      color: T.uiSub, fontSize: '11px', textAlign: 'center',
                      letterSpacing: '0.22em', textTransform: 'uppercase', margin: 0,
                    }}>
                      Neon arcade, rebuilt for touch
                    </p>
                  )}

                  {/* Mode Selection */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isTiny ? '1fr' : '1fr 1fr',
                    gap: '7px', width: '100%', maxWidth: isTiny ? '200px' : '300px',
                  }}>
                    {([
                      ['CLASSIC', '🧱', 'Borders are fatal'],
                      ['FREE_ROAM', '🌀', 'Wrap around edges'],
                    ] as const).map(([mode, icon, sub]) => (
                      <button key={mode} style={{
                        ...glassPanel, padding: isTiny ? '10px 8px' : '12px 8px', borderRadius: '16px',
                        background: gameMode === mode
                          ? (isDark ? 'linear-gradient(180deg, rgba(96,239,255,0.20), rgba(10,18,36,0.72))' : 'linear-gradient(180deg, rgba(0,114,255,0.10), rgba(255,255,255,0.72))')
                          : glassPanel.background as string,
                        border: `1.5px solid ${gameMode === mode ? T.uiAccent : T.border}`,
                        color: gameMode === mode ? T.uiAccent : T.uiSub, cursor: 'pointer',
                        transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        boxShadow: gameMode === mode ? `0 16px 28px ${T.uiAccent}18` : glassPanel.boxShadow as string,
                      }} onClick={() => setGameMode(mode as GameMode)}>
                        <span style={{ fontSize: isTiny ? '16px' : '18px', marginBottom: '3px' }}>{icon}</span>
                        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: isTiny ? '9px' : '11px', fontWeight: 700 }}>
                          {mode.replace('_', ' ')}
                        </span>
                        {!isTiny && <span style={{ fontSize: '8px', marginTop: '2px', opacity: 0.75 }}>{sub}</span>}
                        <span style={{ fontSize: '9px', color: T.uiAccent2, marginTop: '3px' }}>Lv.{savedLevels[mode as GameMode]}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    style={{ ...btnPri, fontSize: isTiny ? '12px' : '13px', padding: isTiny ? '12px 28px' : '13px 36px', textTransform: 'uppercase', letterSpacing: '0.16em' }}
                    onClick={startGame}
                  >
                    START GAME
                  </button>
                </div>
              )}

              {/* Game Over Overlay */}
              {isOver && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(12,6,20,0.92), rgba(8,10,26,0.86))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,249,255,0.84))',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: isTiny ? '8px' : '11px',
                  borderRadius: '24px', backdropFilter: 'blur(18px) saturate(145%)',
                  padding: isTiny ? '14px' : '20px',
                  animation: 'fadeUp 0.35s ease',
                  zIndex: 3,
                }}>
                  <div style={{
                    fontFamily: "'Orbitron',monospace",
                    fontSize: isTiny ? '16px' : isCompact ? '20px' : 'clamp(18px,5vw,26px)',
                    fontWeight: 900, color: T.food1, letterSpacing: '0.14em',
                    textShadow: isDark ? `0 0 22px ${T.food1}` : '0 10px 24px rgba(255,65,108,0.18)',
                  }}>
                    GAME OVER
                  </div>

                  <div style={{ ...scoreBox, padding: isTiny ? '10px 14px' : '12px 20px', minWidth: isTiny ? 130 : 160 }}>
                    <div style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.uiSub, marginBottom: '6px' }}>
                      Final Score
                    </div>
                    <div style={{
                      fontFamily: "'Orbitron',monospace",
                      fontSize: isTiny ? '24px' : isCompact ? '30px' : 'clamp(26px,6vw,42px)',
                      fontWeight: 900, color: T.uiText, lineHeight: 1,
                    }}>
                      {hud.score}<span style={{ fontSize: '12px', color: T.uiSub, marginLeft: '2px' }}>pts</span>
                    </div>
                  </div>

                  {hud.score >= hud.highScore && hud.score > 0 && (
                    <div style={{
                      ...glassPanel, fontFamily: "'Orbitron',monospace", fontSize: '10px',
                      color: T.uiAccent, letterSpacing: '0.1em', animation: 'pulseGlow 1s infinite',
                      padding: '7px 10px', borderRadius: '999px',
                    }}>
                      🏆 NEW {difficulty} RECORD!
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', maxWidth: 220 }}>
                    {[
                      ['TIME', `${hud.totalTime}s`],
                      ['LENGTH', hud.length],
                      ['LEVEL', hud.level],
                      ['EATEN', hud.foodEaten],
                    ].map(([l, v], i) => (
                      <div key={l} style={{ ...scoreBox, padding: isTiny ? '7px 6px' : '9px 8px', animation: `staggerIn 0.3s ease ${i * 0.08}s both` }}>
                        <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: T.uiSub, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
                          {l}
                        </span>
                        <span style={{ display: 'block', fontFamily: "'Orbitron',monospace", fontSize: isTiny ? '12px' : '14px', fontWeight: 700, color: T.uiText }}>
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button style={{ ...btnPri, padding: isTiny ? '10px 20px' : '11px 24px' }} onClick={startGame}>
                      ↺ PLAY AGAIN
                    </button>
                    <button style={{ ...btnSec, padding: isTiny ? '9px 12px' : '10px 14px' }} onClick={() => { gameRef.current.gameState = 'IDLE'; syncUI(); }}>
                      MENU
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Power-ups / Combo */}
          <div style={{
            display: 'flex', gap: '6px', justifyContent: 'center',
            flexShrink: 0, minHeight: isTiny ? 0 : 28, flexWrap: 'wrap',
          }}>
            {hud.activePower && (() => {
              const info: Record<PowerUpType, { icon: string; label: string; color: string }> = {
                SHIELD: { icon: '🛡', label: 'SHIELD', color: '#ffd200' },
                SLOW: { icon: '🐢', label: 'SLOW-MO', color: '#00c6ff' },
                DOUBLE: { icon: '×2', label: 'DOUBLE', color: '#00ff87' },
                GHOST_MODE: { icon: '👻', label: 'GHOST', color: '#cc88ff' },
              };
              const nfo = info[hud.activePower.type];
              const pct = hud.activePower.ttl / 200;
              return (
                <div style={{
                  background: isDark ? `${nfo.color}16` : 'rgba(255,255,255,0.72)',
                  border: `1px solid ${nfo.color}55`, borderRadius: '12px',
                  padding: isTiny ? '5px 9px' : '7px 11px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  fontFamily: "'Orbitron',monospace", fontSize: '9px', fontWeight: 700, color: nfo.color,
                  boxShadow: `0 12px 24px ${nfo.color}16`, backdropFilter: 'blur(12px)',
                }}>
                  <span>{nfo.icon} {nfo.label}</span>
                  <div style={{ width: 60, height: 3, background: `${nfo.color}28`, borderRadius: 2 }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: nfo.color, borderRadius: 2, transition: 'width 0.1s' }} />
                  </div>
                </div>
              );
            })()}
            {hud.combo > 1 && (
              <div style={{
                background: isDark ? 'rgba(255,106,0,0.15)' : 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,106,0,0.5)', borderRadius: '12px',
                padding: isTiny ? '5px 9px' : '7px 11px',
                fontFamily: "'Orbitron',monospace", fontSize: '9px', fontWeight: 700, color: '#ff6a00',
                animation: 'pulseGlow 0.8s infinite', boxShadow: '0 12px 24px rgba(255,106,0,0.14)',
                backdropFilter: 'blur(12px)',
              }}>
                🔥 ×{hud.combo} COMBO
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            ...glassPanel,
            display: 'flex', justifyContent: 'center', gap: '6px',
            flexShrink: 0, flexWrap: 'wrap',
            padding: isTiny ? '7px 8px' : '8px 10px',
            borderRadius: '18px',
            opacity: (isRunning || isPaused || isCounting) ? 1 : 0,
            pointerEvents: (isRunning || isPaused || isCounting) ? 'auto' : 'none',
            transition: 'opacity 0.2s',
          }}>
            <button style={btnPri} onClick={togglePause}>
              {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button style={btnSec} onClick={startGame}>↺ RESTART</button>
            <button style={{ ...btnSec, border: 'none', background: 'transparent' }} onClick={() => { gameRef.current.gameState = 'IDLE'; syncUI(); }}>
              ✕ EXIT
            </button>
          </div>

          {/* D-Pad */}
          <div style={{
            ...glassPanel,
            display: 'grid',
            gridTemplateColumns: `repeat(3,${dPadBtnSize}px)`,
            gridTemplateRows: `repeat(3,${dPadBtnSize}px)`,
            gap: isTiny ? '6px' : isCompact ? '7px' : '9px',
            margin: '0 auto',
            flexShrink: 0,
            touchAction: 'none',
            padding: isTiny ? '9px' : isCompact ? '11px' : '13px',
            borderRadius: '22px',
          }}>
            <div />
            <DBtn d="UP" lbl="▲" ariaLabel="Move up" />
            <div />
            <DBtn d="LEFT" lbl="◀" ariaLabel="Move left" />
            <div style={{
              width: dPadBtnSize, height: dPadBtnSize, borderRadius: '12px',
              background: T.scoreBg, border: `1px solid ${T.border}`,
              opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.uiSub, fontSize: '14px',
            }}>
              ●
            </div>
            <DBtn d="RIGHT" lbl="▶" ariaLabel="Move right" />
            <div />
            <DBtn d="DOWN" lbl="▼" ariaLabel="Move down" />
            <div />
          </div>

          {/* Keyboard hint */}
          {!isTiny && !isCompact && (
            <p style={{
              textAlign: 'center', color: T.uiSub, fontSize: '8px',
              letterSpacing: '0.14em', flexShrink: 0, textTransform: 'uppercase', opacity: 0.8,
            }}>
              ↑↓←→ · WASD · SPACE=pause · ENTER=start
            </p>
          )}
        </div>

        {/* Settings Panel */}
        {panel === 'settings' && (
          <PanelShell>
            {panelTitle('SETTINGS')}
            <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'SHOW GRID', val: showGrid, fn: setShowGrid },
                { label: 'HAPTIC FEEDBACK', val: haptics, fn: setHaptics },
                { label: 'SOUND EFFECTS', val: soundOn, fn: setSoundOn },
              ].map(o => (
                <div key={o.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: T.scoreBg, border: `1px solid ${T.border}`,
                  borderRadius: '12px', padding: '12px 14px',
                }}>
                  <span style={{ color: T.uiText, fontWeight: 600, fontSize: '13px' }}>{o.label}</span>
                  <button style={{
                    background: o.val ? T.btnPri : 'transparent',
                    border: `1.5px solid ${o.val ? 'transparent' : T.btnSecBdr}`,
                    borderRadius: '20px', width: 44, height: 22, cursor: 'pointer',
                    position: 'relative', transition: 'all 0.2s',
                  }} onClick={() => o.fn(!o.val)}>
                    <div style={{
                      position: 'absolute', top: 2, left: o.val ? 22 : 2,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </div>
              ))}

              <div style={{ background: T.scoreBg, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '12px 14px' }}>
                <span style={{ color: T.uiText, fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px' }}>DIFFICULTY</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {DIFFS.map(d => (
                    <button key={d} style={{
                      ...btnSec, flex: 1,
                      background: difficulty === d ? T.btnPri : 'transparent',
                      color: difficulty === d ? T.btnPriTxt : T.btnSecTxt,
                      border: `1.5px solid ${difficulty === d ? 'transparent' : T.btnSecBdr}`,
                    }} onClick={() => setDifficulty(d)}>{d}</button>
                  ))}
                </div>
              </div>

              <div style={{ background: T.scoreBg, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '12px 14px' }}>
                <span style={{ color: T.uiText, fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px' }}>THEME</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {(['light', 'dark'] as ThemeKey[]).map(k => (
                    <button key={k} style={{
                      ...btnSec, flex: 1,
                      background: themeKey === k ? T.btnPri : 'transparent',
                      color: themeKey === k ? T.btnPriTxt : T.btnSecTxt,
                      border: `1.5px solid ${themeKey === k ? 'transparent' : T.btnSecBdr}`,
                    }} onClick={() => setThemeKey(k)}>{k === 'dark' ? '🌙 DARK' : '☀️ LIGHT'}</button>
                  ))}
                </div>
              </div>
            </div>
            <button style={{ ...btnPri, marginTop: '6px' }} onClick={() => setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* Skins Panel */}
        {panel === 'skins' && (
          <PanelShell>
            {panelTitle('SKINS')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '7px', width: '100%', maxWidth: 360 }}>
              {(Object.entries(SKIN_DEFS) as [SkinId, typeof SKIN_DEFS[SkinId]][]).map(([id, def]) => (
                <button key={id} style={{
                  background: skin === id ? `${T.uiAccent}20` : T.scoreBg,
                  border: `1.5px solid ${skin === id ? T.uiAccent : T.border}`,
                  borderRadius: '12px', padding: '10px 7px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
                }} onClick={() => setSkin(id)}>
                  <span style={{ fontSize: '22px' }}>{def.icon}</span>
                  <span style={{ fontFamily: "'Orbitron',monospace", fontSize: '9px', fontWeight: 700, color: skin === id ? T.uiAccent : T.uiText }}>{def.name}</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[def.head[0], def.body[0], def.body[1]].map((c, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                    ))}
                  </div>
                  {skin === id && <span style={{ fontSize: '11px' }}>✓</span>}
                </button>
              ))}
            </div>
            <button style={{ ...btnPri, marginTop: '6px' }} onClick={() => setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* Achievements Panel */}
        {panel === 'achievements' && (
          <PanelShell>
            {panelTitle('ACHIEVEMENTS')}
            <p style={{ color: T.uiSub, fontSize: '12px', margin: 0 }}>{unlockedCnt} / {achievements.length} unlocked</p>
            <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {achievements.map(a => (
                <div key={a.id} style={{
                  background: a.unlocked ? T.scoreBg : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.025)'),
                  border: `1px solid ${a.unlocked ? T.uiAccent + '44' : T.border}`,
                  borderRadius: '10px', padding: '9px 12px',
                  display: 'flex', alignItems: 'center', gap: '9px', opacity: a.unlocked ? 1 : 0.42,
                }}>
                  <span style={{ fontSize: '18px', minWidth: 24 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '11px', color: T.uiText, fontFamily: "'Orbitron',monospace" }}>{a.label}</div>
                    <div style={{ fontSize: '10px', color: T.uiSub }}>{a.desc}</div>
                  </div>
                  {a.unlocked && <span style={{ color: T.uiAccent, fontSize: '13px' }}>✓</span>}
                </div>
              ))}
            </div>
            <button style={{ ...btnPri, marginTop: '6px' }} onClick={() => setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* High Scores Panel */}
        {panel === 'scores' && (
          <PanelShell>
            {panelTitle('HIGH SCORES')}
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {DIFFS.map((d, i) => (
                <div key={d} style={{ ...scoreBox, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <span style={{ fontSize: '20px' }}>{i === 0 ? '🧊' : i === 1 ? '🎯' : '🚀'}</span>
                    <span style={{ fontFamily: "'Orbitron',monospace", fontSize: '12px', fontWeight: 700, color: T.uiText }}>{d}</span>
                  </div>
                  <span style={{ fontFamily: "'Orbitron',monospace", fontSize: '20px', fontWeight: 900, color: T.uiAccent }}>{highScores[d] ?? 0}</span>
                </div>
              ))}
              <div style={{ ...scoreBox, padding: '13px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: '9px', color: T.uiSub, marginBottom: '4px', letterSpacing: '0.1em' }}>TOTAL FOOD EATEN</div>
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: '22px', fontWeight: 900, color: T.uiAccent }}>{hud.foodEaten}</div>
              </div>
              <div style={{ ...scoreBox, padding: '13px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: '9px', color: T.uiSub, marginBottom: '4px', letterSpacing: '0.1em' }}>ACHIEVEMENTS</div>
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: '20px', fontWeight: 900, color: T.uiAccent2 }}>{unlockedCnt}/{achievements.length}</div>
              </div>
            </div>
            <button style={{ ...btnPri, marginTop: '6px' }} onClick={() => setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* Achievement Toast */}
        {newAch && (
          <div style={{
            position: 'fixed',
            right: 12,
            zIndex: 200,
            background: isDark
              ? 'linear-gradient(180deg, rgba(10,8,28,0.97), rgba(8,14,32,0.94))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(244,249,255,0.96))',
            border: `1.5px solid ${T.uiAccent}`,
            borderRadius: '16px', padding: '11px 14px',
            display: 'flex', alignItems: 'center', gap: '9px',
            boxShadow: '0 16px 32px rgba(0,0,0,0.22)',
            animation: 'achSlide 0.4s ease',
            backdropFilter: 'blur(18px)', maxWidth: '250px',
            bottom: 'max(20px, calc(20px + env(safe-area-inset-bottom)))',
          }}>
            <span style={{ fontSize: '24px' }}>{newAch.icon}</span>
            <div>
              <div style={{ fontSize: '7px', letterSpacing: '0.12em', color: T.uiAccent, fontWeight: 700, fontFamily: "'Orbitron',monospace" }}>
                ACHIEVEMENT UNLOCKED
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.uiText, fontFamily: "'Orbitron',monospace" }}>
                {newAch.label}
              </div>
              <div style={{ fontSize: '9px', color: T.uiSub }}>{newAch.desc}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SnakeGame;