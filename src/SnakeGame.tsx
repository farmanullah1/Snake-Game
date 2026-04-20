import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'OVER';
type Difficulty = 'CHILL' | 'NORMAL' | 'TURBO';

// ── Constants ──────────────────────────────────────────────────────────────
const CELL_SIZE = 20;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const CANVAS_SIZE = CELL_SIZE * GRID_WIDTH; // 400px

const SPEED_MAP: Record<Difficulty, { base: number; min: number; increment: number }> = {
  CHILL: { base: 200, min: 100, increment: 3 },
  NORMAL: { base: 140, min: 60, increment: 5 },
  TURBO: { base: 80, min: 30, increment: 6 },
};

const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];
const INITIAL_DIRECTION: Direction = 'RIGHT';

function getRandomFoodPosition(snake: Point[]): Point {
  let position: Point;
  do {
    position = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT),
    };
  } while (snake.some((segment) => segment.x === position.x && segment.y === position.y));
  return position;
}

// ── Theme definitions ──────────────────────────────────────────────────────
const lightTheme = {
  bg1: '#e0f7fa',
  bg2: '#ffffff',
  gridLine: '#dfe6e9',
  snakeHead: '#0052d4',
  snakeBody1: '#00c6ff',
  snakeBody2: '#0072ff',
  food1: '#ff416c',
  food2: '#ff4b2b',
  border: '#b2dfdb',
  uiBg: 'rgba(255, 255, 255, 0.85)',
  uiText: '#1a1a2e',
  uiAccent: '#0072ff',
  uiSubtext: '#636e72',
  modalBg: 'rgba(224, 247, 250, 0.97)',
  scoreBg: 'rgba(255, 255, 255, 0.7)',
  buttonBg: 'linear-gradient(135deg, #00c6ff, #0072ff)',
  buttonText: '#fff',
  pauseOverlay: 'rgba(0, 0, 0, 0.08)',
};

const darkTheme = {
  bg1: '#0f0c29',
  bg2: '#24243e',
  gridLine: '#2d3436',
  snakeHead: '#00ffa6',
  snakeBody1: '#00ff87',
  snakeBody2: '#60efff',
  food1: '#ff00cc',
  food2: '#ff6a00',
  border: '#302b63',
  uiBg: 'rgba(15, 12, 41, 0.92)',
  uiText: '#eaf6ff',
  uiAccent: '#60efff',
  uiSubtext: '#a0aec0',
  modalBg: 'rgba(15, 12, 41, 0.97)',
  scoreBg: 'rgba(255, 255, 255, 0.05)',
  buttonBg: 'linear-gradient(135deg, #00ff87, #60efff)',
  buttonText: '#0f0c29',
  pauseOverlay: 'rgba(0, 0, 0, 0.35)',
};

type Theme = typeof lightTheme;

// ── Drawing utilities ──────────────────────────────────────────────────────
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawGame = (
  ctx: CanvasRenderingContext2D,
  snake: Point[],
  food: Point,
  theme: Theme,
  isDarkMode: boolean,
  gameState: GameState
) => {
  const size = CANVAS_SIZE;
  // Background gradient
  const bgGradient = ctx.createLinearGradient(0, 0, size, size);
  bgGradient.addColorStop(0, theme.bg1);
  bgGradient.addColorStop(1, theme.bg2);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, size, size);

  // Grid lines
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_WIDTH; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(size, i * CELL_SIZE);
    ctx.stroke();
  }

  // Draw food with glow and shine
  const foodX = food.x * CELL_SIZE + CELL_SIZE / 2;
  const foodY = food.y * CELL_SIZE + CELL_SIZE / 2;
  const foodGradient = ctx.createRadialGradient(foodX, foodY, 2, foodX, foodY, CELL_SIZE / 2);
  foodGradient.addColorStop(0, theme.food1);
  foodGradient.addColorStop(1, theme.food2);
  ctx.save();
  ctx.shadowColor = theme.food1;
  ctx.shadowBlur = isDarkMode ? 16 : 8;
  ctx.fillStyle = foodGradient;
  ctx.beginPath();
  ctx.arc(foodX, foodY, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(foodX - 3, foodY - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw snake
  snake.forEach((segment, idx) => {
    const x = segment.x * CELL_SIZE + 1;
    const y = segment.y * CELL_SIZE + 1;
    const segSize = CELL_SIZE - 2;
    const radius = idx === 0 ? 6 : 4;

    ctx.save();
    if (isDarkMode) {
      ctx.shadowColor = idx === 0 ? theme.snakeHead : theme.snakeBody1;
      ctx.shadowBlur = idx === 0 ? 18 : 10;
    }

    if (idx === 0) {
      // Snake head
      const headGradient = ctx.createLinearGradient(x, y, x + segSize, y + segSize);
      headGradient.addColorStop(0, theme.snakeHead);
      headGradient.addColorStop(1, theme.snakeBody1);
      ctx.fillStyle = headGradient;
      drawRoundedRect(ctx, x, y, segSize, segSize, radius);
      ctx.fill();

      // Eyes
      ctx.shadowBlur = 0;
      ctx.fillStyle = isDarkMode ? '#0f0c29' : '#fff';
      const headPos = snake[0];
      const nextSegment = snake[1] || { x: headPos.x - 1, y: headPos.y };
      const deltaX = headPos.x - nextSegment.x;
      const deltaY = headPos.y - nextSegment.y;
      const centerX = headPos.x * CELL_SIZE + CELL_SIZE / 2;
      const centerY = headPos.y * CELL_SIZE + CELL_SIZE / 2;
      const leftEyeX = centerX + deltaY * 4 + deltaX * 3;
      const leftEyeY = centerY - deltaX * 4 + deltaY * 3;
      const rightEyeX = centerX - deltaY * 4 + deltaX * 3;
      const rightEyeY = centerY + deltaX * 4 + deltaY * 3;
      ctx.beginPath();
      ctx.arc(leftEyeX, leftEyeY, 2.5, 0, Math.PI * 2);
      ctx.arc(rightEyeX, rightEyeY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDarkMode ? '#00ffa6' : '#0052d4';
      ctx.beginPath();
      ctx.arc(leftEyeX + deltaX, leftEyeY + deltaY, 1.2, 0, Math.PI * 2);
      ctx.arc(rightEyeX + deltaX, rightEyeY + deltaY, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Snake body with gradient
      const ratio = idx / (snake.length - 1);
      const bodyGradient = ctx.createLinearGradient(x, y, x + segSize, y + segSize);
      bodyGradient.addColorStop(0, theme.snakeBody1);
      bodyGradient.addColorStop(1, theme.snakeBody2);
      ctx.globalAlpha = 1 - ratio * 0.3;
      ctx.fillStyle = bodyGradient;
      drawRoundedRect(ctx, x, y, segSize, segSize, radius);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });

  // Pause overlay
  if (gameState === 'PAUSED') {
    ctx.fillStyle = theme.pauseOverlay;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = theme.uiText;
    ctx.font = `bold ${CELL_SIZE * 2}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', size / 2, size / 2);
  }
};

// ── Main Component ──────────────────────────────────────────────────────────
const SnakeGame: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? darkTheme : lightTheme;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const pendingDirection = useRef<Direction>(INITIAL_DIRECTION);
  const [food, setFood] = useState<Point>(() => getRandomFoodPosition(INITIAL_SNAKE));
  const [score, setScore] = useState(0);
  
  // Track high score per difficulty
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem(`snakeHighScore_${difficulty}`) || '0', 10);
    } catch {
      return 0;
    }
  });
  
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [level, setLevel] = useState(1);

  // Refs for game loop
  const snakeRef = useRef(snake);
  const directionRef = useRef(direction);
  const foodRef = useRef(food);
  const scoreRef = useRef(score);
  const gameStateRef = useRef(gameState);
  const difficultyRef = useRef(difficulty);

  snakeRef.current = snake;
  directionRef.current = direction;
  foodRef.current = food;
  scoreRef.current = score;
  gameStateRef.current = gameState;
  difficultyRef.current = difficulty;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Haptic feedback helper
  const triggerVibration = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Calculate speed dynamically based on score and selected difficulty
  const getGameSpeed = useCallback((currentScore: number, diff: Difficulty): number => {
    const settings = SPEED_MAP[diff];
    return Math.max(
      settings.min,
      settings.base - Math.floor(currentScore / 5) * settings.increment
    );
  }, []);

  // Handle canvas scaling for true responsiveness
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      // Subtracting padding/margins to ensure it fits the card
      const maxWidth = containerRef.current.clientWidth - 48; 
      // Ensure we leave room for UI on top and bottom
      const maxHeight = window.innerHeight - 250; 
      const scaleFactor = Math.min(maxWidth, maxHeight) / CANVAS_SIZE;
      setCanvasScale(Math.min(scaleFactor, 1.4)); // Cap max size
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Draw canvas whenever game state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawGame(ctx, snake, food, theme, isDarkMode, gameState);
  }, [snake, food, theme, isDarkMode, gameState]);

  // Update high score state when difficulty changes
  useEffect(() => {
    try {
      setHighScore(parseInt(localStorage.getItem(`snakeHighScore_${difficulty}`) || '0', 10));
    } catch {
      setHighScore(0);
    }
  }, [difficulty]);

  // Game logic tick
  const gameTick = useCallback(() => {
    if (gameStateRef.current !== 'RUNNING') return;

    const currentSnake = snakeRef.current;
    const currentDirection = pendingDirection.current;
    const head = currentSnake[0];

    let newHead: Point;
    switch (currentDirection) {
      case 'UP': newHead = { x: head.x, y: head.y - 1 }; break;
      case 'DOWN': newHead = { x: head.x, y: head.y + 1 }; break;
      case 'LEFT': newHead = { x: head.x - 1, y: head.y }; break;
      case 'RIGHT': newHead = { x: head.x + 1, y: head.y }; break;
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GRID_WIDTH || newHead.y < 0 || newHead.y >= GRID_HEIGHT) {
      triggerVibration([50, 50, 200]); // Death vibration
      setGameState('OVER');
      return;
    }

    // Self collision (ignore tail as it will move)
    if (currentSnake.slice(0, -1).some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      triggerVibration([50, 50, 200]);
      setGameState('OVER');
      return;
    }

    const hasEaten = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
    let newSnake: Point[];
    if (hasEaten) {
      newSnake = [newHead, ...currentSnake];
      triggerVibration(15); // Short tick for eating
    } else {
      newSnake = [newHead, ...currentSnake.slice(0, -1)];
    }

    if (hasEaten) {
      const newScore = scoreRef.current + 10;
      setScore(newScore);
      scoreRef.current = newScore;
      setFood(getRandomFoodPosition(newSnake));
      setLevel(Math.floor(newScore / 50) + 1);

      // We need to fetch the latest high score from state directly
      setHighScore((prevHigh) => {
        if (newScore > prevHigh) {
          try {
            localStorage.setItem(`snakeHighScore_${difficultyRef.current}`, String(newScore));
          } catch {}
          return newScore;
        }
        return prevHigh;
      });

      // Update interval speed
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(gameTick, getGameSpeed(newScore, difficultyRef.current));
    }

    setDirection(currentDirection);
    setSnake(newSnake);
  }, [getGameSpeed]);

  // Start new game
  const startGame = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const newSnake = INITIAL_SNAKE;
    setSnake(newSnake);
    setFood(getRandomFoodPosition(newSnake));
    setDirection(INITIAL_DIRECTION);
    pendingDirection.current = INITIAL_DIRECTION;
    setScore(0);
    setLevel(1);
    setGameState('RUNNING');
    intervalRef.current = setInterval(gameTick, SPEED_MAP[difficultyRef.current].base);
  }, [gameTick]);

  // Pause / Resume
  const togglePause = useCallback(() => {
    setGameState(prevState => {
      if (prevState === 'RUNNING') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return 'PAUSED';
      }
      if (prevState === 'PAUSED') {
        intervalRef.current = setInterval(gameTick, getGameSpeed(scoreRef.current, difficultyRef.current));
        return 'RUNNING';
      }
      return prevState;
    });
  }, [gameTick, getGameSpeed]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Restart interval when gameTick changes (speed updates)
  useEffect(() => {
    if (gameStateRef.current === 'RUNNING') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(gameTick, getGameSpeed(scoreRef.current, difficultyRef.current));
    }
  }, [gameTick, getGameSpeed]);

  // Keyboard controls
  useEffect(() => {
    const oppositeDirection: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    };
    const keyToDirection: Record<string, Direction> = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
      W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (gameStateRef.current === 'RUNNING' || gameStateRef.current === 'PAUSED') {
          togglePause();
        }
        return;
      }
      const newDirection = keyToDirection[e.key];
      if (newDirection && newDirection !== oppositeDirection[directionRef.current]) {
        e.preventDefault();
        pendingDirection.current = newDirection;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause]);

  // Touch swipe controls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

    const opposite: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    let newDirection: Direction;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      newDirection = deltaX > 0 ? 'RIGHT' : 'LEFT';
    } else {
      newDirection = deltaY > 0 ? 'DOWN' : 'UP';
    }
    if (newDirection !== opposite[directionRef.current]) {
      pendingDirection.current = newDirection;
    }
    touchStartRef.current = null;
  };

  // On-screen D-pad controls
  const sendDirection = (dir: Direction) => {
    const opposite: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (dir !== opposite[directionRef.current]) {
      pendingDirection.current = dir;
    }
  };

  const [pressedDir, setPressedDir] = useState<Direction | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDpadStart = (dir: Direction) => {
    setPressedDir(dir);
    sendDirection(dir);
    triggerVibration(5);
    holdIntervalRef.current = setInterval(() => sendDirection(dir), 100);
  };

  const handleDpadEnd = () => {
    setPressedDir(null);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  };

  // ── Styles ──────────────────────────────────────────────────────────────
  // We inject global styles here to remove body margins and prevent scrolling
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600&display=swap');
    
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden; /* Prevents bounce/scroll on mobile */
    }

    .snake-card {
      background: ${theme.uiBg};
      backdrop-filter: blur(20px);
      border-radius: 24px;
      border: 1.5px solid ${theme.border};
      padding: 24px;
      max-width: 520px;
      width: 100%;
      box-shadow: ${isDarkMode ? '0 0 60px rgba(0, 255, 135, 0.08), 0 20px 60px rgba(0, 0, 0, 0.6)' : '0 20px 60px rgba(0, 114, 255, 0.12), 0 4px 24px rgba(0, 0, 0, 0.07)'};
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      transition: all 0.3s ease;
    }

    /* Make it truly edge-to-edge on mobile */
    @media (max-width: 600px) {
      .snake-card {
        max-width: 100%;
        height: 100%;
        border-radius: 0;
        border: none;
        padding: 16px;
        justify-content: space-around;
      }
    }
  `;

  const styles = {
    wrapper: {
      position: 'fixed' as const,
      inset: 0, // Shorthand for top:0, right:0, bottom:0, left:0
      background: isDarkMode
        ? 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
        : 'linear-gradient(135deg, #e0f7fa, #f5f5f5, #ffffff)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Rajdhani', sans-serif",
      transition: 'background 0.5s',
    },
    title: {
      fontFamily: "'Orbitron', monospace",
      fontSize: 'clamp(20px, 5vw, 28px)',
      fontWeight: 900,
      letterSpacing: '0.15em',
      color: theme.uiAccent,
      margin: '0 0 4px 0',
      textShadow: isDarkMode ? `0 0 20px ${theme.uiAccent}88` : 'none',
    },
    scoreRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
      flexWrap: 'wrap' as const,
    },
    scoreBox: {
      background: theme.scoreBg,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '8px 16px',
      flex: 1,
      textAlign: 'center' as const,
      minWidth: '70px',
    },
    scoreLabel: {
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.12em',
      color: theme.uiSubtext,
      textTransform: 'uppercase' as const,
      display: 'block' as const,
    },
    scoreValue: {
      fontFamily: "'Orbitron', monospace",
      fontSize: 'clamp(16px, 4vw, 20px)',
      fontWeight: 700,
      color: theme.uiText,
      display: 'block' as const,
    },
    canvasContainer: {
      position: 'relative' as const,
      width: CANVAS_SIZE * canvasScale,
      height: CANVAS_SIZE * canvasScale,
      margin: '0 auto 16px',
      borderRadius: '16px',
      overflow: 'hidden' as const,
      boxShadow: isDarkMode
        ? `0 0 0 2px ${theme.border}, 0 0 40px rgba(0, 255, 135, 0.15)`
        : `0 0 0 2px ${theme.border}, 0 8px 32px rgba(0, 114, 255, 0.1)`,
      cursor: 'pointer',
      flexShrink: 0,
    },
    buttonBase: {
      border: 'none',
      borderRadius: '12px',
      fontFamily: "'Orbitron', monospace",
      fontWeight: 700,
      letterSpacing: '0.08em',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontSize: '13px',
    },
    primaryButton: {
      background: theme.buttonBg,
      color: theme.buttonText,
      padding: '12px 28px',
      boxShadow: isDarkMode ? `0 0 20px ${theme.snakeBody1}55` : '0 4px 16px rgba(0, 114, 255, 0.25)',
    },
    secondaryButton: {
      background: 'transparent',
      color: theme.uiAccent,
      border: `1.5px solid ${theme.uiAccent}`,
      padding: '10px 20px',
    },
    difficultyButton: (active: boolean) => ({
      background: active ? theme.uiAccent : 'transparent',
      color: active ? theme.buttonText : theme.uiSubtext,
      border: `1px solid ${active ? theme.uiAccent : theme.border}`,
      padding: '4px 10px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: "'Orbitron', monospace",
    }),
    modalOverlay: {
      position: 'absolute' as const,
      inset: 0,
      background: isDarkMode ? 'rgba(15, 12, 41, 0.92)' : 'rgba(224, 247, 250, 0.95)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      borderRadius: '16px',
      backdropFilter: 'blur(8px)',
    },
    dpad: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 52px)',
      gridTemplateRows: 'repeat(3, 52px)',
      gap: '6px',
      margin: '0 auto',
      width: 'fit-content',
      userSelect: 'none' as const,
    },
    dpadButton: (active: boolean) => ({
      width: 52,
      height: 52,
      borderRadius: '12px',
      border: `1.5px solid ${theme.uiAccent}55`,
      background: active ? `${theme.uiAccent}22` : theme.scoreBg,
      color: theme.uiAccent,
      fontSize: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.1s',
      WebkitTapHighlightColor: 'transparent',
    }),
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.wrapper}>
        <div className="snake-card">
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h1 style={styles.title}>SNAKE</h1>
              <p style={{ margin: 0, fontSize: '11px', color: theme.uiSubtext, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Level {level}
              </p>
            </div>
            <button
              style={{ ...styles.buttonBase, ...styles.secondaryButton, padding: '8px 14px', fontSize: '18px' }}
              onClick={() => setIsDarkMode(prev => !prev)}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>

          {/* Difficulty Selection (Hidden while running) */}
          {gameState === 'IDLE' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
              {(['CHILL', 'NORMAL', 'TURBO'] as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  style={styles.difficultyButton(difficulty === diff)}
                  onClick={() => setDifficulty(diff)}
                >
                  {diff}
                </button>
              ))}
            </div>
          )}

          {/* Score Row */}
          <div style={styles.scoreRow}>
            <div style={styles.scoreBox}>
              <span style={styles.scoreLabel}>Score</span>
              <span style={styles.scoreValue}>{score}</span>
            </div>
            <div style={styles.scoreBox}>
              <span style={styles.scoreLabel}>Best ({difficulty.charAt(0)})</span>
              <span style={{ ...styles.scoreValue, color: theme.uiAccent }}>{highScore}</span>
            </div>
            <div style={styles.scoreBox}>
              <span style={styles.scoreLabel}>Speed</span>
              <span style={styles.scoreValue}>
                {Math.round((SPEED_MAP[difficulty].base - getGameSpeed(score, difficulty)) / SPEED_MAP[difficulty].increment + 1)}x
              </span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div
            style={styles.canvasContainer}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              style={{ display: 'block', width: CANVAS_SIZE * canvasScale, height: CANVAS_SIZE * canvasScale }}
            />
            
            {gameState === 'IDLE' && (
              <div style={styles.modalOverlay}>
                <p style={{ fontFamily: "'Orbitron', monospace", fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 900, color: theme.uiAccent, margin: 0, textShadow: isDarkMode ? `0 0 20px ${theme.uiAccent}` : 'none' }}>
                  READY?
                </p>
                <p style={{ color: theme.uiSubtext, fontSize: '12px', margin: 0, letterSpacing: '0.05em' }}>Mode: {difficulty}</p>
                <button style={{ ...styles.buttonBase, ...styles.primaryButton, marginTop: '12px' }} onClick={startGame}>
                  ▶ START GAME
                </button>
              </div>
            )}
            
            {gameState === 'OVER' && (
              <div style={styles.modalOverlay}>
                <p style={{ fontFamily: "'Orbitron', monospace", fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 900, color: theme.food1, margin: 0, textShadow: isDarkMode ? `0 0 20px ${theme.food1}` : 'none' }}>
                  GAME OVER
                </p>
                <p style={{ color: theme.uiText, fontSize: '28px', fontFamily: "'Orbitron', monospace", fontWeight: 700, margin: '4px 0' }}>
                  {score} <span style={{ fontSize: '14px', color: theme.uiSubtext }}>pts</span>
                </p>
                {score >= highScore && score > 0 && (
                  <p style={{ color: theme.uiAccent, fontSize: '13px', fontWeight: 600, margin: 0, letterSpacing: '0.08em' }}>
                    🏆 NEW {difficulty} RECORD!
                  </p>
                )}
                <button style={{ ...styles.buttonBase, ...styles.primaryButton, marginTop: '8px' }} onClick={startGame}>
                  ↺ PLAY AGAIN
                </button>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {gameState === 'IDLE' ? (
              <></> // Button is already in modal
            ) : gameState === 'OVER' ? (
              <button style={{ ...styles.buttonBase, ...styles.primaryButton }} onClick={startGame}>
                ↺ Restart
              </button>
            ) : (
              <>
                <button style={{ ...styles.buttonBase, ...styles.primaryButton }} onClick={togglePause}>
                  {gameState === 'PAUSED' ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button style={{ ...styles.buttonBase, ...styles.secondaryButton }} onClick={startGame}>
                  ↺ Restart
                </button>
              </>
            )}
          </div>

          {/* D-Pad */}
          <div style={styles.dpad}>
            <div />
            <div
              style={styles.dpadButton(pressedDir === 'UP')}
              onMouseDown={() => handleDpadStart('UP')}
              onMouseUp={handleDpadEnd}
              onMouseLeave={handleDpadEnd}
              onTouchStart={(e) => { e.preventDefault(); handleDpadStart('UP'); }}
              onTouchEnd={handleDpadEnd}
            >▲</div>
            <div />
            <div
              style={styles.dpadButton(pressedDir === 'LEFT')}
              onMouseDown={() => handleDpadStart('LEFT')}
              onMouseUp={handleDpadEnd}
              onMouseLeave={handleDpadEnd}
              onTouchStart={(e) => { e.preventDefault(); handleDpadStart('LEFT'); }}
              onTouchEnd={handleDpadEnd}
            >◀</div>
            <div style={{ ...styles.dpadButton(false), opacity: 0.5 }}>●</div>
            <div
              style={styles.dpadButton(pressedDir === 'RIGHT')}
              onMouseDown={() => handleDpadStart('RIGHT')}
              onMouseUp={handleDpadEnd}
              onMouseLeave={handleDpadEnd}
              onTouchStart={(e) => { e.preventDefault(); handleDpadStart('RIGHT'); }}
              onTouchEnd={handleDpadEnd}
            >▶</div>
            <div />
            <div
              style={styles.dpadButton(pressedDir === 'DOWN')}
              onMouseDown={() => handleDpadStart('DOWN')}
              onMouseUp={handleDpadEnd}
              onMouseLeave={handleDpadEnd}
              onTouchStart={(e) => { e.preventDefault(); handleDpadStart('DOWN'); }}
              onTouchEnd={handleDpadEnd}
            >▼</div>
            <div />
          </div>
        </div>
      </div>
    </>
  );
};

export default SnakeGame;