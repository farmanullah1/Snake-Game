import React, {
  useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Point        = { x: number; y: number };
type Direction    = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState    = 'IDLE' | 'RUNNING' | 'PAUSED' | 'OVER' | 'COUNTDOWN';
type GameMode     = 'CLASSIC' | 'FREE_ROAM';
type Difficulty   = 'CHILL' | 'NORMAL' | 'TURBO';
type PowerUpType  = 'SHIELD' | 'SLOW' | 'DOUBLE' | 'GHOST_MODE';
type SkinId       = 'classic' | 'neon' | 'fire' | 'ice' | 'gold' | 'rainbow';
type Achievement  = { id: string; label: string; icon: string; desc: string; unlocked: boolean; ts?: number; };
type FloatingText = { id: number; x: number; y: number; text: string; color: string; };
type Particle     = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — logical grid is always 20×20, canvas draws at LOGICAL_SIZE×LOGICAL_SIZE
// CSS scales the canvas element to fit the screen (boardSize px)
// ─────────────────────────────────────────────────────────────────────────────
const COLS = 20;
const ROWS = 20;
const LOGICAL_CELL = 20;                 // logical pixels per cell (internal canvas coords)
const LOGICAL_SIZE = LOGICAL_CELL * COLS; // 400 — internal canvas drawing space

const MIN_BOARD = 200;
const MAX_BOARD = 600;

const SPEED: Record<Difficulty, { base: number; min: number; inc: number }> = {
  CHILL:  { base: 200, min: 100, inc: 3 },
  NORMAL: { base: 140, min: 55,  inc: 5 },
  TURBO:  { base: 75,  min: 25,  inc: 7 },
};

const SKIN_DEFS: Record<SkinId, { name: string; head: [string,string]; body: [string,string]; glow: string; icon: string }> = {
  classic: { name:'Classic', head:['#0052d4','#4364f7'], body:['#00c6ff','#0072ff'], glow:'#0072ff', icon:'🔵' },
  neon:    { name:'Neon',    head:['#00ffa6','#00e5ff'], body:['#00ff87','#60efff'], glow:'#00ff87', icon:'💚' },
  fire:    { name:'Fire',    head:['#ff4e00','#ec9f05'], body:['#ff6b35','#f7c59f'], glow:'#ff4e00', icon:'🔥' },
  ice:     { name:'Ice',     head:['#a8edea','#fed6e3'], body:['#d3f9d8','#a8edea'], glow:'#a8edea', icon:'❄️' },
  gold:    { name:'Gold',    head:['#f7971e','#ffd200'], body:['#ffb347','#ffd700'], glow:'#ffd200', icon:'⭐' },
  rainbow: { name:'Rainbow', head:['#ff0080','#7928ca'], body:['#ff0080','#7928ca'], glow:'#ff0080', icon:'🌈' },
};

const DIFFS: Difficulty[] = ['CHILL','NORMAL','TURBO'];

const ACHIEVEMENT_DEFS: Omit<Achievement,'unlocked'>[] = [
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

// ─────────────────────────────────────────────────────────────────────────────
// THEMES
// ─────────────────────────────────────────────────────────────────────────────
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
type Theme    = typeof THEMES['light'];

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const randomCell = (exclude: Point[]): Point => {
  let p: Point;
  do { p = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) }; }
  while (exclude.some(e => e.x===p.x && e.y===p.y));
  return p;
};
const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch {} };
const lsGet = (k: string, fb: string) => { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } };
const lsSet = (k: string, v: string)  => { try { localStorage.setItem(k, v); }         catch {} };

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS DRAW — uses fixed LOGICAL_CELL/LOGICAL_SIZE coords; CSS scales to boardSize
// ─────────────────────────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

interface DS {
  snake:Point[]; food:{pos:Point;pulse:number;};
  bonusFood:{pos:Point;ttl:number;}|null;
  powerUp:{pos:Point;type:PowerUpType;pulse:number;}|null;
  gameState:GameState; theme:Theme; dark:boolean;
  skin:SkinId; countdown:number;
  particles:Particle[]; floats:FloatingText[];
  ghostMode:boolean; shieldActive:boolean;
  rainbowHue:number; showGrid:boolean;
}

function drawCanvas(ctx:CanvasRenderingContext2D, d:DS) {
  const { snake,food,bonusFood,powerUp,gameState,theme,dark,skin,countdown,
          particles,floats,ghostMode,shieldActive,rainbowHue,showGrid } = d;
  const C = LOGICAL_CELL;
  const W = LOGICAL_SIZE, H = LOGICAL_SIZE;
  const T = theme;

  // BG
  const bgG = ctx.createLinearGradient(0,0,W,H);
  T.bg.forEach((c,i) => bgG.addColorStop(i/(T.bg.length-1), c));
  ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

  // Scanlines (dark mode only)
  if (dark) {
    for (let y=0; y<H; y+=4) { ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(0,y,W,1); }
  }

  // Grid
  if (showGrid) {
    ctx.strokeStyle = T.gridLine; ctx.lineWidth = 0.5;
    for (let i=0; i<=COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i*C,0); ctx.lineTo(i*C,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*C); ctx.lineTo(W,i*C); ctx.stroke();
    }
  }

  // Particles
  particles.forEach(p => {
    ctx.save(); ctx.globalAlpha=p.life;
    ctx.shadowColor=p.color; ctx.shadowBlur=dark?8:3;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // Power-up
  if (powerUp) {
    const px=powerUp.pos.x*C+C/2, py=powerUp.pos.y*C+C/2;
    const pulse=0.78+Math.sin(powerUp.pulse)*0.22;
    const r=(C/2-1)*pulse;
    ctx.save();
    ctx.shadowColor='#ffd200'; ctx.shadowBlur=dark?22:10;
    const pG=ctx.createRadialGradient(px,py,1,px,py,r);
    pG.addColorStop(0,'#fffacc'); pG.addColorStop(1,'#ffd200');
    ctx.fillStyle=pG; rrect(ctx,px-r,py-r,r*2,r*2,5); ctx.fill();
    ctx.shadowBlur=0;
    const icons:Record<PowerUpType,string>={SHIELD:'🛡',SLOW:'🐢',DOUBLE:'×2',GHOST_MODE:'👻'};
    ctx.font=`bold ${C-5}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(icons[powerUp.type],px,py);
    ctx.restore();
  }

  // Bonus food
  if (bonusFood) {
    const bx=bonusFood.pos.x*C+C/2, by=bonusFood.pos.y*C+C/2;
    ctx.save(); ctx.globalAlpha=Math.min(1,bonusFood.ttl/40);
    ctx.shadowColor='#ff00cc'; ctx.shadowBlur=dark?20:9;
    const bG=ctx.createRadialGradient(bx,by,1,bx,by,C/2-1);
    bG.addColorStop(0,'#ff00cc'); bG.addColorStop(1,'#7b00ff');
    ctx.fillStyle=bG; rrect(ctx,bonusFood.pos.x*C+2,bonusFood.pos.y*C+2,C-4,C-4,6);
    ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.font=`bold ${C-5}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★',bx,by); ctx.restore();
  }

  // Main food
  {
    const fx=food.pos.x*C+C/2, fy=food.pos.y*C+C/2;
    const pulse=0.84+Math.sin(food.pulse)*0.16;
    const r=(C/2-1.5)*pulse;
    ctx.save();
    ctx.shadowColor=T.foodGlow; ctx.shadowBlur=dark?20:9;
    const fG=ctx.createRadialGradient(fx-r*0.25,fy-r*0.25,0,fx,fy,r);
    fG.addColorStop(0,T.food1); fG.addColorStop(1,T.food2);
    ctx.fillStyle=fG; ctx.beginPath(); ctx.arc(fx,fy,r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(fx-r*0.3,fy-r*0.3,r*0.28,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Snake
  const sk = SKIN_DEFS[skin];
  snake.forEach((seg,i) => {
    const x=seg.x*C+1, y=seg.y*C+1, sz=C-2;
    const rad=i===0?7:4;
    const ratio=snake.length>1?i/(snake.length-1):0;
    ctx.save();
    ctx.globalAlpha = ghostMode ? (i===0?0.55:0.35) : 1;
    if (dark) {
      const hue = skin==='rainbow' ? (rainbowHue+i*18)%360 : -1;
      ctx.shadowBlur = i===0?22:13;
      ctx.shadowColor = hue>=0 ? `hsl(${hue},100%,60%)` : (i===0?sk.head[0]:sk.glow);
    }
    let fill: string|CanvasGradient;
    if (skin==='rainbow') {
      const h=(rainbowHue+i*18)%360, h2=(h+30)%360;
      const rg=ctx.createLinearGradient(x,y,x+sz,y+sz);
      rg.addColorStop(0,`hsl(${h},100%,${i===0?52:58}%)`);
      rg.addColorStop(1,`hsl(${h2},100%,62%)`);
      fill=rg;
    } else if (i===0) {
      const hg=ctx.createLinearGradient(x,y,x+sz,y+sz);
      hg.addColorStop(0,sk.head[0]); hg.addColorStop(1,sk.head[1]); fill=hg;
    } else {
      const bg=ctx.createLinearGradient(x,y,x+sz,y+sz);
      bg.addColorStop(0,sk.body[0]); bg.addColorStop(1,sk.body[1]);
      ctx.globalAlpha=ghostMode?0.28:(1-ratio*0.28); fill=bg;
    }
    ctx.fillStyle=fill; rrect(ctx,x,y,sz,sz,rad); ctx.fill();

    // Shield ring
    if (i===0&&shieldActive) {
      ctx.save(); ctx.globalAlpha=0.7;
      ctx.strokeStyle='#ffd200'; ctx.lineWidth=2.5;
      ctx.shadowColor='#ffd200'; ctx.shadowBlur=14;
      rrect(ctx,x-2.5,y-2.5,sz+5,sz+5,rad+3); ctx.stroke();
      ctx.restore();
    }

    // Eyes
    if (i===0) {
      ctx.globalAlpha=1; ctx.shadowBlur=0;
      const hp=snake[0], nx2=snake[1]??{x:hp.x-1,y:hp.y};
      const dx=hp.x-nx2.x, dy=hp.y-nx2.y;
      const cx=hp.x*C+C/2, cy=hp.y*C+C/2;
      ctx.fillStyle='#fff';
      ctx.beginPath();
      ctx.arc(cx+dy*4+dx*3,cy-dx*4+dy*3,2.8,0,Math.PI*2);
      ctx.arc(cx-dy*4+dx*3,cy+dx*4+dy*3,2.8,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle='#001133';
      ctx.beginPath();
      ctx.arc(cx+dy*4+dx*4.3,cy-dx*4+dy*4.3,1.4,0,Math.PI*2);
      ctx.arc(cx-dy*4+dx*4.3,cy+dx*4+dy*4.3,1.4,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  });

  // Floating texts
  floats.forEach(ft => {
    ctx.save();
    ctx.font=`bold 13px 'Orbitron',monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=ft.color; ctx.shadowColor=ft.color; ctx.shadowBlur=8;
    ctx.fillText(ft.text,ft.x,ft.y); ctx.restore();
  });

  // Pause overlay
  if (gameState==='PAUSED') {
    ctx.fillStyle=T.pauseOvl; ctx.fillRect(0,0,W,H);
    ctx.save();
    ctx.font=`900 34px 'Orbitron',monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=dark?'#60efff':'#0072ff';
    ctx.shadowColor=dark?'#60efff':'#0072ff'; ctx.shadowBlur=dark?22:8;
    ctx.fillText('PAUSED',W/2,H/2-14);
    ctx.shadowBlur=0; ctx.font=`600 11px 'Rajdhani',sans-serif`;
    ctx.fillStyle=dark?'#7a90b0':'#5a6a7a';
    ctx.fillText('PRESS SPACE TO RESUME',W/2,H/2+16);
    ctx.restore();
  }

  // Countdown
  if (gameState==='COUNTDOWN') {
    ctx.fillStyle=T.pauseOvl; ctx.fillRect(0,0,W,H);
    ctx.save();
    ctx.font=`900 68px 'Orbitron',monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=dark?'#60efff':'#0072ff';
    ctx.shadowColor=dark?'#60efff':'#0072ff'; ctx.shadowBlur=dark?35:14;
    ctx.fillText(countdown>0?String(countdown):'GO!',W/2,H/2);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARD SIZE HOOK — synchronous initial calc + ResizeObserver updates
// Uses window dimensions directly to avoid layout-measurement race conditions
// ─────────────────────────────────────────────────────────────────────────────
function useResponsiveBoardSize() {
  const calcSize = useCallback(() => {
    // Use visualViewport when available (handles virtual keyboard on mobile)
    const vw = window.visualViewport?.width  ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;

    // Dynamic chrome budget: top bar + score row + action bar + D-pad + gaps
    const isCompactW = vw <= 375;
    const isCompactH = vh <= 700;
    const isLandscape = vw > vh;
    const chromeBudget = isLandscape
      ? (isCompactH ? 260 : 300)
      : isCompactH
        ? (isCompactW ? 300 : 320)
        : (isCompactW ? 340 : 370);

    const hPad = isCompactW ? 12 : 20;
    const available = Math.min(vw - hPad, vh - chromeBudget);
    // Floor to nearest COLS multiple for pixel-perfect grid cells
    const floored = Math.floor(available / COLS) * COLS;
    return Math.max(MIN_BOARD, Math.min(MAX_BOARD, floored));
  }, []);

  const [boardSize, setBoardSize] = useState(calcSize);

  useEffect(() => {
    const update = () => setBoardSize(calcSize());
    const vvp = window.visualViewport;
    if (vvp) {
      vvp.addEventListener('resize', update);
      vvp.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    // Detect DPR changes (e.g. moving window between monitors)
    const dprMq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMq.addEventListener?.('change', update);
    return () => {
      if (vvp) {
        vvp.removeEventListener('resize', update);
        vvp.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      dprMq.removeEventListener?.('change', update);
    };
  }, [calcSize]);

  return boardSize;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SnakeGame: React.FC = () => {
  const boardSize = useResponsiveBoardSize();

  // Viewport breakpoints
  const vw = typeof window !== 'undefined' ? (window.visualViewport?.width ?? window.innerWidth) : 400;
  const vh = typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800;
  const isTiny    = vw <= 340;   // 320px class
  const isCompact = vw <= 390 || vh <= 700;


  // ── Preferences ─────────────────────────────────────────────────────────
  const [themeKey, setThemeKey]     = useState<ThemeKey>(() => lsGet('sng_theme','light') as ThemeKey);
  const [skin, setSkin]             = useState<SkinId>(() => lsGet('sng_skin','classic') as SkinId);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => lsGet('sng_diff','NORMAL') as Difficulty);
  const [gameMode, setGameMode]     = useState<GameMode>(() => lsGet('sng_mode','CLASSIC') as GameMode);
  const [showGrid, setShowGrid]     = useState(() => lsGet('sng_grid','1')==='1');
  const [haptics, setHaptics]       = useState(() => lsGet('sng_haptic','1')==='1');

  const T = THEMES[themeKey];
  const isDark = themeKey === 'dark';

  useEffect(() => { lsSet('sng_theme',themeKey); }, [themeKey]);
  useEffect(() => { lsSet('sng_skin',skin); }, [skin]);
  useEffect(() => { lsSet('sng_diff',difficulty); }, [difficulty]);
  useEffect(() => { lsSet('sng_mode',gameMode); }, [gameMode]);
  useEffect(() => { lsSet('sng_grid',showGrid?'1':'0'); }, [showGrid]);
  useEffect(() => { lsSet('sng_haptic',haptics?'1':'0'); }, [haptics]);

  // ── Game state ───────────────────────────────────────────────────────────
  const INIT_SNAKE: Point[] = useMemo(() => [{x:10,y:10},{x:9,y:10},{x:8,y:10}], []);
  const [snake, setSnake]             = useState<Point[]>(INIT_SNAKE);
  const [direction, setDirection]     = useState<Direction>('RIGHT');
  const pendDir                       = useRef<Direction>('RIGHT');
  const queuedDirRef                  = useRef<Direction | null>(null);
  const inputLockRef                  = useRef(false);
  const [food, setFood]               = useState(() => ({ pos:randomCell(INIT_SNAKE), pulse:0 }));
  const [bonusFood, setBonusFood]     = useState<{pos:Point;ttl:number}|null>(null);
  const [powerUp, setPowerUp]         = useState<{pos:Point;type:PowerUpType;pulse:number}|null>(null);
  const [activePower, setActivePower] = useState<{type:PowerUpType;ttl:number}|null>(null);
  const [gameState, setGameState]     = useState<GameState>('IDLE');
  const [score, setScore]             = useState(0);
  const [level, setLevel]             = useState(1);
  const [countdown, setCountdown]     = useState(3);
  const [comboStreak, setComboStreak] = useState(0);
  const [ghostMode, setGhostMode]     = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [slowActive, setSlowActive]   = useState(false);
  const [doubleScore, setDoubleScore] = useState(false);
  const [totalTime, setTotalTime]     = useState(0);
  const [foodEaten, setFoodEaten]     = useState(0);

  // ── High scores & achievements ───────────────────────────────────────────
  const [highScores, setHighScores] = useState<Record<Difficulty,number>>(() => {
    try { return JSON.parse(lsGet('sng_hs2','null')) ?? {CHILL:0,NORMAL:0,TURBO:0}; }
    catch { return {CHILL:0,NORMAL:0,TURBO:0}; }
  });
  const [savedLevels, setSavedLevels] = useState<Record<GameMode,number>>(() => {
    try { return JSON.parse(lsGet('sng_saved_levels','null')) ?? {CLASSIC:1,FREE_ROAM:1}; }
    catch { return {CLASSIC:1,FREE_ROAM:1}; }
  });
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    try {
      const saved = JSON.parse(lsGet('sng_ach','[]')) as {id:string;ts?:number}[];
      return ACHIEVEMENT_DEFS.map(d => ({ ...d, unlocked:saved.some(s=>s.id===d.id), ts:saved.find(s=>s.id===d.id)?.ts }));
    } catch { return ACHIEVEMENT_DEFS.map(d=>({...d,unlocked:false})); }
  });
  const [newAch, setNewAch]           = useState<Achievement|null>(null);
  const achTimerRef                   = useRef<ReturnType<typeof setTimeout>|null>(null);

  // ── Visual ───────────────────────────────────────────────────────────────
  const particlesRef                  = useRef<Particle[]>([]);
  const floatsRef                     = useRef<FloatingText[]>([]);
  const floatId                       = useRef(0);
  const [panel, setPanel]             = useState<null|'settings'|'skins'|'achievements'|'scores'>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const cdRef       = useRef<ReturnType<typeof setInterval>|null>(null);
  const pulseRef    = useRef(0);
  const rhRef       = useRef(0);

  // Syncing refs — avoids stale closure in animation/tick
  const R = useRef({
    snake:INIT_SNAKE, dir:'RIGHT' as Direction, food:{pos:randomCell(INIT_SNAKE),pulse:0},
    bonus:null as {pos:Point;ttl:number}|null, pu:null as {pos:Point;type:PowerUpType;pulse:number}|null,
    ap:null as {type:PowerUpType;ttl:number}|null, state:'IDLE' as GameState, score:0, diff:'NORMAL' as Difficulty,
    ghost:false, shield:false, double:false, slow:false, mode: 'CLASSIC' as GameMode, eaten:0, combo:0,
    particles:[] as Particle[], floats:[] as FloatingText[], skin: 'classic' as SkinId, themeKey: 'light' as ThemeKey,
    showGrid: true, countdown: 3
  });

  useEffect(() => { R.current.snake  = snake;       }, [snake]);
  useEffect(() => { R.current.dir    = direction;   }, [direction]);
  useEffect(() => { R.current.food   = food;        }, [food]);
  useEffect(() => { R.current.bonus  = bonusFood;   }, [bonusFood]);
  useEffect(() => { R.current.pu     = powerUp;     }, [powerUp]);
  useEffect(() => { R.current.ap     = activePower; }, [activePower]);
  useEffect(() => { R.current.state  = gameState;   }, [gameState]);
  useEffect(() => { R.current.score  = score;       }, [score]);
  useEffect(() => { R.current.diff   = difficulty;  }, [difficulty]);
  useEffect(() => { R.current.ghost  = ghostMode;   }, [ghostMode]);
  useEffect(() => { R.current.shield = shieldActive;}, [shieldActive]);
  useEffect(() => { R.current.double = doubleScore; }, [doubleScore]);
  useEffect(() => { R.current.slow   = slowActive;  }, [slowActive]);
  useEffect(() => { R.current.mode   = gameMode;    }, [gameMode]);
  useEffect(() => { R.current.eaten  = foodEaten;   }, [foodEaten]);
  useEffect(() => { R.current.combo  = comboStreak; }, [comboStreak]);
  useEffect(() => { R.current.skin   = skin;        }, [skin]);
  useEffect(() => { R.current.themeKey = themeKey;  }, [themeKey]);
  useEffect(() => { R.current.showGrid = showGrid;  }, [showGrid]);
  useEffect(() => { R.current.countdown = countdown;}, [countdown]);

  // ── Canvas: set physical pixels on boardSize change ───────────────────────
  // Canvas logical drawing size is always LOGICAL_SIZE×LOGICAL_SIZE.
  // CSS width/height = boardSize (the visual size on screen).
  // DPR scaling happens via ctx.setTransform so canvas never blurs on HiDPI.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    // Physical pixels = logical drawing area × DPR
    canvas.width  = Math.round(LOGICAL_SIZE * dpr);
    canvas.height = Math.round(LOGICAL_SIZE * dpr);
    // CSS size = board display size (scales via CSS, no blurring because physical > CSS)
    canvas.style.width  = `${boardSize}px`;
    canvas.style.height = `${boardSize}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }, [boardSize]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let af: number;
    const loop = () => {
      // Skip rendering when tab is hidden (saves battery)
      if (document.hidden) { af = requestAnimationFrame(loop); return; }

      pulseRef.current += 0.08;
      rhRef.current = (rhRef.current + 1.5) % 360;

      // Advance particles
      const nextP = particlesRef.current
        .map(p => ({ ...p, x:p.x+p.vx, y:p.y+p.vy, vy:p.vy+0.07, life:p.life-0.024 }))
        .filter(p => p.life>0);
      particlesRef.current = nextP;
      R.current.particles = nextP;

      // Advance floats
      const nextF = floatsRef.current
        .map(f => ({ ...f, y:f.y-0.85 }))
        .filter(f => f.y>-20);
      floatsRef.current = nextF;
      R.current.floats = nextF;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Re-apply DPR transform each frame (guards against context reset)
          const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawCanvas(ctx, {
            snake:R.current.snake,
            food:{ ...R.current.food, pulse:pulseRef.current },
            bonusFood:R.current.bonus,
            powerUp:R.current.pu ? { ...R.current.pu, pulse:pulseRef.current } : null,
            gameState:R.current.state, theme:THEMES[R.current.themeKey],
            dark:R.current.themeKey==='dark', skin:R.current.skin, countdown:R.current.countdown,
            particles:R.current.particles, floats:R.current.floats, ghostMode:R.current.ghost,
            shieldActive:R.current.shield, rainbowHue:rhRef.current, showGrid:R.current.showGrid,
          });
        }
      }
      af = requestAnimationFrame(loop);
    };
    af = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(af);
  }, []);

  // ── Achievement unlock ────────────────────────────────────────────────────
  const unlock = useCallback((id:string) => {
    setAchievements(prev => {
      if (prev.find(a=>a.id===id)?.unlocked) return prev;
      const next = prev.map(a => a.id===id ? {...a,unlocked:true,ts:Date.now()} : a);
      lsSet('sng_ach', JSON.stringify(next.filter(a=>a.unlocked).map(a=>({id:a.id,ts:a.ts}))));
      const ach = next.find(a=>a.id===id)!;
      setNewAch(ach);
      if (achTimerRef.current) clearTimeout(achTimerRef.current);
      achTimerRef.current = setTimeout(() => setNewAch(null), 3600);
      return next;
    });
  }, []);

  // ── Particles ─────────────────────────────────────────────────────────────
  const burst = useCallback((x:number,y:number,color:string,n=13) => {
    const next = [...particlesRef.current.slice(-90), ...Array.from({length:n},() => ({
      x,y,vx:(Math.random()-0.5)*4.5,vy:(Math.random()-0.5)*4.5-0.8,
      life:0.8+Math.random()*0.2,color,size:2+Math.random()*3,
    }))];
    particlesRef.current = next;
    R.current.particles = next;
  }, []);

  const floatAdd = useCallback((x:number,y:number,text:string,color:string) => {
    const id = ++floatId.current;
    const next = [...floatsRef.current.slice(-10), {id,x,y,text,color}];
    floatsRef.current = next;
    R.current.floats = next;
  }, []);

  // ── Speed ─────────────────────────────────────────────────────────────────
  const getSpeed = useCallback((sc:number, diff:Difficulty, slow:boolean):number => {
    const {base,min,inc} = SPEED[diff];
    const s = Math.max(min, base - Math.floor(sc/5)*inc);
    return slow ? Math.round(s*1.65) : s;
  }, []);

  const requestDirection = useCallback((next:Direction, vibratePattern?: number | number[]) => {
    const intended = inputLockRef.current ? pendDir.current : R.current.dir;
    if (next === intended || next === queuedDirRef.current) return false;
    if (next === OPPOSITE_DIRECTION[intended]) return false;

    if (!inputLockRef.current) {
      pendDir.current = next;
      queuedDirRef.current = null;
      inputLockRef.current = true;
      if (haptics && vibratePattern !== undefined) vibrate(vibratePattern);
      return true;
    }
    if (!queuedDirRef.current && next !== OPPOSITE_DIRECTION[pendDir.current]) {
      queuedDirRef.current = next;
      if (haptics && vibratePattern !== undefined) vibrate(vibratePattern);
      return true;
    }
    return false;
  }, [haptics]);

  // ── Tick ──────────────────────────────────────────────────────────────────
  const comboTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const tick = useCallback(() => {
    if (R.current.state !== 'RUNNING') return;
    const cur=R.current.snake, d=pendDir.current, head=cur[0];

    let nx=head.x, ny=head.y;
    if (d==='UP')    ny--;
    if (d==='DOWN')  ny++;
    if (d==='LEFT')  nx--;
    if (d==='RIGHT') nx++;

    if (R.current.mode === 'FREE_ROAM') {
      nx=(nx+COLS)%COLS; ny=(ny+ROWS)%ROWS;
    } else if (nx<0||nx>=COLS||ny<0||ny>=ROWS) {
      if (R.current.shield) {
        setShieldActive(false);
        nx=Math.max(0,Math.min(COLS-1,nx));
        ny=Math.max(0,Math.min(ROWS-1,ny));
        if (haptics) vibrate([40,20,40]);
        unlock('shield_used');
      } else {
        if (haptics) vibrate([60,40,200]);
        setGameState('OVER');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
    }

    const nh = {x:nx,y:ny};
    if (!R.current.ghost && cur.slice(0,-1).some(s=>s.x===nx&&s.y===ny)) {
      if (R.current.shield) {
        setShieldActive(false);
        if (haptics) vibrate([40,20,40]);
        unlock('shield_used');
      } else {
        if (haptics) vibrate([60,40,200]);
        setGameState('OVER');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
    }

    const ateMain  = nh.x===R.current.food.pos.x && nh.y===R.current.food.pos.y;
    const ateBonus = R.current.bonus && nh.x===R.current.bonus.pos.x && nh.y===R.current.bonus.pos.y;
    const atePU    = R.current.pu && nh.x===R.current.pu.pos.x && nh.y===R.current.pu.pos.y;
    const newSnake = ateMain||ateBonus ? [nh,...cur] : [nh,...cur.slice(0,-1)];

    if (ateMain) {
      const newEaten = R.current.eaten + 1;
      setFoodEaten(newEaten);
      const newCombo = R.current.combo + 1;
      setComboStreak(newCombo);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => setComboStreak(0), 2600);

      const pts = ((10 + (newCombo>1?newCombo*2:0)) * (R.current.double?2:1));
      const newScore = R.current.score + pts;
      const newLevel = Math.floor(newScore/50)+1;
      setScore(newScore);
      setLevel(newLevel);

      const px=nh.x*LOGICAL_CELL+LOGICAL_CELL/2, py=nh.y*LOGICAL_CELL+LOGICAL_CELL/2;
      burst(px,py,THEMES[R.current.themeKey].foodGlow,14);
      floatAdd(px,py, newCombo>1?`+${pts} ×${newCombo}`:`+${pts}`, R.current.themeKey==='dark'?'#60efff':'#0072ff');
      if (haptics) vibrate(7);

      setFood({ pos:randomCell(newSnake), pulse:pulseRef.current });

      if (Math.random()<0.22 && !R.current.bonus) setBonusFood({pos:randomCell(newSnake),ttl:130});
      if (Math.random()<0.13 && !R.current.pu) {
        const types:PowerUpType[]=['SHIELD','SLOW','DOUBLE','GHOST_MODE'];
        setPowerUp({pos:randomCell(newSnake),type:types[Math.floor(Math.random()*4)],pulse:pulseRef.current});
      }

      setHighScores(prev => {
        const best = prev[R.current.diff]??0;
        if (newScore>best) {
          const next={...prev,[R.current.diff]:newScore};
          lsSet('sng_hs2',JSON.stringify(next)); return next;
        }
        return prev;
      });
      setSavedLevels(prev => {
        const bestLevel = prev[R.current.mode]??1;
        if (newLevel>bestLevel) {
          const next={...prev,[R.current.mode]:newLevel};
          lsSet('sng_saved_levels',JSON.stringify(next)); return next;
        }
        return prev;
      });

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, getSpeed(newScore,R.current.diff,R.current.slow));

      if (newEaten===1) unlock('first_food');
      if (newScore>=50)  unlock('score_50');
      if (newScore>=100) unlock('score_100');
      if (newScore>=250) unlock('score_250');
      if (newScore>=500) unlock('score_500');
      if (newSnake.length>=10) unlock('length_10');
      if (newSnake.length>=20) unlock('length_20');
      if (newCombo>=5) unlock('combo_5');
      if (newScore>=100&&R.current.diff==='TURBO') unlock('turbo_100');
      if (newScore>=250&&R.current.diff==='CHILL') unlock('chill_250');
    }

    if (ateBonus) {
      setBonusFood(null);
      const pts=(doubleScore?50:25);
      setScore(prev=>{
        const n=prev+pts;
        setHighScores(hs=>{
          const b=hs[R.current.diff]??0;
          if(n>b){const nx={...hs,[R.current.diff]:n};lsSet('sng_hs2',JSON.stringify(nx));return nx;}
          return hs;
        });
        return n;
      });
      const px=nh.x*LOGICAL_CELL+LOGICAL_CELL/2, py=nh.y*LOGICAL_CELL+LOGICAL_CELL/2;
      burst(px,py,'#ff00cc',20);
      floatAdd(px,py,`+${pts}★`,'#ff00cc');
      if (haptics) vibrate([8,4,8]);
      unlock('bonus_food');
    }

    if (atePU && R.current.pu) {
      const pt=R.current.pu.type;
      setPowerUp(null);
      setActivePower({type:pt,ttl:200});
      const px=nh.x*LOGICAL_CELL+LOGICAL_CELL/2, py=nh.y*LOGICAL_CELL+LOGICAL_CELL/2;
      burst(px,py,'#ffd200',18);
      const labs:Record<PowerUpType,string>={SHIELD:'🛡 SHIELD!',SLOW:'🐢 SLOW-MO!',DOUBLE:'×2 DOUBLE!',GHOST_MODE:'👻 GHOST!'};
      floatAdd(px,py,labs[pt],'#ffd200');
      if (haptics) vibrate([5,3,5,3,10]);
      if (pt==='SHIELD')     setShieldActive(true);
      if (pt==='SLOW')       setSlowActive(true);
      if (pt==='DOUBLE')     setDoubleScore(true);
      if (pt==='GHOST_MODE') setGhostMode(true);
      unlock('power_up');
    }

    if (R.current.bonus) {
      const ttl = R.current.bonus.ttl - 1;
      if (ttl<=0) setBonusFood(null); else setBonusFood({...R.current.bonus,ttl});
    }

    if (R.current.ap) {
      const ttl = R.current.ap.ttl - 1;
      if (ttl<=0) {
        const tp=R.current.ap.type;
        if (tp==='SHIELD')     setShieldActive(false);
        if (tp==='SLOW')       { setSlowActive(false); if(intervalRef.current)clearInterval(intervalRef.current); intervalRef.current=setInterval(tick,getSpeed(R.current.score,R.current.diff,false)); }
        if (tp==='DOUBLE')     setDoubleScore(false);
        if (tp==='GHOST_MODE') setGhostMode(false);
        setActivePower(null);
      } else setActivePower({...R.current.ap,ttl});
    }

    // Consume queued direction
    const nextQ = queuedDirRef.current;
    if (nextQ && nextQ !== OPPOSITE_DIRECTION[d] && nextQ !== d) {
      pendDir.current = nextQ;
      queuedDirRef.current = null;
      inputLockRef.current = true;
    } else {
      pendDir.current = d;
      queuedDirRef.current = null;
      inputLockRef.current = false;
    }

    setDirection(d);
    setSnake(newSnake);
  }, [burst, floatAdd, getSpeed, haptics, unlock, doubleScore]);

  // ── Start / countdown ────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    [intervalRef,timerRef,cdRef].forEach(r => { if(r.current){clearInterval(r.current);r.current=null;} });

    setSnake(INIT_SNAKE); setFood({pos:randomCell(INIT_SNAKE),pulse:0});
    setBonusFood(null); setPowerUp(null); setActivePower(null);
    setDirection('RIGHT');
    pendDir.current='RIGHT';
    queuedDirRef.current=null;
    inputLockRef.current=false;
    setScore(0); setLevel(1); setFoodEaten(0); setComboStreak(0);
    setGhostMode(false); setShieldActive(false); setSlowActive(false); setDoubleScore(false);
    setTotalTime(0);
    particlesRef.current = [];
    floatsRef.current = [];
    R.current.particles = [];
    R.current.floats = [];

    timerRef.current = setInterval(() => {
      setTotalTime(p => { if(p>=60) unlock('survive_60'); return p+1; });
    }, 1000);

    let n=3; setCountdown(n); setGameState('COUNTDOWN');
    cdRef.current = setInterval(() => {
      n--; setCountdown(n);
      if (n<=0) {
        clearInterval(cdRef.current!);
        setGameState('RUNNING');
        intervalRef.current = setInterval(tick, SPEED[R.current.diff].base);
      }
    }, 800);
  }, [tick, unlock, INIT_SNAKE]);

  const togglePause = useCallback(() => {
    setGameState(g => {
      if (g==='RUNNING') {
        if(intervalRef.current)clearInterval(intervalRef.current);
        if(timerRef.current)clearInterval(timerRef.current);
        return 'PAUSED';
      }
      if (g==='PAUSED') {
        timerRef.current=setInterval(()=>setTotalTime(p=>p+1),1000);
        intervalRef.current=setInterval(tick,getSpeed(R.current.score,R.current.diff,R.current.slow));
        return 'RUNNING';
      }
      return g;
    });
  }, [tick,getSpeed]);

  useEffect(() => () => {
    [intervalRef,timerRef,cdRef].forEach(r=>{if(r.current)clearInterval(r.current);});
    if (holdRef.current) clearInterval(holdRef.current);
  }, []);

  useEffect(() => {
    if (R.current.state==='RUNNING') {
      if(intervalRef.current)clearInterval(intervalRef.current);
      intervalRef.current=setInterval(tick,getSpeed(R.current.score,R.current.diff,R.current.slow));
    }
  }, [tick,getSpeed]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const km:Record<string,Direction>={
      ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT',
      w:'UP',s:'DOWN',a:'LEFT',d:'RIGHT',W:'UP',S:'DOWN',A:'LEFT',D:'RIGHT',
    };
    const h = (e:KeyboardEvent) => {
      if ([' ','Escape','p','P'].includes(e.key)) {
        e.preventDefault();
        if (R.current.state==='RUNNING'||R.current.state==='PAUSED') togglePause();
        return;
      }
      if (e.key==='Enter' && (R.current.state==='IDLE'||R.current.state==='OVER')) { startGame(); return; }
      const nd=km[e.key];
      if (nd) { e.preventDefault(); requestDirection(nd); }
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  }, [requestDirection,togglePause,startGame]);

  // ── Swipe — FIX: track origin only, don't reset on move ──────────────────
  // Previous bug: tsRef was reset on every touchmove hit, losing the true origin.
  // Fix: only reset origin when a direction is successfully committed.
  const swipeOriginRef = useRef<{x:number;y:number}|null>(null);
  const swipeHandledRef = useRef(false);

  const SWIPE_THRESHOLD = useMemo(() => Math.max(20, Math.round(boardSize * 0.07)), [boardSize]);
  const AXIS_RATIO = 1.3; // dominant axis must be this much stronger than weaker

  const trySwipeDirection = useCallback((dx:number, dy:number) => {
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const dominant = Math.max(absX, absY);
    const weaker = Math.min(absX, absY);
    if (dominant < SWIPE_THRESHOLD) return false;
    if (weaker > dominant / AXIS_RATIO) return false; // too diagonal
    const nd: Direction = absX > absY ? (dx>0?'RIGHT':'LEFT') : (dy>0?'DOWN':'UP');
    return requestDirection(nd, 6);
  }, [SWIPE_THRESHOLD, AXIS_RATIO, requestDirection]);

  const onTouchStart = useCallback((e:React.TouchEvent) => {
    e.preventDefault();
    swipeOriginRef.current = { x:e.touches[0].clientX, y:e.touches[0].clientY };
    swipeHandledRef.current = false;
  }, []);

  const onTouchMove = useCallback((e:React.TouchEvent) => {
    if (!swipeOriginRef.current || swipeHandledRef.current) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - swipeOriginRef.current.x;
    const dy = e.touches[0].clientY - swipeOriginRef.current.y;
    if (trySwipeDirection(dx, dy)) {
      swipeHandledRef.current = true;
      // Reset origin to current touch so rapid swipes chain naturally
      swipeOriginRef.current = { x:e.touches[0].clientX, y:e.touches[0].clientY };
    }
  }, [trySwipeDirection]);

  const onTouchEnd = useCallback((e:React.TouchEvent) => {
    if (!swipeOriginRef.current) return;
    e.preventDefault();
    if (!swipeHandledRef.current) {
      const t = e.changedTouches[0];
      trySwipeDirection(
        t.clientX - swipeOriginRef.current.x,
        t.clientY - swipeOriginRef.current.y
      );
    }
    swipeOriginRef.current = null;
    swipeHandledRef.current = false;
  }, [trySwipeDirection]);

  // ── D-pad ────────────────────────────────────────────────────────────────
  const [pressedDir, setPressedDir] = useState<Direction|null>(null);
  const holdRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const dStart = useCallback((d:Direction) => {
    if (holdRef.current) clearInterval(holdRef.current);
    setPressedDir(d);
    requestDirection(d, 8);
    holdRef.current = setInterval(() => { requestDirection(d); }, 130);
  }, [requestDirection]);

  const dEnd = useCallback(() => {
    setPressedDir(null);
    if(holdRef.current) { clearInterval(holdRef.current); holdRef.current=null; }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const highScore  = highScores[difficulty] ?? 0;
  const isRunning  = gameState==='RUNNING';
  const isOver     = gameState==='OVER';
  const isIdle     = gameState==='IDLE';
  const isPaused   = gameState==='PAUSED';
  const isCounting = gameState==='COUNTDOWN';
  const unlockedCnt = achievements.filter(a=>a.unlocked).length;

  // D-pad button size: scales from 52 (tiny) → 58 (compact) → 62 (mobile) → 56 (desktop)
  // Dynamic D-pad sizing: scales with viewport, min 46px touch target (WCAG)
  const dPadBtnSize = Math.max(46, Math.min(64, Math.round(vw * 0.12)));

  const speedLabel = useMemo(() => {
    const {base,inc}=SPEED[difficulty];
    return Math.round((base-getSpeed(score,difficulty,slowActive))/inc+1);
  }, [score,difficulty,slowActive,getSpeed]);

  const rootGradient = isDark
    ? 'radial-gradient(circle at top left, rgba(96,239,255,0.20), transparent 34%), radial-gradient(circle at bottom right, rgba(255,0,204,0.16), transparent 30%), linear-gradient(145deg,#040511 0%,#0c1028 42%,#140a20 100%)'
    : 'radial-gradient(circle at top left, rgba(0,198,255,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(255,99,146,0.16), transparent 30%), linear-gradient(145deg,#f7fffe 0%,#eef5ff 45%,#edf3ff 100%)';

  const glassPanel: React.CSSProperties = {
    background: isDark ? 'rgba(11,16,36,0.62)' : 'rgba(255,255,255,0.62)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)'}`,
    boxShadow: isDark
      ? '0 18px 44px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 0.5px rgba(255,255,255,0.06)'
      : '0 20px 40px rgba(90,125,170,0.18), inset 0 1px 0 rgba(255,255,255,0.88)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  };
  const softInset = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 30px rgba(0,0,0,0.22)'
    : 'inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -14px 30px rgba(123,161,214,0.12)';

  const btnPri: React.CSSProperties = {
    background:T.btnPri, color:T.btnPriTxt, border:'none',
    borderRadius:'14px', fontFamily:"'Orbitron',monospace", fontWeight:800,
    fontSize: isTiny ? '10px' : isCompact ? '11px' : '12px',
    letterSpacing:'0.12em',
    padding: isTiny ? '9px 12px' : isCompact ? '10px 14px' : '11px 20px',
    cursor:'pointer',
    boxShadow: isDark ? `0 18px 34px ${T.uiAccent2}20, inset 0 1px 0 rgba(255,255,255,0.18)` : '0 16px 30px rgba(0,114,255,0.18), inset 0 1px 0 rgba(255,255,255,0.55)',
    transition:'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
  };
  const btnSec: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)',
    color:T.btnSecTxt, border:`1px solid ${T.btnSecBdr}`,
    borderRadius:'14px', fontFamily:"'Orbitron',monospace", fontWeight:700,
    fontSize: isTiny ? '10px' : isCompact ? '11px' : '12px',
    letterSpacing:'0.1em',
    padding: isTiny ? '8px 10px' : isCompact ? '9px 12px' : '10px 16px',
    cursor:'pointer', transition:'transform 0.18s ease, background 0.18s ease',
    backdropFilter:'blur(12px)',
  };
  const scoreBox: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(180deg, rgba(20,26,52,0.70), rgba(8,10,26,0.72))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(243,248,255,0.86))',
    border:`1px solid ${T.border}`,
    borderRadius:'16px',
    padding: isTiny ? '8px 10px' : isCompact ? '10px 12px' : '12px 14px',
    textAlign:'center',
    boxShadow:`${glassPanel.boxShadow}, ${softInset}`,
  };

  // ── Panel shell ───────────────────────────────────────────────────────────
  const PanelShell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background: isDark ? 'rgba(6,8,20,0.82)' : 'rgba(240,247,255,0.78)',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'16px 12px', overflowY:'auto', gap:'10px',
      backdropFilter:'blur(24px) saturate(140%)',
      WebkitBackdropFilter:'blur(24px) saturate(140%)',
      // Safe area insets for notch/home-indicator devices
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    }}>{children}</div>
  );

  const panelTitle = (txt:string) => (
    <h2 style={{
      fontFamily:"'Orbitron',monospace", color:T.uiAccent, margin:0,
      letterSpacing:'0.14em', fontSize:'clamp(15px,4vw,20px)', textTransform:'uppercase',
      textShadow: isDark ? `0 0 24px ${T.uiAccent}55` : '0 8px 22px rgba(0,114,255,0.16)',
    }}>{txt}</h2>
  );

  // D-pad button component
  const DBtn = ({ d, lbl }:{d:Direction;lbl:string}) => (
    <button
      type="button"
      aria-label={`Move ${d.toLowerCase()}`}
      style={{
        width:dPadBtnSize, height:dPadBtnSize, borderRadius:'12px',
        background: pressedDir===d ? `${T.uiAccent}33` : (isDark ? 'rgba(18,24,46,0.72)' : 'rgba(255,255,255,0.72)'),
        border:`1.5px solid ${pressedDir===d ? T.uiAccent : T.border}`,
        color: pressedDir===d ? T.uiAccent : T.uiSub,
        fontSize: isTiny ? '16px' : '18px',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', transition:'all 0.08s', userSelect:'none',
        WebkitTapHighlightColor:'transparent', touchAction:'none',
        boxShadow: pressedDir===d
          ? `0 10px 22px ${T.uiAccent}22, inset 0 1px 0 rgba(255,255,255,0.18)`
          : `${softInset}, 0 8px 18px rgba(0,0,0,0.08)`,
        backdropFilter:'blur(16px)',
      }}
      onPointerDown={(e)=>{ e.preventDefault(); dStart(d); }}
      onPointerUp={dEnd}
      onPointerLeave={dEnd}
      onPointerCancel={dEnd}
    >{lbl}</button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        /* Use 100svh (small viewport height) so the layout doesn't jump when
           the mobile browser toolbar hides/shows */
        html { height: 100%; }
        body {
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
          /* Prevent rubber-banding on iOS */
          position: fixed; width: 100%;
        }
        #root { width:100%; height:100%; }
        button { outline:none; -webkit-tap-highlight-color:transparent; }
        button:active { transform:scale(0.93); }
        @keyframes achSlide{from{transform:translateX(110%);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseGlow{0%,100%{opacity:0.8;}50%{opacity:1;}}
        @keyframes floatOrb{0%,100%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(0,-16px,0) scale(1.06);}}
        @keyframes softSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes staggerFadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
      `}</style>

      {/* ROOT */}
      <div style={{
        position:'fixed', inset:0,
        background:rootGradient,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        fontFamily:"'Rajdhani',sans-serif",
        overflow:'hidden',
        transition:'background 0.5s',
        // Account for notch/home-indicator
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}>
        {/* Ambient orbs */}
        <div style={{
          position:'absolute', inset:'-8% auto auto -12%', width:'42vw', height:'42vw',
          minWidth:180, minHeight:180, borderRadius:'50%',
          background: isDark ? 'rgba(96,239,255,0.13)' : 'rgba(0,198,255,0.14)',
          filter:'blur(22px)', animation:'floatOrb 9s ease-in-out infinite', pointerEvents:'none',
        }}/>
        <div style={{
          position:'absolute', inset:'auto -10% -14% auto', width:'38vw', height:'38vw',
          minWidth:180, minHeight:180, borderRadius:'50%',
          background: isDark ? 'rgba(255,0,204,0.12)' : 'rgba(255,120,120,0.12)',
          filter:'blur(24px)', animation:'floatOrb 12s ease-in-out infinite reverse', pointerEvents:'none',
        }}/>

        {/* SHELL — full height flex column */}
        <div style={{
          display:'flex', flexDirection:'column', width:'100%', height:'100%',
          maxWidth:'580px',
          padding: isTiny ? '6px 6px' : isCompact ? '8px 8px' : '10px 12px',
          gap: isTiny ? '4px' : isCompact ? '5px' : '7px',
          alignItems:'stretch', position:'relative', zIndex:1,
          // Allow scrolling on very short viewports (landscape phones)
          overflowX:'hidden' as const, overflowY:'auto' as const,
          WebkitOverflowScrolling:'touch',
        }}>

          {/* ── TOP BAR ── */}
          <div style={{
            ...glassPanel,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            gap:'6px', flexShrink:0, flexWrap:'nowrap',
            padding: isTiny ? '10px 10px' : isCompact ? '10px 12px' : '12px 16px',
            borderRadius:'20px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', minWidth:0 }}>
              <h1 style={{
                fontFamily:"'Orbitron',monospace", fontWeight:900,
                fontSize: isTiny ? '14px' : isCompact ? '16px' : 'clamp(16px,3.4vw,22px)',
                color:T.uiAccent, letterSpacing:'0.2em',
                textShadow: isDark ? `0 0 22px ${T.uiAccent}99` : '0 10px 24px rgba(0,114,255,0.18)',
                margin:0, flexShrink:0,
              }}>SNAKE</h1>
              <span style={{
                fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700,
                color:T.uiAccent2, background:`${T.uiAccent2}18`,
                border:`1px solid ${T.uiAccent2}44`, borderRadius:'999px',
                padding:'3px 6px', flexShrink:0,
              }}>LV{level}</span>
              {gameMode==='FREE_ROAM' && (
                <span style={{
                  fontSize:'8px', color:T.uiAccent2, fontWeight:700,
                  background:`${T.uiAccent2}14`, border:`1px solid ${T.uiAccent2}33`,
                  borderRadius:'4px', padding:'1px 4px', flexShrink:0,
                }}>🌀WRAP</span>
              )}
            </div>
            {/* Icon buttons */}
            <div style={{ display:'flex', gap:'3px', flexShrink:0 }}>
              {[
                { icon:'🎨', tip:'Skins',        p:'skins'        as const },
                { icon:'🏆', tip:'Achievements', p:'achievements' as const },
                { icon:'📊', tip:'Scores',       p:'scores'       as const },
                { icon:'⚙️', tip:'Settings',     p:'settings'     as const },
              ].map(btn => (
                <button key={btn.p} title={btn.tip} onClick={()=>setPanel(btn.p)} style={{
                  ...glassPanel, border:`1px solid ${T.border}`, borderRadius:'12px',
                  color:T.uiSub, cursor:'pointer',
                  padding: isTiny ? '6px 7px' : '7px 8px',
                  fontSize: isTiny ? '12px' : '13px',
                  lineHeight:'1', display:'flex', alignItems:'center', gap:'3px',
                  transition:'transform 0.18s ease',
                }}>
                  {btn.icon}
                  {btn.p==='achievements' && (
                    <span style={{ fontSize:'8px', color:T.uiAccent }}>{unlockedCnt}</span>
                  )}
                </button>
              ))}
              <button style={{
                ...glassPanel, border:`1px solid ${T.border}`, borderRadius:'12px',
                color: isDark ? '#ffd200' : T.uiSub, cursor:'pointer',
                padding: isTiny ? '6px 7px' : '7px 8px',
                fontSize: isTiny ? '12px' : '13px',
                transition:'transform 0.18s ease',
              }} onClick={()=>setThemeKey(k=>k==='dark'?'light':'dark')}>
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* ── SCORE ROW ── */}
          <div style={{
            display:'grid',
            // Always 4 columns but cells shrink; on truly tiny screens they're still readable
            gridTemplateColumns: isTiny
              ? 'repeat(2,minmax(0,1fr))'
              : 'repeat(4,minmax(0,1fr))',
            gap: isTiny ? '4px' : '6px',
            flexShrink:0,
          }}>
            {[
              { l:'Score',  v:score,            accent:false },
              { l:'Best',   v:highScore,         accent:true  },
              { l:'Speed',  v:`${speedLabel}x`,  accent:false },
              { l:'Length', v:snake.length,       accent:false },
            ].map(it => (
              <div key={it.l} style={{ ...scoreBox, position:'relative', overflow:'hidden' }}>
                <div style={{
                  position:'absolute', inset:'0 auto auto 0', width:'40%', height:'1px',
                  background:`linear-gradient(90deg, ${T.uiAccent}66, transparent)`,
                }}/>
                <span style={{
                  display:'block', fontSize:'7px', fontWeight:700,
                  letterSpacing:'0.16em', color:T.uiSub, textTransform:'uppercase', marginBottom:'4px',
                }}>{it.l}</span>
                <span style={{
                  display:'block', fontFamily:"'Orbitron',monospace",
                  fontSize: isTiny ? '12px' : isCompact ? '13px' : 'clamp(12px,2.5vw,17px)',
                  fontWeight:800, color: it.accent ? T.uiAccent : T.uiText, lineHeight:'1.1',
                }}>{it.v}</span>
              </div>
            ))}
          </div>

          {/* ── GAME CANVAS AREA — flex:1 so it fills remaining space ── */}
          <div style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            minHeight:0, position:'relative',
          }}>
            <div style={{
              position:'relative', width:boardSize, height:boardSize,
              borderRadius:'24px', overflow:'hidden',
              background: isDark ? 'rgba(8,12,28,0.56)' : 'rgba(255,255,255,0.60)',
              border:`1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)'}`,
              boxShadow: isDark
                ? `0 20px 50px rgba(0,0,0,0.45), 0 0 0 1.5px ${T.border}, inset 0 1px 0 rgba(255,255,255,0.10)${isRunning ? ', 0 0 22px rgba(96,239,255,0.12)' : ''}`
                : `0 20px 46px rgba(77,119,191,0.18), 0 0 0 1.5px ${T.border}, inset 0 1px 0 rgba(255,255,255,0.78)${isRunning ? ', 0 0 22px rgba(0,114,255,0.10)' : ''}`,
              transition:'box-shadow 0.4s ease',
              backdropFilter:'blur(20px)',
              touchAction:'none', // critical: prevents browser scroll while swiping
              flexShrink:0,
            }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Sheen overlay */}
              <div style={{
                position:'absolute', inset:'0 0 auto 0', height:'30%',
                background:'linear-gradient(180deg, rgba(255,255,255,0.10), transparent)',
                pointerEvents:'none', zIndex:1, borderRadius:'24px 24px 0 0',
              }}/>

              {/* THE CANVAS — CSS size = boardSize, physical size = LOGICAL_SIZE * dpr */}
              <canvas ref={canvasRef} style={{ display:'block', width:boardSize, height:boardSize }} />

              {/* IDLE overlay */}
              {isIdle && (
                <div style={{
                  position:'absolute', inset:0,
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(8,12,28,0.92), rgba(8,12,28,0.80))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.90), rgba(245,249,255,0.80))',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap: isTiny ? '10px' : '13px',
                  borderRadius:'24px', backdropFilter:'blur(18px) saturate(145%)',
                  padding: isTiny ? '14px' : isCompact ? '16px' : '24px',
                  animation:'fadeUp 0.35s ease',
                }}>
                  <div style={{
                    fontFamily:"'Orbitron',monospace",
                    fontSize: isTiny ? '28px' : isCompact ? '32px' : 'clamp(28px,7vw,46px)',
                    fontWeight:900, color:T.uiAccent, letterSpacing:'0.18em',
                    textShadow: isDark ? `0 0 28px ${T.uiAccent}` : '0 12px 28px rgba(0,114,255,0.20)',
                  }}>SNAKE</div>

                  {!isTiny && (
                    <p style={{
                      color:T.uiSub, fontSize:'11px', textAlign:'center',
                      letterSpacing:'0.22em', textTransform:'uppercase', margin:0,
                    }}>Neon arcade, rebuilt for touch</p>
                  )}

                  {/* Game Mode Selection */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns: isTiny ? '1fr' : '1fr 1fr',
                    gap:'7px', width:'100%',
                    maxWidth: isTiny ? '200px' : '300px',
                  }}>
                    {([['CLASSIC','🧱','Borders are fatal'],['FREE_ROAM','🌀','Wrap around edges']] as const).map(([mode,icon,sub])=>(
                      <button key={mode} style={{
                        ...glassPanel, padding: isTiny ? '10px 8px' : '12px 8px', borderRadius:'16px',
                        background: gameMode===mode
                          ? (isDark ? 'linear-gradient(180deg, rgba(96,239,255,0.20), rgba(10,18,36,0.72))' : 'linear-gradient(180deg, rgba(0,114,255,0.10), rgba(255,255,255,0.72))')
                          : glassPanel.background as string,
                        border:`1.5px solid ${gameMode===mode ? T.uiAccent : T.border}`,
                        color: gameMode===mode ? T.uiAccent : T.uiSub, cursor:'pointer',
                        transition:'all 0.2s', display:'flex', flexDirection:'column', alignItems:'center',
                        boxShadow: gameMode===mode ? `0 16px 28px ${T.uiAccent}18` : glassPanel.boxShadow as string,
                      }} onClick={()=>setGameMode(mode as GameMode)}>
                        <span style={{ fontSize: isTiny ? '16px' : '18px', marginBottom:'3px' }}>{icon}</span>
                        <span style={{ fontFamily:"'Orbitron',monospace", fontSize: isTiny ? '9px' : '11px', fontWeight:700 }}>{mode.replace('_',' ')}</span>
                        {!isTiny && <span style={{ fontSize:'8px', marginTop:'2px', opacity:0.75 }}>{sub}</span>}
                        <span style={{ fontSize:'9px', color:T.uiAccent2, marginTop:'3px' }}>Lv.{savedLevels[mode as GameMode]}</span>
                      </button>
                    ))}
                  </div>

                  <button style={{ ...btnPri, fontSize: isTiny ? '12px' : '13px', padding: isTiny ? '12px 28px' : '13px 36px', textTransform:'uppercase', letterSpacing:'0.16em' }} onClick={startGame}>
                    START GAME
                  </button>
                </div>
              )}

              {/* GAME OVER overlay */}
              {isOver && (
                <div style={{
                  position:'absolute', inset:0,
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(12,6,20,0.92), rgba(8,10,26,0.86))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,249,255,0.84))',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap: isTiny ? '8px' : '11px',
                  borderRadius:'24px', backdropFilter:'blur(18px) saturate(145%)',
                  padding: isTiny ? '14px' : '20px',
                  animation:'fadeUp 0.35s ease',
                }}>
                  <div style={{
                    fontFamily:"'Orbitron',monospace",
                    fontSize: isTiny ? '16px' : isCompact ? '20px' : 'clamp(18px,5vw,26px)',
                    fontWeight:900, color:T.food1, letterSpacing:'0.14em',
                    textShadow: isDark ? `0 0 22px ${T.food1}` : '0 10px 24px rgba(255,65,108,0.18)',
                  }}>GAME OVER</div>

                  <div style={{ ...scoreBox, padding: isTiny ? '10px 14px' : '12px 20px', minWidth: isTiny ? 130 : 160 }}>
                    <div style={{ fontSize:'8px', letterSpacing:'0.2em', textTransform:'uppercase', color:T.uiSub, marginBottom:'6px' }}>Final Score</div>
                    <div style={{
                      fontFamily:"'Orbitron',monospace",
                      fontSize: isTiny ? '24px' : isCompact ? '30px' : 'clamp(26px,6vw,42px)',
                      fontWeight:900, color:T.uiText, lineHeight:1,
                    }}>{score}<span style={{ fontSize:'12px', color:T.uiSub, marginLeft:'2px' }}>pts</span></div>
                  </div>

                  {score>=highScore && score>0 && (
                    <div style={{
                      ...glassPanel, fontFamily:"'Orbitron',monospace", fontSize:'10px',
                      color:T.uiAccent, letterSpacing:'0.1em', animation:'pulseGlow 1s infinite',
                      padding:'7px 10px', borderRadius:'999px',
                    }}>🏆 NEW {difficulty} RECORD!</div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', width:'100%', maxWidth:220 }}>
                    {[['TIME',`${totalTime}s`],['LENGTH',snake.length],['LEVEL',level],['EATEN',foodEaten]].map(([l,v],i)=>(
                      <div key={l} style={{ ...scoreBox, padding: isTiny ? '7px 6px' : '9px 8px', animation:'staggerFadeUp 0.4s ease both', animationDelay:`${(i as number)*0.08}s` }}>
                        <span style={{ display:'block', fontSize:'8px', fontWeight:700, color:T.uiSub, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'3px' }}>{l}</span>
                        <span style={{ display:'block', fontFamily:"'Orbitron',monospace", fontSize: isTiny ? '12px' : '14px', fontWeight:700, color:T.uiText }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'flex', gap:'7px', flexWrap:'wrap', justifyContent:'center' }}>
                    <button style={{ ...btnPri, padding: isTiny ? '10px 20px' : '11px 24px' }} onClick={startGame}>↺ PLAY AGAIN</button>
                    <button style={{ ...btnSec, padding: isTiny ? '9px 12px' : '10px 14px' }} onClick={()=>setGameState('IDLE')}>MENU</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── ACTIVE POWER-UPS / COMBO ── */}
          <div style={{
            display:'flex', gap:'6px', justifyContent:'center',
            flexShrink:0, minHeight: isTiny ? 0 : 28, flexWrap:'wrap',
          }}>
            {activePower && (() => {
              const info: Record<PowerUpType,{icon:string;label:string;color:string}> = {
                SHIELD:     {icon:'🛡',label:'SHIELD',  color:'#ffd200'},
                SLOW:       {icon:'🐢',label:'SLOW-MO', color:'#00c6ff'},
                DOUBLE:     {icon:'×2',label:'DOUBLE',  color:'#00ff87'},
                GHOST_MODE: {icon:'👻',label:'GHOST',   color:'#cc88ff'},
              };
              const nfo=info[activePower.type], pct=activePower.ttl/200;
              return (
                <div style={{
                  background: isDark ? `${nfo.color}16` : 'rgba(255,255,255,0.72)',
                  border:`1px solid ${nfo.color}55`, borderRadius:'12px',
                  padding: isTiny ? '5px 9px' : '7px 11px',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'2px',
                  fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700, color:nfo.color,
                  boxShadow:`0 12px 24px ${nfo.color}16`, backdropFilter:'blur(12px)',
                }}>
                  <span>{nfo.icon} {nfo.label}</span>
                  <div style={{ width:60, height:3, background:`${nfo.color}28`, borderRadius:2 }}>
                    <div style={{ width:`${pct*100}%`, height:'100%', background:nfo.color, borderRadius:2, transition:'width 0.1s' }}/>
                  </div>
                </div>
              );
            })()}
            {comboStreak>1 && (
              <div style={{
                background: isDark ? 'rgba(255,106,0,0.15)' : 'rgba(255,255,255,0.75)',
                border:'1px solid rgba(255,106,0,0.5)', borderRadius:'12px',
                padding: isTiny ? '5px 9px' : '7px 11px',
                fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700, color:'#ff6a00',
                animation:'pulseGlow 0.8s infinite', boxShadow:'0 12px 24px rgba(255,106,0,0.14)',
                backdropFilter:'blur(12px)',
              }}>🔥 ×{comboStreak} COMBO</div>
            )}
          </div>

          {/* ── ACTION BUTTONS ── */}
          <div style={{
            ...glassPanel,
            display:'flex', justifyContent:'center', gap:'6px',
            flexShrink:0, flexWrap:'wrap',
            padding: isTiny ? '7px 8px' : '8px 10px',
            borderRadius:'18px',
            // Hide entirely when idle/over (those screens have their own buttons)
            opacity: (isRunning||isPaused||isCounting) ? 1 : 0,
            pointerEvents: (isRunning||isPaused||isCounting) ? 'auto' : 'none',
            transition:'opacity 0.2s',
          }}>
            <button style={btnPri} onClick={togglePause}>
              {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button style={btnSec} onClick={startGame}>↺ RESTART</button>
            <button style={{ ...btnSec, border:'none', background:'transparent' }} onClick={()=>setGameState('IDLE')}>✕ EXIT</button>
          </div>

          {/* ── D-PAD ── */}
          <div style={{
            ...glassPanel,
            display:'grid',
            gridTemplateColumns:`repeat(3,${dPadBtnSize}px)`,
            gridTemplateRows:`repeat(3,${dPadBtnSize}px)`,
            gap: isTiny ? '6px' : isCompact ? '7px' : '9px',
            margin:'0 auto',
            flexShrink:0,
            touchAction:'none',
            padding: isTiny ? '9px' : isCompact ? '11px' : '13px',
            borderRadius:'22px',
          }}>
            <div/><DBtn d="UP"    lbl="▲"/><div/>
            <DBtn d="LEFT" lbl="◀"/>
            <div style={{
              width:dPadBtnSize, height:dPadBtnSize, borderRadius:'12px',
              background:T.scoreBg, border:`1px solid ${T.border}`,
              opacity:0.3, display:'flex', alignItems:'center', justifyContent:'center',
              color:T.uiSub, fontSize:'14px',
            }}>●</div>
            <DBtn d="RIGHT" lbl="▶"/>
            <div/><DBtn d="DOWN"  lbl="▼"/><div/>
          </div>

          {/* Keyboard hint — hide on tiny screens to save vertical space */}
          {!isTiny && !isCompact && (
            <p style={{
              textAlign:'center', color:T.uiSub, fontSize:'8px',
              letterSpacing:'0.14em', flexShrink:0, textTransform:'uppercase', opacity:0.8,
            }}>↑↓←→ · WASD · SPACE=pause · ENTER=start</p>
          )}
        </div>

        {/* ── SETTINGS PANEL ── */}
        {panel==='settings' && (
          <PanelShell>
            {panelTitle('SETTINGS')}
            <div style={{ width:'100%', maxWidth:360, display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                { label:'SHOW GRID',       val:showGrid, fn:setShowGrid },
                { label:'HAPTIC FEEDBACK', val:haptics,  fn:setHaptics  },
              ].map(o => (
                <div key={o.label} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:T.scoreBg, border:`1px solid ${T.border}`,
                  borderRadius:'12px', padding:'12px 14px',
                }}>
                  <span style={{ color:T.uiText, fontWeight:600, fontSize:'13px' }}>{o.label}</span>
                  <button style={{
                    background: o.val ? T.btnPri : 'transparent',
                    border:`1.5px solid ${o.val ? 'transparent' : T.btnSecBdr}`,
                    borderRadius:'20px', width:44, height:22, cursor:'pointer',
                    position:'relative', transition:'all 0.2s',
                  }} onClick={()=>o.fn(!o.val)}>
                    <div style={{
                      position:'absolute', top:2, left: o.val?22:2,
                      width:18, height:18, borderRadius:'50%', background:'#fff',
                      transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                    }}/>
                  </button>
                </div>
              ))}

              <div style={{ background:T.scoreBg, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'12px 14px' }}>
                <span style={{ color:T.uiText, fontWeight:600, fontSize:'13px', display:'block', marginBottom:'8px' }}>DIFFICULTY</span>
                <div style={{ display:'flex', gap:'5px' }}>
                  {DIFFS.map(d=>(
                    <button key={d} style={{
                      ...btnSec, flex:1,
                      background: difficulty===d ? T.btnPri : 'transparent',
                      color: difficulty===d ? T.btnPriTxt : T.btnSecTxt,
                      border:`1.5px solid ${difficulty===d ? 'transparent' : T.btnSecBdr}`,
                    }} onClick={()=>setDifficulty(d)}>{d}</button>
                  ))}
                </div>
              </div>

              <div style={{ background:T.scoreBg, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'12px 14px' }}>
                <span style={{ color:T.uiText, fontWeight:600, fontSize:'13px', display:'block', marginBottom:'8px' }}>THEME</span>
                <div style={{ display:'flex', gap:'5px' }}>
                  {(['light','dark'] as ThemeKey[]).map(k=>(
                    <button key={k} style={{
                      ...btnSec, flex:1,
                      background: themeKey===k ? T.btnPri : 'transparent',
                      color: themeKey===k ? T.btnPriTxt : T.btnSecTxt,
                      border:`1.5px solid ${themeKey===k ? 'transparent' : T.btnSecBdr}`,
                    }} onClick={()=>setThemeKey(k)}>{k==='dark'?'🌙 DARK':'☀️ LIGHT'}</button>
                  ))}
                </div>
              </div>
            </div>
            <button style={{ ...btnPri, marginTop:'6px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ── SKINS PANEL ── */}
        {panel==='skins' && (
          <PanelShell>
            {panelTitle('SKINS')}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'7px', width:'100%', maxWidth:360 }}>
              {(Object.entries(SKIN_DEFS) as [SkinId,typeof SKIN_DEFS[SkinId]][]).map(([id,def])=>(
                <button key={id} style={{
                  background: skin===id ? `${T.uiAccent}20` : T.scoreBg,
                  border:`1.5px solid ${skin===id ? T.uiAccent : T.border}`,
                  borderRadius:'12px', padding:'10px 7px', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', transition:'all 0.15s',
                }} onClick={()=>setSkin(id)}>
                  <span style={{ fontSize:'22px' }}>{def.icon}</span>
                  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700, color: skin===id ? T.uiAccent : T.uiText }}>{def.name}</span>
                  <div style={{ display:'flex', gap:'3px' }}>
                    {[def.head[0],def.body[0],def.body[1]].map((c,i)=>(
                      <div key={i} style={{ width:8,height:8,borderRadius:'50%',background:c }}/>
                    ))}
                  </div>
                  {skin===id && <span style={{ fontSize:'11px' }}>✓</span>}
                </button>
              ))}
            </div>
            <button style={{ ...btnPri, marginTop:'6px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ── ACHIEVEMENTS PANEL ── */}
        {panel==='achievements' && (
          <PanelShell>
            {panelTitle('ACHIEVEMENTS')}
            <p style={{ color:T.uiSub, fontSize:'12px', margin:0 }}>{unlockedCnt} / {achievements.length} unlocked</p>
            <div style={{ width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:'5px' }}>
              {achievements.map(a=>(
                <div key={a.id} style={{
                  background: a.unlocked ? T.scoreBg : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.025)'),
                  border:`1px solid ${a.unlocked ? T.uiAccent+'44' : T.border}`,
                  borderRadius:'10px', padding:'9px 12px',
                  display:'flex', alignItems:'center', gap:'9px', opacity: a.unlocked ? 1 : 0.42,
                }}>
                  <span style={{ fontSize:'18px', minWidth:24 }}>{a.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'11px', color:T.uiText, fontFamily:"'Orbitron',monospace" }}>{a.label}</div>
                    <div style={{ fontSize:'10px', color:T.uiSub }}>{a.desc}</div>
                  </div>
                  {a.unlocked && <span style={{ color:T.uiAccent, fontSize:'13px' }}>✓</span>}
                </div>
              ))}
            </div>
            <button style={{ ...btnPri, marginTop:'6px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ── HIGH SCORES PANEL ── */}
        {panel==='scores' && (
          <PanelShell>
            {panelTitle('HIGH SCORES')}
            <div style={{ width:'100%', maxWidth:320, display:'flex', flexDirection:'column', gap:'7px' }}>
              {DIFFS.map((d,i)=>(
                <div key={d} style={{ ...scoreBox, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
                    <span style={{ fontSize:'20px' }}>{i===0?'🧊':i===1?'🎯':'🚀'}</span>
                    <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'12px', fontWeight:700, color:T.uiText }}>{d}</span>
                  </div>
                  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'20px', fontWeight:900, color:T.uiAccent }}>{highScores[d]??0}</span>
                </div>
              ))}
              <div style={{ ...scoreBox, padding:'13px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'9px', color:T.uiSub, marginBottom:'4px', letterSpacing:'0.1em' }}>TOTAL FOOD EATEN</div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'22px', fontWeight:900, color:T.uiAccent }}>{foodEaten}</div>
              </div>
              <div style={{ ...scoreBox, padding:'13px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'9px', color:T.uiSub, marginBottom:'4px', letterSpacing:'0.1em' }}>ACHIEVEMENTS</div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'20px', fontWeight:900, color:T.uiAccent2 }}>{unlockedCnt}/{achievements.length}</div>
              </div>
            </div>
            <button style={{ ...btnPri, marginTop:'6px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ── ACHIEVEMENT TOAST ── */}
        {newAch && (
          <div style={{
            position:'fixed', bottom:'max(20px, calc(20px + env(safe-area-inset-bottom)))', right:12, zIndex:200,
            background: isDark
              ? 'linear-gradient(180deg, rgba(10,8,28,0.97), rgba(8,14,32,0.94))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(244,249,255,0.96))',
            border:`1.5px solid ${T.uiAccent}`,
            borderRadius:'16px', padding:'11px 14px',
            display:'flex', alignItems:'center', gap:'9px',
            boxShadow:'0 16px 32px rgba(0,0,0,0.22)',
            animation:'achSlide 0.4s ease',
            backdropFilter:'blur(18px)', maxWidth:'250px',
          }}>
            <span style={{ fontSize:'24px' }}>{newAch.icon}</span>
            <div>
              <div style={{ fontSize:'7px', letterSpacing:'0.12em', color:T.uiAccent, fontWeight:700, fontFamily:"'Orbitron',monospace" }}>ACHIEVEMENT UNLOCKED</div>
              <div style={{ fontSize:'11px', fontWeight:700, color:T.uiText, fontFamily:"'Orbitron',monospace" }}>{newAch.label}</div>
              <div style={{ fontSize:'9px', color:T.uiSub }}>{newAch.desc}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SnakeGame;