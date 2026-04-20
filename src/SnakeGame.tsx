import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Point        = { x: number; y: number };
type Direction    = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState    = 'IDLE' | 'RUNNING' | 'PAUSED' | 'OVER' | 'COUNTDOWN';
type Difficulty   = 'CHILL' | 'NORMAL' | 'TURBO';
type PowerUpType  = 'SHIELD' | 'SLOW' | 'DOUBLE' | 'GHOST_MODE';
type SkinId       = 'classic' | 'neon' | 'fire' | 'ice' | 'gold' | 'rainbow';
type GameMode     = 'CLASSIC' | 'FREE_ROAM';
type Achievement  = { id: string; label: string; icon: string; desc: string; unlocked: boolean; ts?: number; };
type FloatingText = { id: number; x: number; y: number; text: string; color: string; };
type Particle     = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const CELL = 20;
const COLS = 20;
const ROWS = 20;
const CS   = CELL * COLS; // 400

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
// CANVAS DRAW
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
  const W=CS, H=CS, T=theme;

  // BG
  const bgG = ctx.createLinearGradient(0,0,W,H);
  T.bg.forEach((c,i) => bgG.addColorStop(i/(T.bg.length-1), c));
  ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

  // Scanlines
  if (dark) {
    for (let y=0; y<H; y+=4) { ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(0,y,W,1); }
  }

  // Grid
  if (showGrid) {
    ctx.strokeStyle = T.gridLine; ctx.lineWidth = 0.5;
    for (let i=0; i<=COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i*CELL,0); ctx.lineTo(i*CELL,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*CELL); ctx.lineTo(W,i*CELL); ctx.stroke();
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

  // Power-up on board
  if (powerUp) {
    const px=powerUp.pos.x*CELL+CELL/2, py=powerUp.pos.y*CELL+CELL/2;
    const pulse=0.78+Math.sin(powerUp.pulse)*0.22;
    const r=(CELL/2-1)*pulse;
    ctx.save();
    ctx.shadowColor='#ffd200'; ctx.shadowBlur=dark?22:10;
    const pG=ctx.createRadialGradient(px,py,1,px,py,r);
    pG.addColorStop(0,'#fffacc'); pG.addColorStop(1,'#ffd200');
    ctx.fillStyle=pG; rrect(ctx,px-r,py-r,r*2,r*2,5); ctx.fill();
    ctx.shadowBlur=0;
    const icons:Record<PowerUpType,string>={SHIELD:'🛡',SLOW:'🐢',DOUBLE:'×2',GHOST_MODE:'👻'};
    ctx.font=`bold ${CELL-5}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(icons[powerUp.type],px,py);
    ctx.restore();
  }

  // Bonus food
  if (bonusFood) {
    const bx=bonusFood.pos.x*CELL+CELL/2, by=bonusFood.pos.y*CELL+CELL/2;
    ctx.save(); ctx.globalAlpha=Math.min(1,bonusFood.ttl/40);
    ctx.shadowColor='#ff00cc'; ctx.shadowBlur=dark?20:9;
    const bG=ctx.createRadialGradient(bx,by,1,bx,by,CELL/2-1);
    bG.addColorStop(0,'#ff00cc'); bG.addColorStop(1,'#7b00ff');
    ctx.fillStyle=bG; rrect(ctx,bonusFood.pos.x*CELL+2,bonusFood.pos.y*CELL+2,CELL-4,CELL-4,6);
    ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.font=`bold ${CELL-5}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★',bx,by); ctx.restore();
  }

  // Main food
  {
    const fx=food.pos.x*CELL+CELL/2, fy=food.pos.y*CELL+CELL/2;
    const pulse=0.84+Math.sin(food.pulse)*0.16;
    const r=(CELL/2-1.5)*pulse;
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
    const x=seg.x*CELL+1, y=seg.y*CELL+1, sz=CELL-2;
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
      const cx=hp.x*CELL+CELL/2, cy=hp.y*CELL+CELL/2;
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
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SnakeGame: React.FC = () => {

  // ── Preferences ─────────────────────────────────────────────────────────
  const [themeKey, setThemeKey]       = useState<ThemeKey>(() => lsGet('sng_theme','light') as ThemeKey);
  const [skin, setSkin]               = useState<SkinId>(() => lsGet('sng_skin','classic') as SkinId);
  const [difficulty, setDifficulty]   = useState<Difficulty>(() => lsGet('sng_diff','NORMAL') as Difficulty);
  const [showGrid, setShowGrid]       = useState(() => lsGet('sng_grid','1')==='1');
  const [haptics, setHaptics]         = useState(() => lsGet('sng_haptic','1')==='1');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [enlarged, setEnlarged]       = useState(false);
  
  const T = THEMES[themeKey];
  const isDark = themeKey === 'dark';

  useEffect(() => { lsSet('sng_theme',themeKey); }, [themeKey]);
  useEffect(() => { lsSet('sng_skin',skin); }, [skin]);
  useEffect(() => { lsSet('sng_diff',difficulty); }, [difficulty]);
  useEffect(() => { lsSet('sng_grid',showGrid?'1':'0'); }, [showGrid]);
  useEffect(() => { lsSet('sng_haptic',haptics?'1':'0'); }, [haptics]);

  // ── Wrap mode high level (saved in localStorage) ────────────────────────
  const [wrapHighLevel, setWrapHighLevel] = useState<number>(() => {
    try { return parseInt(lsGet('sng_wrap_level','1')) || 1; } catch { return 1; }
  });
  const [classicHighLevel, setClassicHighLevel] = useState<number>(() => {
    try { return parseInt(lsGet('sng_classic_level','1')) || 1; } catch { return 1; }
  });

  // ── Game state ───────────────────────────────────────────────────────────
  const INIT_SNAKE: Point[] = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  const [snake, setSnake]             = useState<Point[]>(INIT_SNAKE);
  const [direction, setDirection]     = useState<Direction>('RIGHT');
  const pendDir                       = useRef<Direction>('RIGHT');
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
  const [rainbowHue, setRainbowHue]   = useState(0);

  // Update levels
  useEffect(() => {
    if (selectedMode === 'FREE_ROAM' && level > wrapHighLevel) {
      setWrapHighLevel(level);
      lsSet('sng_wrap_level', level.toString());
    } else if (selectedMode === 'CLASSIC' && level > classicHighLevel) {
      setClassicHighLevel(level);
      lsSet('sng_classic_level', level.toString());
    }
  }, [level, selectedMode, wrapHighLevel, classicHighLevel]);

  // ── High scores & achievements ───────────────────────────────────────────
  const [highScores, setHighScores]   = useState<Record<Difficulty,number>>(() => {
    try { return JSON.parse(lsGet('sng_hs2','null')) ?? {CHILL:0,NORMAL:0,TURBO:0}; }
    catch { return {CHILL:0,NORMAL:0,TURBO:0}; }
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
  const [particles, setParticles]     = useState<Particle[]>([]);
  const [floats, setFloats]           = useState<FloatingText[]>([]);
  const floatId                       = useRef(0);
  const [canvasScale, setCanvasScale] = useState(1);
  const [panel, setPanel]             = useState<null|'settings'|'skins'|'achievements'|'scores'>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const animRef     = useRef<number>(0);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const cdRef       = useRef<ReturnType<typeof setInterval>|null>(null);
  const pulseRef    = useRef(0);
  const rhRef       = useRef(0);

  // Syncing refs to avoid stale closures in animation frame
  const R = useRef({
    snake:INIT_SNAKE, dir:'RIGHT' as Direction, food:{pos:randomCell(INIT_SNAKE),pulse:0},
    bonus:null as {pos:Point;ttl:number}|null,
    pu:null as {pos:Point;type:PowerUpType;pulse:number}|null,
    ap:null as {type:PowerUpType;ttl:number}|null,
    state:'IDLE' as GameState, score:0, diff:'NORMAL' as Difficulty,
    ghost:false, shield:false, double:false, slow:false,
    mode: 'CLASSIC' as GameMode, eaten:0, combo:0, particles:[] as Particle[], floats:[] as FloatingText[],
    skin: 'classic' as SkinId, themeKey: 'light' as ThemeKey, showGrid: true
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
  useEffect(() => { R.current.mode   = selectedMode ?? 'CLASSIC'; }, [selectedMode]);
  useEffect(() => { R.current.eaten  = foodEaten;   }, [foodEaten]);
  useEffect(() => { R.current.combo  = comboStreak; }, [comboStreak]);
  useEffect(() => { R.current.particles = particles;}, [particles]);
  useEffect(() => { R.current.floats = floats;      }, [floats]);
  useEffect(() => { R.current.skin   = skin;        }, [skin]);
  useEffect(() => { R.current.themeKey = themeKey;  }, [themeKey]);
  useEffect(() => { R.current.showGrid = showGrid;  }, [showGrid]);

  // ── Canvas sizing (Responsive + maximizes scale to fit space) ────────────────
  useEffect(() => {
    const measure = () => {
      if (!gameAreaRef.current) return;
      const r = gameAreaRef.current.getBoundingClientRect();
      // Increased max scale limit significantly so canvas can expand to fill the area
      setCanvasScale(Math.min((r.width-2)/CS, (r.height-2)/CS, 4.0)); 
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (gameAreaRef.current) ro.observe(gameAreaRef.current);
    return () => ro.disconnect();
  }, [enlarged]); // Re-measure when layout expands

  // ── Animation & draw loop ─────────────────────────────────────────────────
  useEffect(() => {
    let af: number;
    const loop = () => {
      pulseRef.current += 0.08;
      rhRef.current = (rhRef.current + 1.5) % 360;
      setRainbowHue(rhRef.current);
      
      setFood(prev => ({ ...prev, pulse: pulseRef.current }));
      setPowerUp(prev => prev ? { ...prev, pulse: pulseRef.current } : null);
      
      setParticles(prev => prev
        .map(p => ({...p,x:p.x+p.vx,y:p.y+p.vy,vy:p.vy+0.07,life:p.life-0.024}))
        .filter(p=>p.life>0)
      );
      setFloats(prev => prev.map(f=>({...f,y:f.y-0.85})).filter(f=>f.y>-20));

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        // ALWAYS use R.current inside the loop to avoid stale closures
        const T_current = THEMES[R.current.themeKey];
        if (ctx) drawCanvas(ctx, {
          snake:R.current.snake, food:R.current.food, bonusFood:R.current.bonus,
          powerUp:R.current.pu, gameState:R.current.state, theme:T_current,
          dark:R.current.themeKey === 'dark', skin:R.current.skin, countdown, particles:R.current.particles,
          floats:R.current.floats, ghostMode:R.current.ghost,
          shieldActive:R.current.shield, rainbowHue:rhRef.current, showGrid:R.current.showGrid,
        });
      }
      af = requestAnimationFrame(loop);
    };
    af = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(af);
  }, [countdown]); 

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

  // ── Particles helper ──────────────────────────────────────────────────────
  const burst = useCallback((x:number,y:number,color:string,n=13) => {
    setParticles(prev => [...prev.slice(-90), ...Array.from({length:n},() => ({
      x,y,vx:(Math.random()-0.5)*4.5,vy:(Math.random()-0.5)*4.5-0.8,
      life:0.8+Math.random()*0.2,color,size:2+Math.random()*3,
    }))]);
  }, []);

  const floatAdd = useCallback((x:number,y:number,text:string,color:string) => {
    const id = ++floatId.current;
    setFloats(prev => [...prev.slice(-10), {id,x,y,text,color}]);
  }, []);

  // ── Speed ─────────────────────────────────────────────────────────────────
  const getSpeed = useCallback((sc:number, diff:Difficulty, slow:boolean):number => {
    const {base,min,inc} = SPEED[diff];
    const s = Math.max(min, base - Math.floor(sc/5)*inc);
    return slow ? Math.round(s*1.65) : s;
  }, []);

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

    // Game Mode Collision Logic
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

    // Self collision
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

      const px=nh.x*CELL+CELL/2, py=nh.y*CELL+CELL/2;
      burst(px,py,THEMES[R.current.themeKey].foodGlow,14);
      floatAdd(px,py, newCombo>1?`+${pts} ×${newCombo}`:`+${pts}`, R.current.themeKey==='dark'?'#60efff':'#0072ff');
      if (haptics) vibrate(7);

      setFood({ pos:randomCell(newSnake), pulse:pulseRef.current });

      if (Math.random()<0.22 && !R.current.bonus)
        setBonusFood({pos:randomCell(newSnake),ttl:130});
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

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, getSpeed(newScore,R.current.diff,R.current.slow));

      // Achievements
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
      const px=nh.x*CELL+CELL/2, py=nh.y*CELL+CELL/2;
      burst(px,py,'#ff00cc',20);
      floatAdd(px,py,`+${pts}★`,'#ff00cc');
      if (haptics) vibrate([8,4,8]);
      unlock('bonus_food');
    }

    if (atePU && R.current.pu) {
      const pt=R.current.pu.type;
      setPowerUp(null);
      setActivePower({type:pt,ttl:200});
      const px=nh.x*CELL+CELL/2, py=nh.y*CELL+CELL/2;
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

    // Decay bonus food
    if (R.current.bonus) {
      const ttl = R.current.bonus.ttl - 1;
      if (ttl<=0) setBonusFood(null);
      else setBonusFood({...R.current.bonus,ttl});
    }

    // Decay active power
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

    setDirection(d);
    setSnake(newSnake);
  }, [burst, floatAdd, getSpeed, haptics, unlock]);

  // ── Start / countdown ────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (selectedMode === null) return;
    [intervalRef,timerRef,cdRef].forEach(r => { if(r.current){clearInterval(r.current);r.current=null;} });

    setSnake(INIT_SNAKE); setFood({pos:randomCell(INIT_SNAKE),pulse:0});
    setBonusFood(null); setPowerUp(null); setActivePower(null);
    setDirection('RIGHT'); pendDir.current='RIGHT';
    setScore(0); setLevel(1); setFoodEaten(0); setComboStreak(0);
    setGhostMode(false); setShieldActive(false); setSlowActive(false); setDoubleScore(false);
    setTotalTime(0); setParticles([]); setFloats([]);
    
    setEnlarged(true);

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
  }, [tick, unlock, selectedMode]);

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
    cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    if (R.current.state==='RUNNING') {
      if(intervalRef.current)clearInterval(intervalRef.current);
      intervalRef.current=setInterval(tick,getSpeed(R.current.score,R.current.diff,R.current.slow));
    }
  }, [tick,getSpeed]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const opp:Record<Direction,Direction>={UP:'DOWN',DOWN:'UP',LEFT:'RIGHT',RIGHT:'LEFT'};
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
      if (nd&&nd!==opp[R.current.dir]) { e.preventDefault(); pendDir.current=nd; }
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  }, [togglePause,startGame]);

  // ── Swipe ────────────────────────────────────────────────────────────────
  const tsRef = useRef<{x:number;y:number}|null>(null);
  const onTouchStart = (e:React.TouchEvent) => { tsRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
  const onTouchEnd = (e:React.TouchEvent) => {
    if (!tsRef.current) return;
    const dx=e.changedTouches[0].clientX-tsRef.current.x, dy=e.changedTouches[0].clientY-tsRef.current.y;
    if (Math.abs(dx)<12&&Math.abs(dy)<12) return;
    const opp:Record<Direction,Direction>={UP:'DOWN',DOWN:'UP',LEFT:'RIGHT',RIGHT:'LEFT'};
    const nd:Direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'RIGHT':'LEFT'):(dy>0?'DOWN':'UP');
    if(nd!==opp[R.current.dir]) pendDir.current=nd;
    tsRef.current=null;
  };

  // ── D-pad ────────────────────────────────────────────────────────────────
  const [pressedDir, setPressedDir] = useState<Direction|null>(null);
  const holdRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const dStart = (d:Direction) => {
    const opp:Record<Direction,Direction>={UP:'DOWN',DOWN:'UP',LEFT:'RIGHT',RIGHT:'LEFT'};
    setPressedDir(d);
    if(d!==opp[R.current.dir]) pendDir.current=d;
    if(haptics) vibrate(4);
    holdRef.current=setInterval(()=>{if(d!==opp[R.current.dir])pendDir.current=d;},100);
  };
  const dEnd = () => { setPressedDir(null); if(holdRef.current)clearInterval(holdRef.current); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const highScore   = highScores[difficulty] ?? 0;
  const isRunning   = gameState==='RUNNING';
  const isOver      = gameState==='OVER';
  const isIdle      = gameState==='IDLE';
  const isPaused    = gameState==='PAUSED';
  const isCounting  = gameState==='COUNTDOWN';
  const isExpanded  = !isIdle; // Triggers full-screen UI expansion
  
  const speedLabel  = useMemo(() => {
    const {base,inc}=SPEED[difficulty];
    return Math.round((base-getSpeed(score,difficulty,slowActive))/inc+1);
  }, [score,difficulty,slowActive,getSpeed]);
  const unlockedCnt = achievements.filter(a=>a.unlocked).length;

  // ── Inline styles ─────────────────────────────────────────────────────────
  const btnPri: React.CSSProperties = {
    background:T.btnPri, color:T.btnPriTxt, border:'none',
    borderRadius:'8px', fontFamily:"'Orbitron',monospace", fontWeight:700,
    fontSize:'11px', letterSpacing:'0.08em', padding:'8px 18px',
    cursor:'pointer', boxShadow:isDark?`0 0 18px ${T.uiAccent2}44`:'0 4px 14px rgba(0,114,255,0.22)',
    transition:'all 0.18s',
  };
  const btnSec: React.CSSProperties = {
    background:T.btnSec, color:T.btnSecTxt, border:`1.5px solid ${T.btnSecBdr}`,
    borderRadius:'8px', fontFamily:"'Orbitron',monospace", fontWeight:700,
    fontSize:'11px', letterSpacing:'0.08em', padding:'7px 14px',
    cursor:'pointer', transition:'all 0.18s',
  };
  const scoreBox: React.CSSProperties = {
    background:T.scoreBg, border:`1px solid ${T.border}`,
    borderRadius:'8px', padding:'3px 4px', textAlign:'center',
  };
  const iconBtn: React.CSSProperties = {
    background:T.scoreBg, border:`1px solid ${T.border}`, borderRadius:'8px',
    color:T.uiSub, cursor:'pointer', padding:'4px 6px', fontSize:'13px',
    lineHeight:'1', display:'flex', alignItems:'center', gap:'3px', transition:'all 0.15s',
  };

  // ── Panel renderer ────────────────────────────────────────────────────────
  const PanelShell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:isDark?'rgba(6,6,20,0.97)':'rgba(245,249,255,0.97)',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'20px 16px', overflowY:'auto', gap:'10px',
      backdropFilter:'blur(14px)',
    }}>{children}</div>
  );

  const panelTitle = (txt:string) => (
    <h2 style={{ fontFamily:"'Orbitron',monospace", color:T.uiAccent, margin:0, letterSpacing:'0.1em', fontSize:'clamp(16px,4vw,22px)' }}>{txt}</h2>
  );

  // Dpad button
  const DBtn = ({ d, lbl }:{d:Direction;lbl:string}) => (
    <div
      style={{
        width:36, height:36, borderRadius:'8px',
        background:pressedDir===d?`${T.uiAccent}28`:T.scoreBg,
        border:`1.5px solid ${pressedDir===d?T.uiAccent:T.border}`,
        color:pressedDir===d?T.uiAccent:T.uiSub, fontSize:'14px',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', transition:'all 0.08s', userSelect:'none',
        WebkitTapHighlightColor:'transparent',
        boxShadow:pressedDir===d&&isDark?`0 0 12px ${T.uiAccent}55`:'none',
      }}
      onMouseDown={()=>dStart(d)} onMouseUp={dEnd} onMouseLeave={dEnd}
      onTouchStart={e=>{e.preventDefault();dStart(d);}} onTouchEnd={dEnd}
    >{lbl}</div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{width:100%;height:100%;overflow:hidden;}
        button{outline:none;-webkit-tap-highlight-color:transparent;}
        button:active{transform:scale(0.92);}
        @keyframes achSlide{from{transform:translateX(110%);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseGlow{0%,100%{opacity:0.8;}50%{opacity:1;}}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px;}
      `}</style>

      {/* ROOT */}
      <div style={{
        position:'fixed', inset:0,
        background:isDark
          ? `linear-gradient(135deg,${T.bg[0]},${T.bg[1]},${T.bg[2]})`
          : `linear-gradient(135deg,${T.bg[0]},${T.bg[1]},${T.bg[2]})`,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        fontFamily:"'Rajdhani',sans-serif", overflow:'hidden', transition:'background 0.5s',
      }}>
        {/* Dynamic Wrapper: Expands to full screen when playing */}
        <div style={{
          display:'flex', flexDirection:'column', width:'100%', height:'100%',
          maxWidth: isExpanded ? '100%' : '560px', 
          padding: isExpanded ? '4px 6px' : '8px 10px', 
          gap:'4px', alignItems:'stretch',
          transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1), padding 0.4s ease'
        }}>

          {/* ── TOP BAR ─────────────────────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'4px', flexShrink:0, marginBottom:'2px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
              <h1 style={{
                fontFamily:"'Orbitron',monospace", fontWeight:900,
                fontSize:'clamp(15px,3vw,20px)', color:T.uiAccent,
                letterSpacing:'0.18em', textShadow:isDark?`0 0 18px ${T.uiAccent}99`:'none', margin:0
              }}>SNAKE</h1>
              <span style={{
                fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700,
                color:T.uiAccent2, background:`${T.uiAccent2}18`,
                border:`1px solid ${T.uiAccent2}44`, borderRadius:'4px', padding:'1px 4px',
              }}>LV{level}</span>
              {gameMode === 'FREE_ROAM' && (
                <span style={{ fontSize:'9px', color:T.uiAccent2, fontWeight:700,
                  background:`${T.uiAccent2}14`, border:`1px solid ${T.uiAccent2}33`,
                  borderRadius:'4px', padding:'1px 4px' }}>🌀WRAP</span>
              )}
            </div>
            <div style={{ display:'flex', gap:'3px' }}>
              {[
                { icon:'🎨', tip:'Skins',        p:'skins'        as const },
                { icon:'🏆', tip:'Achievements', p:'achievements' as const },
                { icon:'📊', tip:'Scores',       p:'scores'       as const },
                { icon:'⚙️', tip:'Settings',     p:'settings'     as const },
              ].map(btn => (
                <button key={btn.p} style={iconBtn} title={btn.tip} onClick={()=>setPanel(btn.p)}>
                  {btn.icon}
                  {btn.p==='achievements' && <span style={{ fontSize:'8px', color:T.uiAccent }}>{unlockedCnt}</span>}
                </button>
              ))}
              <button style={{ ...iconBtn, color:isDark?'#ffd200':T.uiSub }}
                onClick={()=>setThemeKey(k=>k==='dark'?'light':'dark')}>
                {isDark?'☀️':'🌙'}
              </button>
            </div>
          </div>

          {/* ── SCORE ROW ───────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'3px', flexShrink:0 }}>
            {[
              { l:'Score',  v:score,        accent:false },
              { l:'Best',   v:highScore,    accent:true  },
              { l:'Speed',  v:`${speedLabel}x`,  accent:false },
              { l:'Length', v:snake.length, accent:false },
            ].map(it => (
              <div key={it.l} style={scoreBox}>
                <span style={{ display:'block', fontSize:'8px', fontWeight:700, letterSpacing:'0.12em', color:T.uiSub, textTransform:'uppercase' }}>{it.l}</span>
                <span style={{ display:'block', fontFamily:"'Orbitron',monospace", fontSize:'clamp(11px,2.5vw,14px)', fontWeight:700, color:it.accent?T.uiAccent:T.uiText, lineHeight:'1.15' }}>{it.v}</span>
              </div>
            ))}
          </div>

          {/* ── GAME AREA (3× larger on start + fully responsive) ────── */}
          <div ref={gameAreaRef} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0, position:'relative' }}>
            <div style={{
              position:'relative', width:CS*canvasScale, height:CS*canvasScale,
              borderRadius:'10px', overflow:'hidden',
              boxShadow:isDark
                ? `0 0 0 1.5px ${T.border},0 0 35px ${T.uiAccent2}1a,0 12px 40px rgba(0,0,0,0.75)`
                : `0 0 0 1.5px ${T.border},0 8px 30px rgba(0,114,255,0.11)`,
            }}
              onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            >
              <canvas ref={canvasRef} width={CS} height={CS}
                style={{ display:'block', width:CS*canvasScale, height:CS*canvasScale }} />

              {/* IDLE overlay with Dual Game Mode Selection */}
              {isIdle && (
                <div style={{
                  position:'absolute', inset:0, background:T.modalBg,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:'10px', borderRadius:'10px', backdropFilter:'blur(12px)', padding:'14px',
                  animation:'fadeUp 0.3s ease',
                }}>
                  <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'clamp(24px,6vw,38px)', fontWeight:900, color:T.uiAccent, letterSpacing:'0.15em', textShadow:isDark?`0 0 28px ${T.uiAccent}`:'' }}>
                    SNAKE
                  </div>

                  {/* ── MODE SELECTION (both shown initially; other disappears when one chosen) ── */}
                  <div style={{ width:'100%', maxWidth:320 }}>
                    <div style={{ textAlign:'center', fontFamily:"'Orbitron',monospace", fontSize:'11px', color:T.uiAccent, letterSpacing:'0.12em', marginBottom:'10px' }}>
                      CHOOSE GAME MODE
                    </div>
                    {selectedMode === null ? (
                      <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
                        {/* Classic Mode */}
                        <div
                          onClick={() => setGameMode('CLASSIC')}
                          style={{
                            cursor:'pointer',
                            width: '138px',
                            padding:'14px 10px',
                            borderRadius:'12px',
                            border: `2px solid ${T.border}`,
                            background: T.scoreBg,
                            textAlign:'center',
                            transition:'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                          }}
                        >
                          <div style={{ fontSize:'32px', marginBottom:'6px' }}>🧱</div>
                          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'13px', fontWeight:700, color:T.uiText }}>CLASSIC</div>
                          <div style={{ fontSize:'10px', color:T.uiSub, marginTop:'4px', lineHeight:1.3 }}>Die when you touch the border</div>
                        </div>
                        {/* Wrap Mode (second game mode) */}
                        <div
                          onClick={() => setGameMode('FREE_ROAM')}
                          style={{
                            cursor:'pointer',
                            width: '138px',
                            padding:'14px 10px',
                            borderRadius:'12px',
                            border: `2px solid ${T.border}`,
                            background: T.scoreBg,
                            textAlign:'center',
                            transition:'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                          }}
                        >
                          <div style={{ fontSize:'32px', marginBottom:'6px' }}>🌀</div>
                          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'13px', fontWeight:700, color:T.uiText }}>WRAP</div>
                          <div style={{ fontSize:'10px', color:T.uiSub, marginTop:'4px', lineHeight:1.3 }}>Snake grows • Only dies if it eats itself</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'12px' }}>
                        <div style={{
                          padding:'10px 18px',
                          borderRadius:'12px',
                          border: `2.5px solid ${T.uiAccent}`,
                          background: T.scoreBg,
                          display:'flex',
                          alignItems:'center',
                          gap:'12px',
                          boxShadow: `0 0 0 3px ${T.uiAccent}22`,
                        }}>
                          <span style={{ fontSize:'28px' }}>{selectedMode === 'CLASSIC' ? '🧱' : '🌀'}</span>
                          <div>
                            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'15px', fontWeight:700, color:T.uiText }}>{selectedMode} MODE</div>
                            <div style={{ fontSize:'10px', color:T.uiSub }}>
                              {selectedMode === 'CLASSIC' ? 'Border death' : 'Only self-collision • Infinite walls'}
                            </div>
                          </div>
                        </div>
                        <button style={{ ...btnSec, padding:'8px 14px' }} onClick={() => setSelectedMode(null)}>
                          CHANGE
                        </button>
                      </div>
                    )}
                  </div>

                  <p style={{ color:T.uiSub, fontSize:'9px', textAlign:'center', letterSpacing:'0.04em', maxWidth:'200px', lineHeight:'1.5', margin: '2px 0' }}>
                    Arrow / WASD to steer · SPACE to pause
                  </p>
                  
                  <button
                    style={{
                      ...btnPri,
                      fontSize:'13px',
                      padding:'12px 36px',
                      marginTop:'2px',
                      opacity: selectedMode === null ? 0.5 : 1,
                      cursor: selectedMode === null ? 'not-allowed' : 'pointer',
                      boxShadow: selectedMode === null ? 'none' : `0 6px 20px ${T.uiAccent}55`
                    }}
                    onClick={startGame}
                    disabled={selectedMode === null}
                  >
                    ▶ START GAME
                  </button>
                </div>
              )}

              {/* GAME OVER overlay */}
              {isOver && (
                <div style={{
                  position:'absolute', inset:0, background:T.modalBg,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:'8px', borderRadius:'10px', backdropFilter:'blur(14px)', padding:'16px',
                  animation:'fadeUp 0.35s ease',
                }}>
                  <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'clamp(16px,5vw,24px)', fontWeight:900, color:T.food1, letterSpacing:'0.1em', textShadow:isDark?`0 0 22px ${T.food1}`:'' }}>
                    GAME OVER
                  </div>
                  <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'clamp(26px,6vw,40px)', fontWeight:900, color:T.uiText, lineHeight:1 }}>
                    {score}<span style={{ fontSize:'12px', color:T.uiSub, marginLeft:'3px' }}>pts</span>
                  </div>
                  {score>=highScore&&score>0 && (
                    <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', color:T.uiAccent, letterSpacing:'0.08em', animation:'pulseGlow 1s infinite' }}>
                      🏆 NEW {difficulty} RECORD!
                    </div>
                  )}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', width:'100%', maxWidth:200 }}>
                    {[['TIME',`${totalTime}s`],['LENGTH',snake.length],['LEVEL',level],['EATEN',foodEaten]].map(([l,v]) => (
                      <div key={l} style={{ ...scoreBox, padding:'5px' }}>
                        <span style={{ display:'block', fontSize:'8px', fontWeight:700, color:T.uiSub, letterSpacing:'0.1em', textTransform:'uppercase' }}>{l}</span>
                        <span style={{ display:'block', fontFamily:"'Orbitron',monospace", fontSize:'13px', fontWeight:700, color:T.uiText }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'6px', marginTop:'2px' }}>
                    <button style={{ ...btnPri, padding:'9px 20px' }} onClick={startGame}>↺ PLAY AGAIN</button>
                    <button style={{ ...btnSec, padding:'8px 12px' }} onClick={()=>{setGameState('IDLE'); setEnlarged(false); setSelectedMode(null);}}>MENU</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── ACTIVE POWER-UPS ──────────────────────────────────────── */}
          <div style={{ display:'flex', gap:'4px', justifyContent:'center', flexShrink:0, minHeight:20, flexWrap:'wrap' }}>
            {activePower && (() => {
              const info:Record<PowerUpType,{icon:string;label:string;color:string}> = {
                SHIELD:     {icon:'🛡',label:'SHIELD',  color:'#ffd200'},
                SLOW:       {icon:'🐢',label:'SLOW-MO', color:'#00c6ff'},
                DOUBLE:     {icon:'×2',label:'DOUBLE',  color:'#00ff87'},
                GHOST_MODE: {icon:'👻',label:'GHOST',   color:'#cc88ff'},
              };
              const nfo=info[activePower.type], pct=activePower.ttl/200;
              return (
                <div style={{
                  background:`${nfo.color}18`, border:`1px solid ${nfo.color}55`,
                  borderRadius:'6px', padding:'2px 8px',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'1px',
                  fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700, color:nfo.color,
                }}>
                  <span>{nfo.icon} {nfo.label}</span>
                  <div style={{ width:60, height:2, background:`${nfo.color}28`, borderRadius:1 }}>
                    <div style={{ width:`${pct*100}%`, height:'100%', background:nfo.color, borderRadius:1, transition:'width 0.1s' }}/>
                  </div>
                </div>
              );
            })()}
            {comboStreak>1 && (
              <div style={{
                background:'rgba(255,106,0,0.15)', border:'1px solid rgba(255,106,0,0.5)',
                borderRadius:'6px', padding:'2px 8px',
                fontFamily:"'Orbitron',monospace", fontSize:'9px', fontWeight:700, color:'#ff6a00',
                animation:'pulseGlow 0.8s infinite',
              }}>🔥 ×{comboStreak} COMBO</div>
            )}
          </div>

          {/* ── CONTROLS ROW ──────────────────────────────────────────── */}
          <div style={{ display:'flex', justifyContent:'center', gap:'5px', flexShrink:0 }}>
            {(isRunning||isPaused||isCounting) ? (
              <>
                <button style={btnPri} onClick={togglePause}>{isPaused?'▶ RESUME':'⏸ PAUSE'}</button>
                <button style={btnSec} onClick={startGame}>↺ RESTART</button>
                <button style={{...btnSec, border: 'none', background: 'transparent'}} onClick={() => {setGameState('IDLE'); setEnlarged(false); setSelectedMode(null);}}>✕ EXIT</button>
              </>
            ) : <></>}
          </div>

          {/* ── D-PAD ─────────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,36px)', gridTemplateRows:'repeat(3,36px)', gap:'3px', margin:'0 auto', flexShrink:0 }}>
            <div/><DBtn d="UP"    lbl="▲"/><div/>
            <DBtn d="LEFT" lbl="◀"/>
            <div style={{ width:36,height:36,borderRadius:'8px',background:T.scoreBg,border:`1px solid ${T.border}`,opacity:0.3,display:'flex',alignItems:'center',justifyContent:'center',color:T.uiSub,fontSize:'14px' }}>●</div>
            <DBtn d="RIGHT" lbl="▶"/>
            <div/><DBtn d="DOWN"  lbl="▼"/><div/>
          </div>

          <p style={{ textAlign:'center', color:T.uiSub, fontSize:'8px', letterSpacing:'0.07em', flexShrink:0, margin: '2px 0 0 0' }}>
            ↑↓←→ · WASD · SPACE=pause · ENTER=start
          </p>
        </div>

        {/* ── PANELS ──────────────────────────────────────────────────── */}
        {panel==='settings' && (
          <PanelShell>
            {panelTitle('SETTINGS')}
            <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:'9px' }}>
              {[
                { label:'SHOW GRID',           val:showGrid, fn:setShowGrid },
                { label:'HAPTIC FEEDBACK',     val:haptics,  fn:setHaptics  },
              ].map(o => (
                <div key={o.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:T.scoreBg, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'12px 16px' }}>
                  <span style={{ color:T.uiText, fontWeight:600, fontSize:'13px', letterSpacing:'0.05em' }}>{o.label}</span>
                  <button style={{
                    background:o.val?T.btnPri:'transparent', border:`1.5px solid ${o.val?'transparent':T.btnSecBdr}`,
                    borderRadius:'20px', width:42, height:22, cursor:'pointer', position:'relative', transition:'all 0.2s',
                  }} onClick={()=>o.fn((v:boolean)=>!v)}>
                    <div style={{ position:'absolute', top:1, left:o.val?21:1, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
                  </button>
                </div>
              ))}
              <div style={{ background:T.scoreBg, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'12px 16px' }}>
                <span style={{ color:T.uiText, fontWeight:600, fontSize:'13px', display:'block', marginBottom:'8px', letterSpacing:'0.05em' }}>DIFFICULTY</span>
                <div style={{ display:'flex', gap:'5px' }}>
                  {DIFFS.map(d=>(
                    <button key={d} style={{ ...btnSec, flex:1, background:difficulty===d?T.btnPri:'transparent', color:difficulty===d?T.btnPriTxt:T.btnSecTxt, border:`1.5px solid ${difficulty===d?'transparent':T.btnSecBdr}` }}
                      onClick={()=>setDifficulty(d)}>{d}</button>
                  ))}
                </div>
              </div>
              <div style={{ background:T.scoreBg, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'12px 16px' }}>
                <span style={{ color:T.uiText, fontWeight:600, fontSize:'13px', display:'block', marginBottom:'8px', letterSpacing:'0.05em' }}>THEME</span>
                <div style={{ display:'flex', gap:'5px' }}>
                  {(['light','dark'] as ThemeKey[]).map(k=>(
                    <button key={k} style={{ ...btnSec, flex:1, background:themeKey===k?T.btnPri:'transparent', color:themeKey===k?T.btnPriTxt:T.btnSecTxt, border:`1.5px solid ${themeKey===k?'transparent':T.btnSecBdr}` }}
                      onClick={()=>setThemeKey(k)}>{k==='dark'?'🌙 DARK':'☀️ LIGHT'}</button>
                  ))}
                </div>
              </div>
            </div>
            <button style={{ ...btnPri, marginTop:'4px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {panel==='skins' && (
          <PanelShell>
            {panelTitle('SKINS')}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'7px', width:'100%', maxWidth:380 }}>
              {(Object.entries(SKIN_DEFS) as [SkinId,typeof SKIN_DEFS[SkinId]][]).map(([id,def]) => (
                <button key={id} style={{
                  background:skin===id?`${T.uiAccent}20`:T.scoreBg,
                  border:`1.5px solid ${skin===id?T.uiAccent:T.border}`,
                  borderRadius:'12px', padding:'12px 8px', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', transition:'all 0.15s',
                }} onClick={()=>setSkin(id)}>
                  <span style={{ fontSize:'24px' }}>{def.icon}</span>
                  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', fontWeight:700, color:skin===id?T.uiAccent:T.uiText, letterSpacing:'0.05em' }}>{def.name}</span>
                  <div style={{ display:'flex', gap:'3px' }}>
                    {[def.head[0],def.body[0],def.body[1]].map((c,i) => (
                      <div key={i} style={{ width:9,height:9,borderRadius:'50%',background:c }}/>
                    ))}
                  </div>
                  {skin===id && <span style={{ fontSize:'12px' }}>✓</span>}
                </button>
              ))}
            </div>
            <button style={{ ...btnPri, marginTop:'4px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {panel==='achievements' && (
          <PanelShell>
            {panelTitle('ACHIEVEMENTS')}
            <p style={{ color:T.uiSub, fontSize:'12px', margin:0 }}>{unlockedCnt} / {achievements.length} unlocked</p>
            <div style={{ width:'100%', maxWidth:420, display:'flex', flexDirection:'column', gap:'6px' }}>
              {achievements.map(a => (
                <div key={a.id} style={{
                  background:a.unlocked?T.scoreBg:(isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.025)'),
                  border:`1px solid ${a.unlocked?T.uiAccent+'44':T.border}`,
                  borderRadius:'11px', padding:'10px 13px',
                  display:'flex', alignItems:'center', gap:'10px', opacity:a.unlocked?1:0.42,
                }}>
                  <span style={{ fontSize:'20px', minWidth:26 }}>{a.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'12px', color:T.uiText, fontFamily:"'Orbitron',monospace", letterSpacing:'0.04em' }}>{a.label}</div>
                    <div style={{ fontSize:'11px', color:T.uiSub }}>{a.desc}</div>
                  </div>
                  {a.unlocked && <span style={{ color:T.uiAccent, fontSize:'14px' }}>✓</span>}
                </div>
              ))}
            </div>
            <button style={{ ...btnPri, marginTop:'4px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {panel==='scores' && (
          <PanelShell>
            {panelTitle('HIGH SCORES')}
            <div style={{ width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:'7px' }}>
              {DIFFS.map((d,i) => (
                <div key={d} style={{ ...scoreBox, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'22px' }}>{i===0?'🧊':i===1?'🎯':'🚀'}</span>
                    <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'13px', fontWeight:700, color:T.uiText }}>{d}</span>
                  </div>
                  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'22px', fontWeight:900, color:T.uiAccent }}>{highScores[d]??0}</span>
                </div>
              ))}
              <div style={{ ...scoreBox, padding:'14px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', color:T.uiSub, marginBottom:'4px', letterSpacing:'0.1em' }}>TOTAL FOOD EATEN</div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'24px', fontWeight:900, color:T.uiAccent }}>{foodEaten}</div>
              </div>
              <div style={{ ...scoreBox, padding:'14px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', color:T.uiSub, marginBottom:'4px', letterSpacing:'0.1em' }}>ACHIEVEMENTS</div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'22px', fontWeight:900, color:T.uiAccent2 }}>{unlockedCnt}/{achievements.length}</div>
              </div>
              <div style={{ ...scoreBox, padding:'14px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', color:T.uiSub, marginBottom:'4px', letterSpacing:'0.1em' }}>WRAP MODE HIGH LEVEL</div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'24px', fontWeight:900, color:T.uiAccent }}>{wrapHighLevel}</div>
              </div>
            </div>
            <button style={{ ...btnPri, marginTop:'4px' }} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ── ACHIEVEMENT TOAST ────────────────────────────────────────── */}
        {newAch && (
          <div style={{
            position:'fixed', bottom:20, right:14, zIndex:200,
            background:isDark?'rgba(10,8,28,0.97)':'rgba(255,255,255,0.97)',
            border:`1.5px solid ${T.uiAccent}`,
            borderRadius:'14px', padding:'11px 15px',
            display:'flex', alignItems:'center', gap:'10px',
            boxShadow:`0 8px 28px rgba(0,0,0,0.28)`,
            animation:'achSlide 0.4s ease',
            backdropFilter:'blur(12px)', maxWidth:'255px',
          }}>
            <span style={{ fontSize:'26px' }}>{newAch.icon}</span>
            <div>
              <div style={{ fontSize:'8px', letterSpacing:'0.12em', color:T.uiAccent, fontWeight:700, fontFamily:"'Orbitron',monospace" }}>ACHIEVEMENT UNLOCKED</div>
              <div style={{ fontSize:'12px', fontWeight:700, color:T.uiText, fontFamily:"'Orbitron',monospace" }}>{newAch.label}</div>
              <div style={{ fontSize:'10px', color:T.uiSub }}>{newAch.desc}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SnakeGame;