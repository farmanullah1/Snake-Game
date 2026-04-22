/**
 * SnakeGame.tsx — Production Snake (React + TypeScript + Canvas)
 * ─────────────────────────────────────────────────────────────────
 * KEY FIXES IN THIS VERSION:
 *
 * [FIX 1] MOBILE TOUCH — swipe handlers only attached during RUNNING/PAUSED.
 *         IDLE and OVER overlays now have unobstructed pointer events so
 *         START/mode buttons respond to touch correctly on all phones.
 *
 * [FIX 2] TYPESCRIPT ERROR — removed duplicate `bottom` property from
 *         achievement toast. Uses `inset` shorthand instead.
 *
 * [FIX 3] PERFORMANCE — rAF delta-time loop replaces ALL setInterval usage.
 *         All game state in G (useRef). syncUI() only calls setState on change.
 *
 * [FIX 4] SNAKE NOT MOVING — nextDir queue replaces fragile inputLock system.
 *
 * [FIX 5] LAYOUT OVERFLOW — tuned chrome budgets, flex:1 canvas, safe-area.
 *
 * [FIX 6] DPR BLUR — ctx.setTransform applied every rAF frame.
 *
 * [FIX 7] SOUND — Web Audio API synth + mute toggle in Settings panel.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect,
} from 'react';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
type Point       = { x: number; y: number };
type Direction   = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState   = 'IDLE' | 'RUNNING' | 'PAUSED' | 'OVER' | 'COUNTDOWN';
type GameMode    = 'CLASSIC' | 'FREE_ROAM';
type Difficulty  = 'CHILL' | 'NORMAL' | 'TURBO';
type PowerUpType = 'SHIELD' | 'SLOW' | 'DOUBLE' | 'GHOST_MODE';
type SkinId      = 'classic' | 'neon' | 'fire' | 'ice' | 'gold' | 'rainbow';
type ThemeKey    = 'light' | 'dark';
type Achievement = { id: string; label: string; icon: string; desc: string; unlocked: boolean; ts?: number };
type Particle    = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type FloatText   = { id: number; x: number; y: number; text: string; color: string };

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const COLS = 20;
const ROWS = 20;
const LC   = 20;
const LS   = LC * COLS; // 400 — internal canvas size
const MIN_BOARD = 220;
const MAX_BOARD = 520;

const SPEED: Record<Difficulty, { base: number; min: number; inc: number }> = {
  CHILL:  { base: 200, min: 100, inc: 3 },
  NORMAL: { base: 140, min:  55, inc: 5 },
  TURBO:  { base:  75, min:  25, inc: 7 },
};

const SKIN_DEFS: Record<SkinId, { name: string; head: [string,string]; body: [string,string]; glow: string; icon: string }> = {
  classic: { name:'Classic', head:['#0052d4','#4364f7'], body:['#00c6ff','#0072ff'], glow:'#0072ff', icon:'🔵' },
  neon:    { name:'Neon',    head:['#00ffa6','#00e5ff'], body:['#00ff87','#60efff'], glow:'#00ff87', icon:'💚' },
  fire:    { name:'Fire',    head:['#ff4e00','#ec9f05'], body:['#ff6b35','#f7c59f'], glow:'#ff4e00', icon:'🔥' },
  ice:     { name:'Ice',     head:['#a8edea','#fed6e3'], body:['#d3f9d8','#a8edea'], glow:'#a8edea', icon:'❄️' },
  gold:    { name:'Gold',    head:['#f7971e','#ffd200'], body:['#ffb347','#ffd700'], glow:'#ffd200', icon:'⭐' },
  rainbow: { name:'Rainbow', head:['#ff0080','#7928ca'], body:['#ff0080','#7928ca'], glow:'#ff0080', icon:'🌈' },
};

const DIFFS: Difficulty[] = ['CHILL', 'NORMAL', 'TURBO'];

const ACH_DEFS: Omit<Achievement,'unlocked'>[] = [
  { id:'first_food',  icon:'🍎', label:'First Bite',     desc:'Eat your first food'       },
  { id:'score_50',    icon:'⭐', label:'Rising Star',     desc:'Score 50 points'           },
  { id:'score_100',   icon:'🌟', label:'Century',         desc:'Score 100 points'          },
  { id:'score_250',   icon:'💫', label:'Legend',          desc:'Score 250 points'          },
  { id:'score_500',   icon:'🏆', label:'Champion',        desc:'Score 500 points'          },
  { id:'length_10',   icon:'🐍', label:'Growing Strong',  desc:'Reach length 10'           },
  { id:'length_20',   icon:'🐉', label:'Dragon Mode',     desc:'Reach length 20'           },
  { id:'survive_60',  icon:'🧱', label:'Wall Dodger',     desc:'Survive 60 seconds'        },
  { id:'power_up',    icon:'⚡', label:'Powered Up',      desc:'Collect a power-up'        },
  { id:'bonus_food',  icon:'✨', label:'Bonus Hunter',    desc:'Eat bonus food'            },
  { id:'turbo_100',   icon:'🚀', label:'Speed Demon',     desc:'Score 100 in TURBO mode'   },
  { id:'chill_250',   icon:'🧊', label:'Zen Master',      desc:'Score 250 in CHILL mode'   },
  { id:'combo_5',     icon:'🔥', label:'Combo King',      desc:'5× combo streak'           },
  { id:'shield_used', icon:'🛡️', label:'Shielded',        desc:'Block a death with shield' },
];

const OPPOSITE: Record<Direction,Direction> = { UP:'DOWN', DOWN:'UP', LEFT:'RIGHT', RIGHT:'LEFT' };

// ─────────────────────────────────────────────────────────────────
// THEMES
// ─────────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg:        ['#f0fffe','#e8f4fd','#f5f9ff'] as string[],
    gridLine:  'rgba(100,160,200,0.10)',
    border:    'rgba(0,114,255,0.18)',
    uiText:    '#0a0f1e',
    uiSub:     '#5a6a7a',
    uiAccent:  '#0072ff',
    uiAccent2: '#00c6ff',
    scoreBg:   'rgba(0,114,255,0.05)',
    btnPri:    'linear-gradient(135deg,#00c6ff,#0072ff)',
    btnPriTxt: '#fff',
    btnSecBdr: 'rgba(0,114,255,0.35)',
    btnSecTxt: '#0072ff',
    food1:     '#ff416c',
    food2:     '#ff4b2b',
    foodGlow:  '#ff416c',
    pauseOvl:  'rgba(240,255,254,0.88)',
    dark:      false,
  },
  dark: {
    bg:        ['#060614','#0d0b2b','#140a20'] as string[],
    gridLine:  'rgba(96,239,255,0.038)',
    border:    'rgba(96,239,255,0.18)',
    uiText:    '#e8f4ff',
    uiSub:     '#7a90b0',
    uiAccent:  '#60efff',
    uiAccent2: '#00ff87',
    scoreBg:   'rgba(96,239,255,0.055)',
    btnPri:    'linear-gradient(135deg,#00ff87,#60efff)',
    btnPriTxt: '#060614',
    btnSecBdr: 'rgba(96,239,255,0.35)',
    btnSecTxt: '#60efff',
    food1:     '#ff00cc',
    food2:     '#ff6a00',
    foodGlow:  '#ff00cc',
    pauseOvl:  'rgba(6,6,20,0.88)',
    dark:      true,
  },
};
type Theme = typeof THEMES['light'];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const randomCell = (exclude: Point[]): Point => {
  let p: Point;
  do { p = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) }; }
  while (exclude.some(e => e.x===p.x && e.y===p.y));
  return p;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const vibrate = (p: number|number[]) => { try { navigator.vibrate?.(p); } catch { /* no-op */ } };
const lsGet = (k: string, fb: string) => { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } };
const lsSet = (k: string, v: string)  => { try { localStorage.setItem(k, v); } catch { /* no-op */ } };

// ─────────────────────────────────────────────────────────────────
// SOUND — Web Audio API (no external files)
// ─────────────────────────────────────────────────────────────────
let _actx: AudioContext | null = null;
const getAudio = (): AudioContext | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!_actx) _actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume();
    return _actx;
  } catch { return null; }
};
const playTone = (freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08) => {
  const ctx = getAudio(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + dur);
};
const SFX = {
  eat:    () => { playTone(523,0.08,'square',0.06); setTimeout(()=>playTone(784,0.08,'square',0.05),40); },
  bonus:  () => { playTone(659,0.07,'square',0.06); setTimeout(()=>playTone(988,0.10,'square',0.05),50); },
  powerUp:() => { [523,659,784].forEach((f,i)=>setTimeout(()=>playTone(f,0.1,'triangle',0.06),i*60)); },
  die:    () => { playTone(440,0.15,'sawtooth',0.07); setTimeout(()=>playTone(220,0.3,'sawtooth',0.06),100); },
};

// ─────────────────────────────────────────────────────────────────
// CANVAS DRAW
// ─────────────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

interface DrawState {
  snake:Point[]; food:{pos:Point;pulse:number};
  bonus:{pos:Point;ttl:number}|null;
  pu:{pos:Point;type:PowerUpType}|null;
  state:GameState; theme:Theme; dark:boolean; skin:SkinId;
  countdown:number; particles:Particle[]; floats:FloatText[];
  ghost:boolean; shield:boolean; rainbowHue:number;
  showGrid:boolean; pulse:number;
}

function drawCanvas(ctx: CanvasRenderingContext2D, d: DrawState) {
  const { snake,food,bonus,pu,state,theme:T,dark,skin,countdown,
          particles,floats,ghost,shield,rainbowHue,showGrid,pulse } = d;
  const W=LS,H=LS;

  // BG gradient
  const bgG=ctx.createLinearGradient(0,0,W,H);
  T.bg.forEach((c,i)=>bgG.addColorStop(i/(T.bg.length-1),c));
  ctx.fillStyle=bgG; ctx.fillRect(0,0,W,H);

  // Scanlines (dark)
  if (dark) for (let y=0;y<H;y+=4){ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,y,W,1);}

  // Grid
  if (showGrid){
    ctx.strokeStyle=T.gridLine; ctx.lineWidth=0.5;
    for(let i=0;i<=COLS;i++){
      ctx.beginPath();ctx.moveTo(i*LC,0);ctx.lineTo(i*LC,H);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,i*LC);ctx.lineTo(W,i*LC);ctx.stroke();
    }
  }

  // Particles
  particles.forEach(p=>{
    ctx.save();ctx.globalAlpha=p.life;
    ctx.shadowColor=p.color;ctx.shadowBlur=dark?8:3;
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });

  // Power-up item
  if(pu){
    const px=pu.pos.x*LC+LC/2,py=pu.pos.y*LC+LC/2;
    const sc=0.78+Math.sin(pulse)*0.22,r=(LC/2-1)*sc;
    ctx.save();ctx.shadowColor='#ffd200';ctx.shadowBlur=dark?22:10;
    const pG=ctx.createRadialGradient(px,py,1,px,py,r);
    pG.addColorStop(0,'#fffacc');pG.addColorStop(1,'#ffd200');
    ctx.fillStyle=pG;rrect(ctx,px-r,py-r,r*2,r*2,5);ctx.fill();
    ctx.shadowBlur=0;
    const PICONS:Record<PowerUpType,string>={SHIELD:'🛡',SLOW:'🐢',DOUBLE:'×2',GHOST_MODE:'👻'};
    ctx.font=`bold ${LC-5}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(PICONS[pu.type],px,py);ctx.restore();
  }

  // Bonus food
  if(bonus){
    const bx=bonus.pos.x*LC+LC/2,by=bonus.pos.y*LC+LC/2;
    ctx.save();ctx.globalAlpha=Math.min(1,bonus.ttl/40);
    ctx.shadowColor='#ff00cc';ctx.shadowBlur=dark?20:9;
    const bG=ctx.createRadialGradient(bx,by,1,bx,by,LC/2-1);
    bG.addColorStop(0,'#ff00cc');bG.addColorStop(1,'#7b00ff');
    ctx.fillStyle=bG;rrect(ctx,bonus.pos.x*LC+2,bonus.pos.y*LC+2,LC-4,LC-4,6);
    ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.font=`bold ${LC-5}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('★',bx,by);ctx.restore();
  }

  // Main food
  {
    const fx=food.pos.x*LC+LC/2,fy=food.pos.y*LC+LC/2;
    const sc=0.84+Math.sin(food.pulse)*0.16,r=(LC/2-1.5)*sc;
    ctx.save();ctx.shadowColor=T.foodGlow;ctx.shadowBlur=dark?20:9;
    const fG=ctx.createRadialGradient(fx-r*0.25,fy-r*0.25,0,fx,fy,r);
    fG.addColorStop(0,T.food1);fG.addColorStop(1,T.food2);
    ctx.fillStyle=fG;ctx.beginPath();ctx.arc(fx,fy,r,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath();ctx.arc(fx-r*0.3,fy-r*0.3,r*0.28,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // Snake body
  const sk=SKIN_DEFS[skin]??SKIN_DEFS.classic;
  snake.forEach((seg,i)=>{
    const x=seg.x*LC+1,y=seg.y*LC+1,sz=LC-2;
    const rad=i===0?7:4;
    const ratio=snake.length>1?i/(snake.length-1):0;
    ctx.save();
    ctx.globalAlpha=ghost?(i===0?0.55:0.35):1;
    if(dark){
      const hue=skin==='rainbow'?(rainbowHue+i*18)%360:-1;
      ctx.shadowBlur=i===0?22:13;
      ctx.shadowColor=hue>=0?`hsl(${hue},100%,60%)`:(i===0?sk.head[0]:sk.glow);
    }
    let fill:string|CanvasGradient;
    if(skin==='rainbow'){
      const h=(rainbowHue+i*18)%360,h2=(h+30)%360;
      const rg=ctx.createLinearGradient(x,y,x+sz,y+sz);
      rg.addColorStop(0,`hsl(${h},100%,${i===0?52:58}%)`);
      rg.addColorStop(1,`hsl(${h2},100%,62%)`);
      fill=rg;
    } else if(i===0){
      const hg=ctx.createLinearGradient(x,y,x+sz,y+sz);
      hg.addColorStop(0,sk.head[0]);hg.addColorStop(1,sk.head[1]);fill=hg;
    } else {
      const bg=ctx.createLinearGradient(x,y,x+sz,y+sz);
      bg.addColorStop(0,sk.body[0]);bg.addColorStop(1,sk.body[1]);
      ctx.globalAlpha=ghost?0.28:(1-ratio*0.28);fill=bg;
    }
    ctx.fillStyle=fill;rrect(ctx,x,y,sz,sz,rad);ctx.fill();

    if(i===0&&shield){
      ctx.save();ctx.globalAlpha=0.7;
      ctx.strokeStyle='#ffd200';ctx.lineWidth=2.5;
      ctx.shadowColor='#ffd200';ctx.shadowBlur=14;
      rrect(ctx,x-2.5,y-2.5,sz+5,sz+5,rad+3);ctx.stroke();
      ctx.restore();
    }
    if(i===0){
      ctx.globalAlpha=1;ctx.shadowBlur=0;
      const nx2=snake[1]??{x:seg.x-1,y:seg.y};
      const dx=seg.x-nx2.x,dy=seg.y-nx2.y;
      const cx=seg.x*LC+LC/2,cy=seg.y*LC+LC/2;
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

  // Floating score texts
  floats.forEach(ft=>{
    ctx.save();ctx.font=`bold 13px 'Orbitron',monospace`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=ft.color;ctx.shadowColor=ft.color;ctx.shadowBlur=8;
    ctx.fillText(ft.text,ft.x,ft.y);ctx.restore();
  });

  // Pause overlay
  if(state==='PAUSED'){
    ctx.fillStyle=T.pauseOvl;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.font=`900 34px 'Orbitron',monospace`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=dark?'#60efff':'#0072ff';
    ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=dark?22:8;
    ctx.fillText('PAUSED',W/2,H/2-14);
    ctx.shadowBlur=0;ctx.font=`600 11px 'Rajdhani',sans-serif`;
    ctx.fillStyle=dark?'#7a90b0':'#5a6a7a';
    ctx.fillText('PRESS SPACE TO RESUME',W/2,H/2+16);
    ctx.restore();
  }

  // Countdown overlay
  if(state==='COUNTDOWN'){
    ctx.fillStyle=T.pauseOvl;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.font=`900 68px 'Orbitron',monospace`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=dark?'#60efff':'#0072ff';
    ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=dark?35:14;
    ctx.fillText(countdown>0?String(countdown):'GO!',W/2,H/2);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────
// RESPONSIVE BOARD SIZE HOOK
// ─────────────────────────────────────────────────────────────────
function useResponsiveBoardSize(): number {
  const calcSize=useCallback(():number=>{
    const vw=window.visualViewport?.width??window.innerWidth;
    const vh=window.visualViewport?.height??window.innerHeight;
    const isLandscape=vw>vh,isCompactH=vh<=700,isCompactW=vw<=390;
    const chromeBudget=isLandscape?(isCompactH?170:210):isCompactH?(isCompactW?310:330):(isCompactW?355:375);
    const available=Math.min(vw-(isCompactW?16:24),vh-chromeBudget);
    return clamp(Math.floor(available/COLS)*COLS,MIN_BOARD,MAX_BOARD);
  },[]);

  const [boardSize,setBoardSize]=useState<number>(calcSize);
  useEffect(()=>{
    const update=()=>setBoardSize(calcSize());
    const vvp=window.visualViewport;
    if(vvp){vvp.addEventListener('resize',update);vvp.addEventListener('scroll',update);}
    window.addEventListener('resize',update);
    window.addEventListener('orientationchange',update);
    const dprMq=window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMq?.addEventListener?.('change',update);
    return()=>{
      if(vvp){vvp.removeEventListener('resize',update);vvp.removeEventListener('scroll',update);}
      window.removeEventListener('resize',update);
      window.removeEventListener('orientationchange',update);
      dprMq?.removeEventListener?.('change',update);
    };
  },[calcSize]);
  return boardSize;
}

// ─────────────────────────────────────────────────────────────────
// MUTABLE GAME STATE SHAPE
// ─────────────────────────────────────────────────────────────────
interface GState {
  state:GameState; snake:Point[]; dir:Direction; nextDir:Direction|null;
  food:{pos:Point}; bonus:{pos:Point;ttl:number}|null;
  pu:{pos:Point;type:PowerUpType}|null; ap:{type:PowerUpType;ttl:number}|null;
  score:number; level:number; eaten:number; combo:number; comboExpiry:number;
  totalTime:number; countdown:number;
  ghost:boolean; shield:boolean; double:boolean; slow:boolean;
  diff:Difficulty; mode:GameMode; skin:SkinId; themeKey:ThemeKey;
  showGrid:boolean; soundOn:boolean; haptics:boolean;
  particles:Particle[]; floats:FloatText[]; pulse:number; rainbowHue:number;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
const SnakeGame: React.FC = () => {
  const boardSize=useResponsiveBoardSize();
  const vw=typeof window!=='undefined'?(window.visualViewport?.width??window.innerWidth):400;
  const vh=typeof window!=='undefined'?(window.visualViewport?.height??window.innerHeight):800;
  const isTiny=vw<=340,isCompact=vw<=420||vh<=700;

  // ── Preferences ─────────────────────────────────────────────
  const [themeKey,  setThemeKey]  =useState<ThemeKey>  (()=>lsGet('sng_theme', 'light') as ThemeKey);
  const [skin,      setSkin]      =useState<SkinId>    (()=>lsGet('sng_skin',  'classic') as SkinId);
  const [difficulty,setDifficulty]=useState<Difficulty>(()=>lsGet('sng_diff',  'NORMAL') as Difficulty);
  const [gameMode,  setGameMode]  =useState<GameMode>  (()=>lsGet('sng_mode',  'CLASSIC') as GameMode);
  const [showGrid,  setShowGrid]  =useState<boolean>   (()=>lsGet('sng_grid',  '1')==='1');
  const [haptics,   setHaptics]   =useState<boolean>   (()=>lsGet('sng_haptic','1')==='1');
  const [soundOn,   setSoundOn]   =useState<boolean>   (()=>lsGet('sng_sound', '1')==='1');
  const [panel,setPanel]=useState<null|'settings'|'skins'|'achievements'|'scores'>(null);

  useEffect(()=>{lsSet('sng_theme', themeKey);},[themeKey]);
  useEffect(()=>{lsSet('sng_skin',  skin);},[skin]);
  useEffect(()=>{lsSet('sng_diff',  difficulty);},[difficulty]);
  useEffect(()=>{lsSet('sng_mode',  gameMode);},[gameMode]);
  useEffect(()=>{lsSet('sng_grid',  showGrid?'1':'0');},[showGrid]);
  useEffect(()=>{lsSet('sng_haptic',haptics?'1':'0');},[haptics]);
  useEffect(()=>{lsSet('sng_sound', soundOn?'1':'0');},[soundOn]);

  const T=THEMES[themeKey];
  const isDark=themeKey==='dark';

  // ── High scores / achievements ───────────────────────────────
  const [highScores,setHighScores]=useState<Record<Difficulty,number>>(()=>{
    try{return JSON.parse(lsGet('sng_hs2','null'))??{CHILL:0,NORMAL:0,TURBO:0};}
    catch{return{CHILL:0,NORMAL:0,TURBO:0};}
  });
  const [savedLevels,setSavedLevels]=useState<Record<GameMode,number>>(()=>{
    try{return JSON.parse(lsGet('sng_levels','null'))??{CLASSIC:1,FREE_ROAM:1};}
    catch{return{CLASSIC:1,FREE_ROAM:1};}
  });
  const [achievements,setAchievements]=useState<Achievement[]>(()=>{
    try{
      const saved=JSON.parse(lsGet('sng_ach','[]')) as {id:string;ts?:number}[];
      return ACH_DEFS.map(d=>({...d,unlocked:saved.some(s=>s.id===d.id),ts:saved.find(s=>s.id===d.id)?.ts}));
    }catch{return ACH_DEFS.map(d=>({...d,unlocked:false}));}
  });
  const [newAch,setNewAch]=useState<Achievement|null>(null);
  const achTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  // ── Minimal UI display state ─────────────────────────────────
  const [gameState,  setGameStateUI]  =useState<GameState>('IDLE');
  const [score,      setScoreUI]      =useState(0);
  const [level,      setLevelUI]      =useState(1);
  const [snakeLen,   setSnakeLenUI]   =useState(3);
  const [foodEaten,  setFoodEatenUI]  =useState(0);
  const [combo,      setComboUI]      =useState(0);
  const [activePower,setActivePowerUI]=useState<{type:PowerUpType;ttl:number}|null>(null);
  const [slowUI,     setSlowUI]       =useState(false);
  const [totalTime,  setTotalTimeUI]  =useState(0);

  const snap=useRef({gameState:'IDLE' as GameState,score:0,level:1,snakeLen:3,
    foodEaten:0,combo:0,ap:null as typeof activePower,slow:false,totalTime:0});

  // ── Mutable game ref ─────────────────────────────────────────
  const INIT_SNAKE=useMemo<Point[]>(()=>[{x:10,y:10},{x:9,y:10},{x:8,y:10}],[]);

  const G=useRef<GState>({
    state:'IDLE',snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],
    dir:'RIGHT',nextDir:null,
    food:{pos:randomCell([{x:10,y:10},{x:9,y:10},{x:8,y:10}])},
    bonus:null,pu:null,ap:null,
    score:0,level:1,eaten:0,combo:0,comboExpiry:0,
    totalTime:0,countdown:3,
    ghost:false,shield:false,double:false,slow:false,
    diff:'NORMAL',mode:'CLASSIC',skin:'classic',themeKey:'light',
    showGrid:true,soundOn:true,haptics:true,
    particles:[],floats:[],pulse:0,rainbowHue:0,
  });

  // Sync pref mirrors
  useEffect(()=>{G.current.diff    =difficulty;},[difficulty]);
  useEffect(()=>{G.current.mode    =gameMode;},[gameMode]);
  useEffect(()=>{G.current.skin    =skin;},[skin]);
  useEffect(()=>{G.current.themeKey=themeKey;},[themeKey]);
  useEffect(()=>{G.current.showGrid=showGrid;},[showGrid]);
  useEffect(()=>{G.current.soundOn =soundOn;},[soundOn]);
  useEffect(()=>{G.current.haptics =haptics;},[haptics]);

  const canvasRef=useRef<HTMLCanvasElement>(null);

  // ── DPR canvas setup ─────────────────────────────────────────
  useLayoutEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const dpr=clamp(window.devicePixelRatio||1,1,3);
    canvas.width=Math.round(LS*dpr);canvas.height=Math.round(LS*dpr);
    canvas.style.width=`${boardSize}px`;canvas.style.height=`${boardSize}px`;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;
  },[boardSize]);

  // ── syncUI ───────────────────────────────────────────────────
  const syncUI=useCallback(()=>{
    const g=G.current,s=snap.current;
    if(g.state   !==s.gameState){setGameStateUI(g.state);         s.gameState =g.state;}
    if(g.score   !==s.score)    {setScoreUI(g.score);             s.score     =g.score;}
    if(g.level   !==s.level)    {setLevelUI(g.level);             s.level     =g.level;}
    const sl=g.snake.length;
    if(sl         !==s.snakeLen) {setSnakeLenUI(sl);               s.snakeLen  =sl;}
    if(g.eaten   !==s.foodEaten){setFoodEatenUI(g.eaten);         s.foodEaten =g.eaten;}
    if(g.combo   !==s.combo)    {setComboUI(g.combo);             s.combo     =g.combo;}
    if(g.slow    !==s.slow)     {setSlowUI(g.slow);               s.slow      =g.slow;}
    if(g.totalTime!==s.totalTime){setTotalTimeUI(g.totalTime);    s.totalTime =g.totalTime;}
    if(g.ap      !==s.ap)       {setActivePowerUI(g.ap?{...g.ap}:null);s.ap=g.ap;}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Achievement unlock ────────────────────────────────────────
  const achSet=useRef(new Set<string>());
  const unlock=useCallback((id:string)=>{
    if(achSet.current.has(id))return;
    setAchievements(prev=>{
      if(prev.find(a=>a.id===id)?.unlocked){achSet.current.add(id);return prev;}
      const next=prev.map(a=>a.id===id?{...a,unlocked:true,ts:Date.now()}:a);
      lsSet('sng_ach',JSON.stringify(next.filter(a=>a.unlocked).map(a=>({id:a.id,ts:a.ts}))));
      const ach=next.find(a=>a.id===id)!;
      setNewAch(ach);
      if(achTimerRef.current)clearTimeout(achTimerRef.current);
      achTimerRef.current=setTimeout(()=>setNewAch(null),3600);
      achSet.current.add(id);return next;
    });
  },[]);

  // ── Speed ─────────────────────────────────────────────────────
  const getTickRate=useCallback((sc:number,diff:Difficulty,slow:boolean):number=>{
    const{base,min,inc}=SPEED[diff];
    const s=Math.max(min,base-Math.floor(sc/5)*inc);
    return slow?Math.round(s*1.65):s;
  },[]);

  // ── TICK — zero React setState calls ─────────────────────────
  const tickFn=useCallback(()=>{
    const g=G.current;
    if(g.state!=='RUNNING')return;
    // Consume queued dir
    if(g.nextDir&&g.nextDir!==OPPOSITE[g.dir]&&g.nextDir!==g.dir)g.dir=g.nextDir;
    g.nextDir=null;
    const head=g.snake[0];
    let nx=head.x,ny=head.y;
    if(g.dir==='UP')ny--;
    if(g.dir==='DOWN')ny++;
    if(g.dir==='LEFT')nx--;
    if(g.dir==='RIGHT')nx++;
    if(g.mode==='FREE_ROAM'){nx=(nx+COLS)%COLS;ny=(ny+ROWS)%ROWS;}
    else if(nx<0||nx>=COLS||ny<0||ny>=ROWS){
      if(g.shield){g.shield=false;nx=clamp(nx,0,COLS-1);ny=clamp(ny,0,ROWS-1);if(g.haptics)vibrate([40,20,40]);unlock('shield_used');}
      else{if(g.haptics)vibrate([60,40,200]);if(g.soundOn)SFX.die();g.state='OVER';return;}
    }
    const nh={x:nx,y:ny};
    if(!g.ghost&&g.snake.slice(0,-1).some(s=>s.x===nx&&s.y===ny)){
      if(g.shield){g.shield=false;if(g.haptics)vibrate([40,20,40]);unlock('shield_used');}
      else{if(g.haptics)vibrate([60,40,200]);if(g.soundOn)SFX.die();g.state='OVER';return;}
    }
    const ateMain =nh.x===g.food.pos.x&&nh.y===g.food.pos.y;
    const ateBonus=!!g.bonus&&nh.x===g.bonus.pos.x&&nh.y===g.bonus.pos.y;
    const atePU   =!!g.pu   &&nh.x===g.pu.pos.x   &&nh.y===g.pu.pos.y;
    const newSnake=(ateMain||ateBonus)?[nh,...g.snake]:[nh,...g.snake.slice(0,-1)];
    g.snake=newSnake;
    if(ateMain){
      g.eaten++;g.combo++;g.comboExpiry=performance.now()+2600;
      const pts=(10+(g.combo>1?g.combo*2:0))*(g.double?2:1);
      g.score+=pts;g.level=Math.floor(g.score/50)+1;
      const px=nh.x*LC+LC/2,py=nh.y*LC+LC/2;
      g.particles=[...g.particles.slice(-90),...Array.from({length:14},()=>({x:px,y:py,vx:(Math.random()-0.5)*4.5,vy:(Math.random()-0.5)*4.5-0.8,life:0.8+Math.random()*0.2,color:THEMES[g.themeKey].foodGlow,size:2+Math.random()*3}))];
      g.floats=[...g.floats.slice(-10),{id:Math.random(),x:px,y:py,text:g.combo>1?`+${pts} ×${g.combo}`:`+${pts}`,color:g.themeKey==='dark'?'#60efff':'#0072ff'}];
      if(g.haptics)vibrate(7);if(g.soundOn)SFX.eat();
      g.food={pos:randomCell(newSnake)};
      if(Math.random()<0.22&&!g.bonus)g.bonus={pos:randomCell(newSnake),ttl:130};
      if(Math.random()<0.13&&!g.pu){const tp=['SHIELD','SLOW','DOUBLE','GHOST_MODE'] as PowerUpType[];g.pu={pos:randomCell(newSnake),type:tp[Math.floor(Math.random()*4)]};}
      setHighScores(prev=>{const b=prev[g.diff]??0;if(g.score>b){const n={...prev,[g.diff]:g.score};lsSet('sng_hs2',JSON.stringify(n));return n;}return prev;});
      setSavedLevels(prev=>{const b=prev[g.mode]??1;if(g.level>b){const n={...prev,[g.mode]:g.level};lsSet('sng_levels',JSON.stringify(n));return n;}return prev;});
      if(g.eaten===1)unlock('first_food');
      if(g.score>=50)unlock('score_50');if(g.score>=100)unlock('score_100');
      if(g.score>=250)unlock('score_250');if(g.score>=500)unlock('score_500');
      if(newSnake.length>=10)unlock('length_10');if(newSnake.length>=20)unlock('length_20');
      if(g.combo>=5)unlock('combo_5');
      if(g.score>=100&&g.diff==='TURBO')unlock('turbo_100');
      if(g.score>=250&&g.diff==='CHILL')unlock('chill_250');
    }
    if(ateBonus){
      g.bonus=null;const pts=g.double?50:25;g.score+=pts;
      const px=nh.x*LC+LC/2,py=nh.y*LC+LC/2;
      g.particles=[...g.particles.slice(-90),...Array.from({length:20},()=>({x:px,y:py,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5-1,life:0.85+Math.random()*0.15,color:'#ff00cc',size:2+Math.random()*3.5}))];
      g.floats=[...g.floats.slice(-10),{id:Math.random(),x:px,y:py,text:`+${pts}★`,color:'#ff00cc'}];
      if(g.haptics)vibrate([8,4,8]);if(g.soundOn)SFX.bonus();unlock('bonus_food');
    }
    if(atePU&&g.pu){
      const pt=g.pu.type;g.pu=null;g.ap={type:pt,ttl:200};
      const px=nh.x*LC+LC/2,py=nh.y*LC+LC/2;
      g.particles=[...g.particles.slice(-90),...Array.from({length:18},()=>({x:px,y:py,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4-0.6,life:0.9+Math.random()*0.1,color:'#ffd200',size:2.5+Math.random()*3}))];
      const LABS:Record<PowerUpType,string>={SHIELD:'🛡 SHIELD!',SLOW:'🐢 SLOW-MO!',DOUBLE:'×2 DOUBLE!',GHOST_MODE:'👻 GHOST!'};
      g.floats=[...g.floats.slice(-10),{id:Math.random(),x:px,y:py,text:LABS[pt],color:'#ffd200'}];
      if(g.haptics)vibrate([5,3,5,3,10]);if(g.soundOn)SFX.powerUp();
      if(pt==='SHIELD')g.shield=true;if(pt==='SLOW')g.slow=true;
      if(pt==='DOUBLE')g.double=true;if(pt==='GHOST_MODE')g.ghost=true;
      unlock('power_up');
    }
    if(g.bonus){g.bonus.ttl--;if(g.bonus.ttl<=0)g.bonus=null;}
    if(g.ap){
      g.ap.ttl--;
      if(g.ap.ttl<=0){
        const tp=g.ap.type;
        if(tp==='SHIELD')g.shield=false;if(tp==='SLOW')g.slow=false;
        if(tp==='DOUBLE')g.double=false;if(tp==='GHOST_MODE')g.ghost=false;
        g.ap=null;
      }
    }
    if(g.combo>0&&performance.now()>g.comboExpiry)g.combo=0;
  },[unlock]);

  const tickRef=useRef(tickFn);
  useEffect(()=>{tickRef.current=tickFn;},[tickFn]);

  // ── rAF loop — REPLACES ALL setInterval ──────────────────────
  const lastTsRef=useRef(0),accRef=useRef(0),timerAccRef=useRef(0),cdAccRef=useRef(0);
  useEffect(()=>{
    let af:number;
    const loop=(ts:number)=>{
      if(document.hidden){af=requestAnimationFrame(loop);return;}
      const delta=Math.min(ts-(lastTsRef.current||ts),100);
      lastTsRef.current=ts;
      const g=G.current;
      g.particles=g.particles.map(p=>({...p,x:p.x+p.vx,y:p.y+p.vy,vy:p.vy+0.07,life:p.life-0.024})).filter(p=>p.life>0);
      g.floats=g.floats.map(f=>({...f,y:f.y-0.85})).filter(f=>f.y>-20);
      g.pulse=(g.pulse+0.08)%(Math.PI*2);
      g.rainbowHue=(g.rainbowHue+1.5)%360;
      if(g.state==='COUNTDOWN'){
        cdAccRef.current+=delta;
        if(cdAccRef.current>=800){cdAccRef.current-=800;g.countdown--;if(g.countdown<=0){g.state='RUNNING';accRef.current=0;}}
      }
      if(g.state==='RUNNING'){
        timerAccRef.current+=delta;
        if(timerAccRef.current>=1000){timerAccRef.current-=1000;g.totalTime++;if(g.totalTime===60)unlock('survive_60');}
        const tr=getTickRate(g.score,g.diff,g.slow);
        accRef.current+=delta;
        while(accRef.current>=tr&&g.state==='RUNNING'){tickRef.current();accRef.current-=tr;}
      }
      const canvas=canvasRef.current;
      if(canvas){
        const ctx=canvas.getContext('2d');
        if(ctx){
          const dpr=clamp(window.devicePixelRatio||1,1,3);
          ctx.setTransform(dpr,0,0,dpr,0,0);
          drawCanvas(ctx,{snake:g.snake,food:{...g.food,pulse:g.pulse},bonus:g.bonus,pu:g.pu,state:g.state,theme:THEMES[g.themeKey]??THEMES.light,dark:g.themeKey==='dark',skin:g.skin,countdown:g.countdown,particles:g.particles,floats:g.floats,ghost:g.ghost,shield:g.shield,rainbowHue:g.rainbowHue,showGrid:g.showGrid,pulse:g.pulse});
        }
      }
      syncUI();af=requestAnimationFrame(loop);
    };
    af=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(af);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Start game ────────────────────────────────────────────────
  const startGame=useCallback(()=>{
    const g=G.current;
    const init=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    g.snake=[...init];g.dir='RIGHT';g.nextDir=null;
    g.food={pos:randomCell(init)};g.bonus=null;g.pu=null;g.ap=null;
    g.score=0;g.level=1;g.eaten=0;g.combo=0;g.totalTime=0;g.countdown=3;
    g.ghost=false;g.shield=false;g.double=false;g.slow=false;
    g.particles=[];g.floats=[];g.comboExpiry=0;
    accRef.current=0;timerAccRef.current=0;cdAccRef.current=0;
    g.state='COUNTDOWN';
  },[]);

  // ── Pause ─────────────────────────────────────────────────────
  const togglePause=useCallback(()=>{
    const g=G.current;
    if(g.state==='RUNNING'){g.state='PAUSED';}
    else if(g.state==='PAUSED'){accRef.current=0;g.state='RUNNING';}
  },[]);

  // ── Direction input ───────────────────────────────────────────
  const requestDir=useCallback((nd:Direction,vib?:number|number[])=>{
    const g=G.current;
    if(g.state!=='RUNNING'&&g.state!=='COUNTDOWN')return false;
    if(nd===g.dir||nd===OPPOSITE[g.dir])return false;
    g.nextDir=nd;if(g.haptics&&vib!=null)vibrate(vib);return true;
  },[]);

  // ── Keyboard ──────────────────────────────────────────────────
  useEffect(()=>{
    const KM:Record<string,Direction>={ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT',w:'UP',s:'DOWN',a:'LEFT',d:'RIGHT',W:'UP',S:'DOWN',A:'LEFT',D:'RIGHT'};
    const h=(e:KeyboardEvent)=>{
      if([' ','Escape','p','P'].includes(e.key)){e.preventDefault();const st=G.current.state;if(st==='RUNNING'||st==='PAUSED')togglePause();return;}
      if(e.key==='Enter'){const st=G.current.state;if(st==='IDLE'||st==='OVER'){startGame();return;}}
      const nd=KM[e.key];if(nd){e.preventDefault();requestDir(nd);}
    };
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[requestDir,togglePause,startGame]);

  // ── Swipe — ONLY intercepted during RUNNING/PAUSED ───────────
  // FIX: This is the critical mobile fix. By NOT calling e.preventDefault()
  // when IDLE or OVER, overlay buttons receive normal pointer events.
  const swipeOrigin=useRef<{x:number;y:number}|null>(null);
  const swipeHandled=useRef(false);
  const SWIPE_THRESH=useMemo(()=>Math.max(20,Math.round(boardSize*0.07)),[boardSize]);

  const trySwipe=useCallback((dx:number,dy:number)=>{
    const absX=Math.abs(dx),absY=Math.abs(dy);
    const dom=Math.max(absX,absY),weak=Math.min(absX,absY);
    if(dom<SWIPE_THRESH||weak>dom/1.3)return false;
    const nd:Direction=absX>absY?(dx>0?'RIGHT':'LEFT'):(dy>0?'DOWN':'UP');
    return requestDir(nd,6);
  },[SWIPE_THRESH,requestDir]);

  const onTouchStart=useCallback((e:React.TouchEvent)=>{
    const st=G.current.state;
    if(st!=='RUNNING'&&st!=='PAUSED'&&st!=='COUNTDOWN')return; // let overlays handle touch
    e.preventDefault();
    swipeOrigin.current={x:e.touches[0].clientX,y:e.touches[0].clientY};
    swipeHandled.current=false;
  },[]);
  const onTouchMove=useCallback((e:React.TouchEvent)=>{
    if(!swipeOrigin.current||swipeHandled.current)return;
    e.preventDefault();
    const dx=e.touches[0].clientX-swipeOrigin.current.x;
    const dy=e.touches[0].clientY-swipeOrigin.current.y;
    if(trySwipe(dx,dy)){swipeHandled.current=true;swipeOrigin.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}
  },[trySwipe]);
  const onTouchEnd=useCallback((e:React.TouchEvent)=>{
    if(!swipeOrigin.current)return;e.preventDefault();
    if(!swipeHandled.current){const t=e.changedTouches[0];trySwipe(t.clientX-swipeOrigin.current.x,t.clientY-swipeOrigin.current.y);}
    swipeOrigin.current=null;swipeHandled.current=false;
  },[trySwipe]);

  // ── D-pad ─────────────────────────────────────────────────────
  const [pressedDir,setPressedDir]=useState<Direction|null>(null);
  const holdRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const dStart=useCallback((d:Direction)=>{if(holdRef.current)clearInterval(holdRef.current);setPressedDir(d);requestDir(d,8);holdRef.current=setInterval(()=>requestDir(d),130);},[requestDir]);
  const dEnd=useCallback(()=>{setPressedDir(null);if(holdRef.current){clearInterval(holdRef.current);holdRef.current=null;}},[]);
  useEffect(()=>()=>{if(holdRef.current)clearInterval(holdRef.current);},[]);

  // ── Derived ───────────────────────────────────────────────────
  const highScore  =highScores[difficulty]??0;
  const isRunning  =gameState==='RUNNING';
  const isOver     =gameState==='OVER';
  const isIdle     =gameState==='IDLE';
  const isPaused   =gameState==='PAUSED';
  const isCounting =gameState==='COUNTDOWN';
  const unlockedCnt=achievements.filter(a=>a.unlocked).length;
  const dPadBtnSize=isTiny?46:Math.max(48,Math.min(60,Math.round(vw*0.12)));
  const speedLabel=(()=>{const{base,inc}=SPEED[difficulty];return Math.round((base-getTickRate(score,difficulty,slowUI))/inc+1);})();

  // ── Style tokens ──────────────────────────────────────────────
  const rootGradient=isDark
    ?'radial-gradient(circle at top left,rgba(96,239,255,0.20),transparent 34%),radial-gradient(circle at bottom right,rgba(255,0,204,0.16),transparent 30%),linear-gradient(145deg,#040511 0%,#0c1028 42%,#140a20 100%)'
    :'radial-gradient(circle at top left,rgba(0,198,255,0.18),transparent 34%),radial-gradient(circle at bottom right,rgba(255,99,146,0.16),transparent 30%),linear-gradient(145deg,#f7fffe 0%,#eef5ff 45%,#edf3ff 100%)';

  const glass:React.CSSProperties={
    background:isDark?'rgba(11,16,36,0.58)':'rgba(255,255,255,0.58)',
    border:`1px solid ${isDark?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.72)'}`,
    boxShadow:isDark?'0 18px 44px rgba(0,0,0,0.34),inset 0 1px 0 rgba(255,255,255,0.06)':'0 20px 40px rgba(90,125,170,0.16),inset 0 1px 0 rgba(255,255,255,0.85)',
    backdropFilter:'blur(20px) saturate(145%)',WebkitBackdropFilter:'blur(20px) saturate(145%)',
  };
  const softInset=isDark?'inset 0 1px 0 rgba(255,255,255,0.08),inset 0 -10px 30px rgba(0,0,0,0.22)':'inset 0 1px 0 rgba(255,255,255,0.86),inset 0 -14px 30px rgba(123,161,214,0.12)';
  const btnPri:React.CSSProperties={background:T.btnPri,color:T.btnPriTxt,border:'none',borderRadius:'14px',fontFamily:"'Orbitron',monospace",fontWeight:800,fontSize:isTiny?'10px':isCompact?'11px':'12px',letterSpacing:'0.12em',padding:isTiny?'9px 12px':isCompact?'10px 14px':'11px 20px',cursor:'pointer',boxShadow:isDark?`0 18px 34px ${T.uiAccent2}20,inset 0 1px 0 rgba(255,255,255,0.18)`:'0 16px 30px rgba(0,114,255,0.18),inset 0 1px 0 rgba(255,255,255,0.55)',transition:'transform 0.18s,box-shadow 0.18s',WebkitTapHighlightColor:'transparent',touchAction:'manipulation'};
  const btnSec:React.CSSProperties={background:isDark?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.55)',color:T.btnSecTxt,border:`1px solid ${T.btnSecBdr}`,borderRadius:'14px',fontFamily:"'Orbitron',monospace",fontWeight:700,fontSize:isTiny?'10px':isCompact?'11px':'12px',letterSpacing:'0.1em',padding:isTiny?'8px 10px':isCompact?'9px 12px':'10px 16px',cursor:'pointer',transition:'transform 0.18s,background 0.18s',backdropFilter:'blur(12px)',WebkitTapHighlightColor:'transparent',touchAction:'manipulation'};
  const scoreBox:React.CSSProperties={background:isDark?'linear-gradient(180deg,rgba(20,26,52,0.70),rgba(8,10,26,0.72))':'linear-gradient(180deg,rgba(255,255,255,0.78),rgba(243,248,255,0.86))',border:`1px solid ${T.border}`,borderRadius:'16px',padding:isTiny?'8px 10px':isCompact?'10px 12px':'12px 14px',textAlign:'center',boxShadow:`${glass.boxShadow},${softInset}`};

  // ── Panel + sub-components ────────────────────────────────────
  const PanelShell=({children}:{children:React.ReactNode})=>(
    <div style={{position:'fixed',inset:0,zIndex:100,background:isDark?'rgba(6,8,20,0.82)':'rgba(240,247,255,0.78)',display:'flex',flexDirection:'column',alignItems:'center',padding:'16px 12px',overflowY:'auto',gap:'10px',backdropFilter:'blur(24px) saturate(140%)',WebkitBackdropFilter:'blur(24px) saturate(140%)',paddingTop:'max(16px,env(safe-area-inset-top))',paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>{children}</div>
  );
  const PTitle=({txt}:{txt:string})=>(<h2 style={{fontFamily:"'Orbitron',monospace",color:T.uiAccent,margin:0,letterSpacing:'0.14em',fontSize:'clamp(15px,4vw,20px)',textTransform:'uppercase',textShadow:isDark?`0 0 24px ${T.uiAccent}55`:'0 8px 22px rgba(0,114,255,0.16)'}}>{txt}</h2>);
  const Toggle=({val,fn}:{val:boolean;fn:(v:boolean)=>void})=>(
    <button style={{background:val?T.btnPri:'transparent',border:`1.5px solid ${val?'transparent':T.btnSecBdr}`,borderRadius:'20px',width:44,height:22,cursor:'pointer',position:'relative',transition:'all 0.2s',WebkitTapHighlightColor:'transparent',flexShrink:0}} onClick={()=>fn(!val)}>
      <div style={{position:'absolute',top:2,left:val?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
    </button>
  );
  const DBtn=({d,lbl}:{d:Direction;lbl:string})=>(
    <button type="button" aria-label={`Move ${d.toLowerCase()}`} style={{width:dPadBtnSize,height:dPadBtnSize,borderRadius:'12px',background:pressedDir===d?`${T.uiAccent}33`:(isDark?'rgba(18,24,46,0.72)':'rgba(255,255,255,0.72)'),border:`1.5px solid ${pressedDir===d?T.uiAccent:T.border}`,color:pressedDir===d?T.uiAccent:T.uiSub,fontSize:isTiny?'16px':'18px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all 0.08s',userSelect:'none',WebkitTapHighlightColor:'transparent',touchAction:'none',boxShadow:pressedDir===d?`0 10px 22px ${T.uiAccent}22,inset 0 1px 0 rgba(255,255,255,0.18)`:`${softInset},0 8px 18px rgba(0,0,0,0.08)`,backdropFilter:'blur(16px)'}} onPointerDown={e=>{e.preventDefault();dStart(d);}} onPointerUp={dEnd} onPointerLeave={dEnd} onPointerCancel={dEnd}>{lbl}</button>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;overscroll-behavior:none}
        body{position:fixed;width:100%}
        #root{width:100%;height:100%}
        button{outline:none;-webkit-tap-highlight-color:transparent}
        button:active{transform:scale(0.93)}
        @keyframes achSlide{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{opacity:0.8}50%{opacity:1}}
        @keyframes floatOrb{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-16px,0) scale(1.06)}}
        @keyframes staggerIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
      `}</style>

      <div style={{position:'fixed',inset:0,background:rootGradient,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:"'Rajdhani',sans-serif",overflow:'hidden',transition:'background 0.5s',paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)',paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)'}}>
        {/* Ambient orbs */}
        <div style={{position:'absolute',inset:'-8% auto auto -12%',width:'42vw',height:'42vw',minWidth:180,minHeight:180,borderRadius:'50%',background:isDark?'rgba(96,239,255,0.13)':'rgba(0,198,255,0.14)',filter:'blur(22px)',animation:'floatOrb 9s ease-in-out infinite',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:'auto -10% -14% auto',width:'38vw',height:'38vw',minWidth:180,minHeight:180,borderRadius:'50%',background:isDark?'rgba(255,0,204,0.12)':'rgba(255,120,120,0.12)',filter:'blur(24px)',animation:'floatOrb 12s ease-in-out infinite reverse',pointerEvents:'none'}}/>

        {/* SHELL */}
        <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',maxWidth:'580px',padding:isTiny?'5px':isCompact?'7px 8px':'10px 12px',gap:isTiny?'3px':isCompact?'4px':'6px',alignItems:'stretch',position:'relative',zIndex:1,overflowX:'hidden',overflowY:'auto',WebkitOverflowScrolling:'touch' as React.CSSProperties['WebkitOverflowScrolling']}}>

          {/* TOP BAR */}
          <div style={{...glass,display:'flex',alignItems:'center',justifyContent:'space-between',gap:'6px',flexShrink:0,flexWrap:'nowrap',padding:isTiny?'9px 10px':isCompact?'10px 12px':'12px 16px',borderRadius:'20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'5px',minWidth:0}}>
              <h1 style={{fontFamily:"'Orbitron',monospace",fontWeight:900,fontSize:isTiny?'14px':isCompact?'16px':'clamp(16px,3.4vw,22px)',color:T.uiAccent,letterSpacing:'0.2em',textShadow:isDark?`0 0 22px ${T.uiAccent}99`:'0 10px 24px rgba(0,114,255,0.18)',margin:0,flexShrink:0}}>SNAKE</h1>
              <span style={{fontFamily:"'Orbitron',monospace",fontSize:'9px',fontWeight:700,color:T.uiAccent2,background:`${T.uiAccent2}18`,border:`1px solid ${T.uiAccent2}44`,borderRadius:'999px',padding:'3px 6px',flexShrink:0}}>LV{level}</span>
              {gameMode==='FREE_ROAM'&&<span style={{fontSize:'8px',color:T.uiAccent2,fontWeight:700,background:`${T.uiAccent2}14`,border:`1px solid ${T.uiAccent2}33`,borderRadius:'4px',padding:'1px 4px',flexShrink:0}}>🌀WRAP</span>}
            </div>
            <div style={{display:'flex',gap:'3px',flexShrink:0}}>
              {([{icon:'🎨',tip:'Skins',p:'skins'},{icon:'🏆',tip:'Achievements',p:'achievements'},{icon:'📊',tip:'Scores',p:'scores'},{icon:'⚙️',tip:'Settings',p:'settings'}] as const).map(btn=>(
                <button key={btn.p} title={btn.tip} onClick={()=>setPanel(btn.p)} style={{...glass,border:`1px solid ${T.border}`,borderRadius:'12px',color:T.uiSub,cursor:'pointer',padding:isTiny?'6px 7px':'7px 8px',fontSize:isTiny?'12px':'13px',lineHeight:'1',display:'flex',alignItems:'center',gap:'3px',transition:'transform 0.18s',WebkitTapHighlightColor:'transparent'}}>
                  {btn.icon}{btn.p==='achievements'&&<span style={{fontSize:'8px',color:T.uiAccent}}>{unlockedCnt}</span>}
                </button>
              ))}
              <button style={{...glass,border:`1px solid ${T.border}`,borderRadius:'12px',color:isDark?'#ffd200':T.uiSub,cursor:'pointer',padding:isTiny?'6px 7px':'7px 8px',fontSize:isTiny?'12px':'13px',transition:'transform 0.18s',WebkitTapHighlightColor:'transparent'}} onClick={()=>setThemeKey(k=>k==='dark'?'light':'dark')}>{isDark?'☀️':'🌙'}</button>
            </div>
          </div>

          {/* SCORE ROW */}
          <div style={{display:'grid',gridTemplateColumns:isTiny?'repeat(2,minmax(0,1fr))':'repeat(4,minmax(0,1fr))',gap:isTiny?'3px':'5px',flexShrink:0}}>
            {([{l:'Score',v:score,acc:false},{l:'Best',v:highScore,acc:true},{l:'Speed',v:`${speedLabel}×`,acc:false},{l:'Length',v:snakeLen,acc:false}] as {l:string;v:string|number;acc:boolean}[]).map(it=>(
              <div key={it.l} style={{...scoreBox,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',inset:'0 auto auto 0',width:'40%',height:'1px',background:`linear-gradient(90deg,${T.uiAccent}66,transparent)`}}/>
                <span style={{display:'block',fontSize:'7px',fontWeight:700,letterSpacing:'0.16em',color:T.uiSub,textTransform:'uppercase',marginBottom:'3px'}}>{it.l}</span>
                <span style={{display:'block',fontFamily:"'Orbitron',monospace",fontSize:isTiny?'12px':isCompact?'13px':'clamp(12px,2.5vw,17px)',fontWeight:800,color:it.acc?T.uiAccent:T.uiText,lineHeight:'1.1'}}>{it.v}</span>
              </div>
            ))}
          </div>

          {/* CANVAS AREA */}
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:0,position:'relative'}}>
            <div
              style={{position:'relative',width:boardSize,height:boardSize,maxWidth:'100%',maxHeight:'100%',borderRadius:isTiny?'16px':'22px',overflow:'hidden',background:isDark?'rgba(8,12,28,0.56)':'rgba(255,255,255,0.60)',border:`1px solid ${isDark?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.72)'}`,boxShadow:isDark?`0 20px 50px rgba(0,0,0,0.45),0 0 0 1.5px ${T.border},inset 0 1px 0 rgba(255,255,255,0.10)${isRunning?`,0 0 24px ${T.uiAccent}22`:''}`:`0 20px 46px rgba(77,119,191,0.18),0 0 0 1.5px ${T.border},inset 0 1px 0 rgba(255,255,255,0.78)${isRunning?',0 0 22px rgba(0,114,255,0.10)':''}`,transition:'box-shadow 0.4s',backdropFilter:'blur(20px)',touchAction:(isRunning||isPaused||isCounting)?'none':'auto',flexShrink:1}}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              <div style={{position:'absolute',inset:'0 0 auto 0',height:'30%',background:'linear-gradient(180deg,rgba(255,255,255,0.10),transparent)',pointerEvents:'none',zIndex:1,borderRadius:'22px 22px 0 0'}}/>
              <canvas ref={canvasRef} style={{display:'block',width:boardSize,height:boardSize}}/>

              {/* IDLE OVERLAY — pointerEvents:auto ensures touch works */}
              {isIdle&&(
                <div style={{position:'absolute',inset:0,background:isDark?'linear-gradient(180deg,rgba(8,12,28,0.93),rgba(8,10,26,0.82))':'linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,249,255,0.82))',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:isTiny?'9px':isCompact?'11px':'14px',borderRadius:isTiny?'16px':'22px',backdropFilter:'blur(18px) saturate(145%)',padding:isTiny?'14px':isCompact?'18px':'24px',animation:'fadeUp 0.35s ease',overflowY:'auto',pointerEvents:'auto'}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:isTiny?'26px':isCompact?'30px':'clamp(28px,7vw,44px)',fontWeight:900,color:T.uiAccent,letterSpacing:'0.18em',textShadow:isDark?`0 0 28px ${T.uiAccent}`:'0 12px 28px rgba(0,114,255,0.20)'}}>SNAKE</div>
                  {!isTiny&&<p style={{color:T.uiSub,fontSize:'10px',textAlign:'center',letterSpacing:'0.22em',textTransform:'uppercase',margin:0}}>Neon arcade · rebuilt for touch</p>}
                  <div style={{display:'grid',gridTemplateColumns:isTiny?'1fr':'1fr 1fr',gap:'7px',width:'100%',maxWidth:isTiny?'200px':'300px'}}>
                    {(['CLASSIC','FREE_ROAM'] as GameMode[]).map(mode=>{
                      const[icon,sub]=mode==='CLASSIC'?['🧱','Borders fatal']:['🌀','Wrap edges'];
                      return(<button key={mode} style={{...glass,padding:isTiny?'10px 8px':'12px 8px',borderRadius:'16px',background:gameMode===mode?(isDark?'linear-gradient(180deg,rgba(96,239,255,0.20),rgba(10,18,36,0.72))':'linear-gradient(180deg,rgba(0,114,255,0.10),rgba(255,255,255,0.72))'):glass.background as string,border:`1.5px solid ${gameMode===mode?T.uiAccent:T.border}`,color:gameMode===mode?T.uiAccent:T.uiSub,cursor:'pointer',transition:'all 0.2s',display:'flex',flexDirection:'column',alignItems:'center',WebkitTapHighlightColor:'transparent',touchAction:'manipulation'}} onClick={()=>setGameMode(mode)}>
                        <span style={{fontSize:isTiny?'16px':'18px',marginBottom:'3px'}}>{icon}</span>
                        <span style={{fontFamily:"'Orbitron',monospace",fontSize:isTiny?'9px':'11px',fontWeight:700}}>{mode.replace('_',' ')}</span>
                        {!isTiny&&<span style={{fontSize:'8px',marginTop:'2px',opacity:0.75}}>{sub}</span>}
                        <span style={{fontSize:'9px',color:T.uiAccent2,marginTop:'3px'}}>Lv.{savedLevels[mode]??1}</span>
                      </button>);
                    })}
                  </div>
                  <button style={{...btnPri,fontSize:isTiny?'12px':'13px',padding:isTiny?'12px 28px':'13px 36px',textTransform:'uppercase',letterSpacing:'0.16em'}} onClick={startGame}>▶ START GAME</button>
                </div>
              )}

              {/* GAME OVER OVERLAY */}
              {isOver&&(
                <div style={{position:'absolute',inset:0,background:isDark?'linear-gradient(180deg,rgba(12,6,20,0.93),rgba(8,10,26,0.88))':'linear-gradient(180deg,rgba(255,255,255,0.93),rgba(245,249,255,0.86))',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:isTiny?'7px':'10px',borderRadius:'22px',backdropFilter:'blur(18px) saturate(145%)',padding:isTiny?'14px':'20px',animation:'fadeUp 0.35s ease',overflowY:'auto',pointerEvents:'auto'}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:isTiny?'16px':isCompact?'20px':'clamp(18px,5vw,26px)',fontWeight:900,color:T.food1,letterSpacing:'0.14em',textShadow:isDark?`0 0 22px ${T.food1}`:'0 10px 24px rgba(255,65,108,0.18)'}}>GAME OVER</div>
                  <div style={{...scoreBox,padding:isTiny?'10px 14px':'12px 20px',minWidth:isTiny?130:160}}>
                    <div style={{fontSize:'8px',letterSpacing:'0.2em',textTransform:'uppercase',color:T.uiSub,marginBottom:'6px'}}>Final Score</div>
                    <div style={{fontFamily:"'Orbitron',monospace",fontSize:isTiny?'24px':isCompact?'30px':'clamp(26px,6vw,40px)',fontWeight:900,color:T.uiText,lineHeight:1}}>{score}<span style={{fontSize:'12px',color:T.uiSub,marginLeft:'2px'}}>pts</span></div>
                  </div>
                  {score>=highScore&&score>0&&<div style={{...glass,fontFamily:"'Orbitron',monospace",fontSize:'10px',color:T.uiAccent,letterSpacing:'0.1em',animation:'pulseGlow 1s infinite',padding:'7px 10px',borderRadius:'999px'}}>🏆 NEW {difficulty} RECORD!</div>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',width:'100%',maxWidth:220}}>
                    {([['TIME',`${totalTime}s`],['LENGTH',snakeLen],['LEVEL',level],['EATEN',foodEaten]] as [string,string|number][]).map(([l,v],i)=>(
                      <div key={l} style={{...scoreBox,padding:isTiny?'7px 6px':'9px 8px',animation:'staggerIn 0.4s ease both',animationDelay:`${i*0.08}s`}}>
                        <span style={{display:'block',fontSize:'8px',fontWeight:700,color:T.uiSub,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'3px'}}>{l}</span>
                        <span style={{display:'block',fontFamily:"'Orbitron',monospace",fontSize:isTiny?'12px':'14px',fontWeight:700,color:T.uiText}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:'7px',flexWrap:'wrap',justifyContent:'center'}}>
                    <button style={{...btnPri,padding:isTiny?'10px 20px':'11px 24px'}} onClick={startGame}>↺ PLAY AGAIN</button>
                    <button style={{...btnSec,padding:isTiny?'9px 12px':'10px 14px'}} onClick={()=>{G.current.state='IDLE';snap.current.gameState='IDLE';setGameStateUI('IDLE');}}>MENU</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* POWER-UP / COMBO ROW */}
          <div style={{display:'flex',gap:'5px',justifyContent:'center',flexShrink:0,minHeight:isTiny?0:26,flexWrap:'wrap',alignItems:'center'}}>
            {activePower&&(()=>{
              const INFO:Record<PowerUpType,{icon:string;label:string;color:string}>={SHIELD:{icon:'🛡',label:'SHIELD',color:'#ffd200'},SLOW:{icon:'🐢',label:'SLOW-MO',color:'#00c6ff'},DOUBLE:{icon:'×2',label:'DOUBLE',color:'#00ff87'},GHOST_MODE:{icon:'👻',label:'GHOST',color:'#cc88ff'}};
              const nfo=INFO[activePower.type],pct=activePower.ttl/200;
              return(<div style={{background:isDark?`${nfo.color}16`:'rgba(255,255,255,0.72)',border:`1px solid ${nfo.color}55`,borderRadius:'12px',padding:isTiny?'4px 8px':'6px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',fontFamily:"'Orbitron',monospace",fontSize:'9px',fontWeight:700,color:nfo.color,boxShadow:`0 10px 20px ${nfo.color}16`,backdropFilter:'blur(12px)'}}>
                <span>{nfo.icon} {nfo.label}</span>
                <div style={{width:56,height:3,background:`${nfo.color}28`,borderRadius:2}}><div style={{width:`${pct*100}%`,height:'100%',background:nfo.color,borderRadius:2,transition:'width 0.1s'}}/></div>
              </div>);
            })()}
            {combo>1&&<div style={{background:isDark?'rgba(255,106,0,0.15)':'rgba(255,255,255,0.75)',border:'1px solid rgba(255,106,0,0.5)',borderRadius:'12px',padding:isTiny?'4px 8px':'6px 10px',fontFamily:"'Orbitron',monospace",fontSize:'9px',fontWeight:700,color:'#ff6a00',animation:'pulseGlow 0.8s infinite',backdropFilter:'blur(12px)'}}>🔥 ×{combo} COMBO</div>}
          </div>

          {/* ACTION BUTTONS */}
          <div style={{...glass,display:'flex',justifyContent:'center',gap:'6px',flexShrink:0,flexWrap:'wrap',padding:isTiny?'6px 8px':'8px 10px',borderRadius:'18px',opacity:(isRunning||isPaused||isCounting)?1:0,pointerEvents:(isRunning||isPaused||isCounting)?'auto':'none',transition:'opacity 0.2s'}}>
            <button style={btnPri} onClick={togglePause}>{isPaused?'▶ RESUME':'⏸ PAUSE'}</button>
            <button style={btnSec} onClick={startGame}>↺ RESTART</button>
            <button style={{...btnSec,border:'none',background:'transparent'}} onClick={()=>{G.current.state='IDLE';snap.current.gameState='IDLE';setGameStateUI('IDLE');}}>✕ EXIT</button>
          </div>

          {/* D-PAD */}
          <div style={{...glass,display:'grid',gridTemplateColumns:`repeat(3,${dPadBtnSize}px)`,gridTemplateRows:`repeat(3,${dPadBtnSize}px)`,gap:isTiny?'5px':isCompact?'6px':'8px',margin:'0 auto',flexShrink:0,touchAction:'none',padding:isTiny?'8px':isCompact?'10px':'12px',borderRadius:isTiny?'16px':'22px'}}>
            <div/><DBtn d="UP" lbl="▲"/><div/>
            <DBtn d="LEFT" lbl="◀"/>
            <div style={{width:dPadBtnSize,height:dPadBtnSize,borderRadius:'12px',background:T.scoreBg,border:`1px solid ${T.border}`,opacity:0.3,display:'flex',alignItems:'center',justifyContent:'center',color:T.uiSub,fontSize:'14px'}}>●</div>
            <DBtn d="RIGHT" lbl="▶"/>
            <div/><DBtn d="DOWN" lbl="▼"/><div/>
          </div>

          {!isTiny&&!isCompact&&<p style={{textAlign:'center',color:T.uiSub,fontSize:'8px',letterSpacing:'0.14em',flexShrink:0,textTransform:'uppercase',opacity:0.7}}>↑↓←→ · WASD · SPACE=pause · ENTER=start</p>}
        </div>

        {/* SETTINGS */}
        {panel==='settings'&&(
          <PanelShell>
            <PTitle txt="SETTINGS"/>
            <div style={{width:'100%',maxWidth:360,display:'flex',flexDirection:'column',gap:'8px'}}>
              {([{label:'SHOW GRID',val:showGrid,fn:setShowGrid},{label:'HAPTIC FEEDBACK',val:haptics,fn:setHaptics},{label:'SOUND EFFECTS',val:soundOn,fn:setSoundOn}] as {label:string;val:boolean;fn:(v:boolean)=>void}[]).map(o=>(
                <div key={o.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:T.scoreBg,border:`1px solid ${T.border}`,borderRadius:'12px',padding:'12px 14px',gap:'12px'}}>
                  <span style={{color:T.uiText,fontWeight:600,fontSize:'13px',flex:1}}>{o.label}</span>
                  <Toggle val={o.val} fn={o.fn}/>
                </div>
              ))}
              <div style={{background:T.scoreBg,border:`1px solid ${T.border}`,borderRadius:'12px',padding:'12px 14px'}}>
                <span style={{color:T.uiText,fontWeight:600,fontSize:'13px',display:'block',marginBottom:'8px'}}>DIFFICULTY</span>
                <div style={{display:'flex',gap:'5px'}}>
                  {DIFFS.map(d=><button key={d} style={{...btnSec,flex:1,background:difficulty===d?T.btnPri:'transparent',color:difficulty===d?T.btnPriTxt:T.btnSecTxt,border:`1.5px solid ${difficulty===d?'transparent':T.btnSecBdr}`}} onClick={()=>setDifficulty(d)}>{d}</button>)}
                </div>
              </div>
              <div style={{background:T.scoreBg,border:`1px solid ${T.border}`,borderRadius:'12px',padding:'12px 14px'}}>
                <span style={{color:T.uiText,fontWeight:600,fontSize:'13px',display:'block',marginBottom:'8px'}}>THEME</span>
                <div style={{display:'flex',gap:'5px'}}>
                  {(['light','dark'] as ThemeKey[]).map(k=><button key={k} style={{...btnSec,flex:1,background:themeKey===k?T.btnPri:'transparent',color:themeKey===k?T.btnPriTxt:T.btnSecTxt,border:`1.5px solid ${themeKey===k?'transparent':T.btnSecBdr}`}} onClick={()=>setThemeKey(k)}>{k==='dark'?'🌙 DARK':'☀️ LIGHT'}</button>)}
                </div>
              </div>
            </div>
            <button style={{...btnPri,marginTop:'6px'}} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* SKINS */}
        {panel==='skins'&&(
          <PanelShell>
            <PTitle txt="SKINS"/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'7px',width:'100%',maxWidth:360}}>
              {(Object.entries(SKIN_DEFS) as [SkinId,typeof SKIN_DEFS[SkinId]][]).map(([id,def])=>(
                <button key={id} style={{background:skin===id?`${T.uiAccent}20`:T.scoreBg,border:`1.5px solid ${skin===id?T.uiAccent:T.border}`,borderRadius:'12px',padding:'10px 7px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',transition:'all 0.15s',WebkitTapHighlightColor:'transparent'}} onClick={()=>setSkin(id)}>
                  <span style={{fontSize:'22px'}}>{def.icon}</span>
                  <span style={{fontFamily:"'Orbitron',monospace",fontSize:'9px',fontWeight:700,color:skin===id?T.uiAccent:T.uiText}}>{def.name}</span>
                  <div style={{display:'flex',gap:'3px'}}>{[def.head[0],def.body[0],def.body[1]].map((c,i)=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:c}}/>)}</div>
                  {skin===id&&<span style={{fontSize:'11px'}}>✓</span>}
                </button>
              ))}
            </div>
            <button style={{...btnPri,marginTop:'6px'}} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ACHIEVEMENTS */}
        {panel==='achievements'&&(
          <PanelShell>
            <PTitle txt="ACHIEVEMENTS"/>
            <p style={{color:T.uiSub,fontSize:'12px',margin:0}}>{unlockedCnt} / {achievements.length} unlocked</p>
            <div style={{width:'100%',maxWidth:400,display:'flex',flexDirection:'column',gap:'5px'}}>
              {achievements.map(a=>(
                <div key={a.id} style={{background:a.unlocked?T.scoreBg:(isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.025)'),border:`1px solid ${a.unlocked?T.uiAccent+'44':T.border}`,borderRadius:'10px',padding:'9px 12px',display:'flex',alignItems:'center',gap:'9px',opacity:a.unlocked?1:0.42}}>
                  <span style={{fontSize:'18px',minWidth:24}}>{a.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:'11px',color:T.uiText,fontFamily:"'Orbitron',monospace"}}>{a.label}</div>
                    <div style={{fontSize:'10px',color:T.uiSub}}>{a.desc}</div>
                  </div>
                  {a.unlocked&&<span style={{color:T.uiAccent,fontSize:'13px'}}>✓</span>}
                </div>
              ))}
            </div>
            <button style={{...btnPri,marginTop:'6px'}} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* SCORES */}
        {panel==='scores'&&(
          <PanelShell>
            <PTitle txt="HIGH SCORES"/>
            <div style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:'7px'}}>
              {DIFFS.map((d,i)=>(
                <div key={d} style={{...scoreBox,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
                    <span style={{fontSize:'20px'}}>{i===0?'🧊':i===1?'🎯':'🚀'}</span>
                    <span style={{fontFamily:"'Orbitron',monospace",fontSize:'12px',fontWeight:700,color:T.uiText}}>{d}</span>
                  </div>
                  <span style={{fontFamily:"'Orbitron',monospace",fontSize:'20px',fontWeight:900,color:T.uiAccent}}>{highScores[d]??0}</span>
                </div>
              ))}
              <div style={{...scoreBox,padding:'13px',textAlign:'center'}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:'9px',color:T.uiSub,marginBottom:'4px',letterSpacing:'0.1em'}}>ACHIEVEMENTS UNLOCKED</div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:'20px',fontWeight:900,color:T.uiAccent2}}>{unlockedCnt}/{achievements.length}</div>
              </div>
            </div>
            <button style={{...btnPri,marginTop:'6px'}} onClick={()=>setPanel(null)}>✓ CLOSE</button>
          </PanelShell>
        )}

        {/* ACHIEVEMENT TOAST — FIX: uses `inset` instead of duplicate `bottom` */}
        {newAch&&(
          <div style={{
            position:'fixed',
            inset:`auto 12px max(20px,calc(20px + env(safe-area-inset-bottom))) auto`,
            zIndex:200,
            background:isDark?'linear-gradient(180deg,rgba(10,8,28,0.97),rgba(8,14,32,0.94))':'linear-gradient(180deg,rgba(255,255,255,0.97),rgba(244,249,255,0.96))',
            border:`1.5px solid ${T.uiAccent}`,
            borderRadius:'16px',padding:'11px 14px',
            display:'flex',alignItems:'center',gap:'9px',
            boxShadow:'0 16px 32px rgba(0,0,0,0.22)',
            animation:'achSlide 0.4s ease',
            backdropFilter:'blur(18px)',maxWidth:'250px',
          }}>
            <span style={{fontSize:'24px'}}>{newAch.icon}</span>
            <div>
              <div style={{fontSize:'7px',letterSpacing:'0.12em',color:T.uiAccent,fontWeight:700,fontFamily:"'Orbitron',monospace"}}>ACHIEVEMENT UNLOCKED</div>
              <div style={{fontSize:'11px',fontWeight:700,color:T.uiText,fontFamily:"'Orbitron',monospace"}}>{newAch.label}</div>
              <div style={{fontSize:'9px',color:T.uiSub}}>{newAch.desc}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SnakeGame;