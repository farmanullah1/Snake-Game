import React, { useEffect, useRef, useState, useCallback } from 'react';
import './SnakeGame.css';

// ==================== TYPES ====================
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type GameState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type PowerUpType = 'GHOST' | 'SHIELD' | 'SLOW' | 'DOUBLE';

interface Food {
  position: Position;
  type: 'NORMAL' | 'BONUS';
  points: number;
}

interface PowerUp {
  position: Position;
  type: PowerUpType;
  expiresAt: number;
}

interface GameRefData {
  snake: Position[];
  direction: Direction;
  nextDirection: Direction;
  food: Food | null;
  bonusFood: Food | null;
  powerUp: PowerUp | null;
  score: number;
  level: number;
  comboStreak: number;
  lastFoodTime: number;
  ghostMode: boolean;
  shieldActive: boolean;
  doubleScore: boolean;
  slowMotion: boolean;
  wallCollision: boolean;
  isMobile: boolean;
}

// ==================== CONSTANTS ====================
const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;
const MIN_SPEED = 60;
const COMBO_WINDOW = 3000; // ms
const BONUS_FOOD_CHANCE = 0.3;
const POWER_UP_CHANCE = 0.15;
const SWIPE_THRESHOLD_BASE = 20;

const DIRECTIONS: Record<Direction, Position> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const POWER_UP_COLORS: Record<PowerUpType, string> = {
  GHOST: '#00ffff',
  SHIELD: '#ffd700',
  SLOW: '#ff6b6b',
  DOUBLE: '#4ecdc4',
};

// ==================== AUDIO SYSTEM ====================
class AudioController {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  playTone(frequency: number, duration: number, type: OscillatorType = 'sine', endFreq?: number) {
    if (this.muted || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration / 1000);
    }
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration / 1000);
    
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration / 1000);
  }

  playEat() {
    this.playTone(440, 80, 'sine', 880);
  }

  playBonus() {
    this.playTone(523, 60, 'sine', 659);
    setTimeout(() => this.playTone(659, 60, 'sine', 784), 80);
  }

  playPowerUp() {
    [523, 659, 784].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 100, 'sine'), i * 100);
    });
  }

  playGameOver() {
    this.playTone(440, 300, 'triangle', 220);
  }

  playDirection() {
    this.playTone(1200, 20, 'square');
  }

  playLevelUp() {
    [440, 554, 659, 880].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 80, 'sine'), i * 80);
    });
  }
}

const audioController = new AudioController();

// ==================== UTILS ====================
const getRandomPosition = (cols: number, rows: number, excludePositions: Position[]): Position => {
  let position: Position;
  let attempts = 0;
  do {
    position = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    };
    attempts++;
  } while (
    attempts < 100 &&
    excludePositions.some((p) => p.x === position.x && p.y === position.y)
  );
  return position;
};

const getHighScore = (): number => {
  try {
    return parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    localStorage.setItem('snakeHighScore', score.toString());
  } catch {}
};

// ==================== MAIN COMPONENT ====================
const SnakeGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mutable game state (no re-renders)
  const gameRef = useRef<GameRefData>({
    snake: [{ x: 10, y: 10 }],
    direction: 'RIGHT',
    nextDirection: 'RIGHT',
    food: null,
    bonusFood: null,
    powerUp: null,
    score: 0,
    level: 1,
    comboStreak: 0,
    lastFoodTime: 0,
    ghostMode: false,
    shieldActive: false,
    doubleScore: false,
    slowMotion: false,
    wallCollision: true,
    isMobile: false,
  });

  // UI state (triggers re-renders only when needed)
  const [uiState, setUiState] = useState({
    score: 0,
    highScore: getHighScore(),
    level: 1,
    length: 1,
    comboStreak: 0,
    activePowerUp: null as PowerUpType | null,
    gameState: 'IDLE' as GameState,
    darkMode: true,
    muted: false,
    showSettings: false,
    wallCollision: true,
  });

  // Animation loop refs
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const tickRateRef = useRef<number>(INITIAL_SPEED);
  const dprRef = useRef<number>(1);

  // Touch/swipe refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const boardSizeRef = useRef<number>(400);
  const colsRef = useRef<number>(20);
  const rowsRef = useRef<number>(20);

  // Achievement toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    const checkMobile = () => {
      gameRef.current.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleDPRChange = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      resizeCanvas();
    };
    handleDPRChange();
    const mediaQuery = window.matchMedia(`(resolution: ${dprRef.current}dppx)`);
    mediaQuery.addEventListener?.('change', handleDPRChange);
    return () => mediaQuery.removeEventListener?.('change', handleDPRChange);
  }, []);

  // ==================== CANVAS RESIZE ====================
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate optimal board size (200px to 600px range)
    const minDimension = Math.min(containerWidth, containerHeight);
    const maxBoardSize = Math.min(600, Math.max(200, minDimension - 20));
    
    // Floor to nearest multiple of GRID_SIZE for pixel-perfect rendering
    const boardSize = Math.floor(maxBoardSize / GRID_SIZE) * GRID_SIZE;
    boardSizeRef.current = boardSize;
    
    // Calculate grid dimensions
    const cols = Math.floor(boardSize / GRID_SIZE);
    const rows = Math.floor(boardSize / GRID_SIZE);
    colsRef.current = cols;
    rowsRef.current = rows;

    const dpr = dprRef.current;
    canvas.style.width = `${boardSize}px`;
    canvas.style.height = `${boardSize}px`;
    canvas.width = Math.floor(boardSize * dpr);
    canvas.height = Math.floor(boardSize * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // ==================== GAME FUNCTIONS ====================
  const spawnFood = useCallback(() => {
    const snake = gameRef.current.snake;
    const positions = [...snake];
    if (gameRef.current.food) {
      positions.push(gameRef.current.food.position);
    }
    if (gameRef.current.bonusFood) {
      positions.push(gameRef.current.bonusFood.position);
    }
    if (gameRef.current.powerUp) {
      positions.push(gameRef.current.powerUp.position);
    }

    const position = getRandomPosition(colsRef.current, rowsRef.current, positions);
    const isBonus = Math.random() < BONUS_FOOD_CHANCE;
    
    gameRef.current.food = {
      position,
      type: isBonus ? 'BONUS' : 'NORMAL',
      points: isBonus ? 20 : 10,
    };
  }, []);

  const spawnBonusFood = useCallback(() => {
    if (gameRef.current.bonusFood) return;
    const snake = gameRef.current.snake;
    const positions = [...snake];
    if (gameRef.current.food) {
      positions.push(gameRef.current.food.position);
    }
    const position = getRandomPosition(colsRef.current, rowsRef.current, positions);
    gameRef.current.bonusFood = {
      position,
      type: 'BONUS',
      points: 30,
    };
    // Bonus food disappears after 10 seconds
    setTimeout(() => {
      if (gameRef.current.bonusFood?.position === position) {
        gameRef.current.bonusFood = null;
      }
    }, 10000);
  }, []);

  const spawnPowerUp = useCallback(() => {
    if (gameRef.current.powerUp) return;
    const types: PowerUpType[] = ['GHOST', 'SHIELD', 'SLOW', 'DOUBLE'];
    const type = types[Math.floor(Math.random() * types.length)];
    const snake = gameRef.current.snake;
    const positions = [...snake];
    if (gameRef.current.food) {
      positions.push(gameRef.current.food.position);
    }
    if (gameRef.current.bonusFood) {
      positions.push(gameRef.current.bonusFood.position);
    }
    const position = getRandomPosition(colsRef.current, rowsRef.current, positions);
    gameRef.current.powerUp = {
      position,
      type,
      expiresAt: Date.now() + 8000,
    };
  }, []);

  const resetGame = useCallback(() => {
    const startX = Math.floor(colsRef.current / 2);
    const startY = Math.floor(rowsRef.current / 2);
    
    gameRef.current = {
      ...gameRef.current,
      snake: [{ x: startX, y: startY }],
      direction: 'RIGHT',
      nextDirection: 'RIGHT',
      food: null,
      bonusFood: null,
      powerUp: null,
      score: 0,
      level: 1,
      comboStreak: 0,
      lastFoodTime: 0,
      ghostMode: false,
      shieldActive: false,
      doubleScore: false,
      slowMotion: false,
    };
    
    tickRateRef.current = INITIAL_SPEED;
    spawnFood();
  }, [spawnFood]);

  const startGame = useCallback(() => {
    audioController.init();
    resetGame();
    setUiState(prev => ({ ...prev, gameState: 'PLAYING' }));
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;
  }, [resetGame]);

  const pauseGame = useCallback(() => {
    setUiState(prev => ({ 
      ...prev, 
      gameState: prev.gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED' 
    }));
  }, []);

  const gameOver = useCallback(() => {
    audioController.playGameOver();
    
    const currentScore = gameRef.current.score;
    const highScore = getHighScore();
    
    if (currentScore > highScore) {
      saveHighScore(currentScore);
      setUiState(prev => ({ ...prev, highScore: currentScore }));
      showToast('🏆 New High Score!');
    }
    
    setUiState(prev => ({ ...prev, gameState: 'GAME_OVER' }));
  }, []);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
  };

  const changeDirection = useCallback((newDirection: Direction) => {
    const currentDirection = gameRef.current.direction;
    
    // Prevent reverse direction
    if (OPPOSITE_DIRECTIONS[newDirection] === currentDirection) {
      return;
    }
    
    // Prevent duplicate direction changes in same tick
    if (newDirection === gameRef.current.nextDirection) {
      return;
    }
    
    gameRef.current.nextDirection = newDirection;
    audioController.playDirection();
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  // ==================== GAME TICK ====================
  const tick = useCallback(() => {
    const game = gameRef.current;
    
    // Update direction
    game.direction = game.nextDirection;
    
    // Calculate new head position
    const delta = DIRECTIONS[game.direction];
    const head = game.snake[0];
    const newHead = {
      x: head.x + delta.x,
      y: head.y + delta.y,
    };

    // Wall collision handling
    if (game.wallCollision) {
      if (
        newHead.x < 0 ||
        newHead.x >= colsRef.current ||
        newHead.y < 0 ||
        newHead.y >= rowsRef.current
      ) {
        if (!game.ghostMode && !game.shieldActive) {
          gameOver();
          return;
        }
      }
    } else {
      // Wrap around
      if (newHead.x < 0) newHead.x = colsRef.current - 1;
      if (newHead.x >= colsRef.current) newHead.x = 0;
      if (newHead.y < 0) newHead.y = rowsRef.current - 1;
      if (newHead.y >= rowsRef.current) newHead.y = 0;
    }

    // Self collision
    const hitSelf = game.snake.some(
      (segment, index) => index < game.snake.length - 1 && 
      segment.x === newHead.x && 
      segment.y === newHead.y
    );
    
    if (hitSelf && !game.ghostMode && !game.shieldActive) {
      gameOver();
      return;
    }

    // Move snake
    game.snake.unshift(newHead);

    // Check food collision
    let ateFood = false;
    let points = 0;

    if (game.food && newHead.x === game.food.position.x && newHead.y === game.food.position.y) {
      ateFood = true;
      points = game.food.points;
      game.food = null;
      spawnFood();
      
      // Check combo
      const now = Date.now();
      if (now - game.lastFoodTime < COMBO_WINDOW) {
        game.comboStreak++;
        if (game.comboStreak >= 3) {
          points *= game.comboStreak;
          showToast(`🔥 ${game.comboStreak}x Combo!`);
        }
      } else {
        game.comboStreak = 1;
      }
      game.lastFoodTime = now;

      // Spawn bonus food occasionally
      if (Math.random() < 0.3 && !game.bonusFood) {
        spawnBonusFood();
      }

      // Spawn power-up occasionally
      if (Math.random() < POWER_UP_CHANCE && !game.powerUp) {
        spawnPowerUp();
      }

      audioController.playEat();
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }

    if (game.bonusFood && newHead.x === game.bonusFood.position.x && newHead.y === game.bonusFood.position.y) {
      ateFood = true;
      points = game.bonusFood.points;
      game.bonusFood = null;
      audioController.playBonus();
      showToast('✨ Bonus Food!');
    }

    // Check power-up collision
    if (game.powerUp && newHead.x === game.powerUp.position.x && newHead.y === game.powerUp.position.y) {
      const powerUp = game.powerUp;
      game.powerUp = null;
      
      switch (powerUp.type) {
        case 'GHOST':
          game.ghostMode = true;
          setTimeout(() => { game.ghostMode = false; }, 5000);
          break;
        case 'SHIELD':
          game.shieldActive = true;
          setTimeout(() => { game.shieldActive = false; }, 5000);
          break;
        case 'SLOW':
          game.slowMotion = true;
          setTimeout(() => { game.slowMotion = false; }, 5000);
          break;
        case 'DOUBLE':
          game.doubleScore = true;
          setTimeout(() => { game.doubleScore = false; }, 5000);
          break;
      }
      
      audioController.playPowerUp();
      showToast(`⚡ ${powerUp.type} Power-Up!`);
    }

    // Remove tail if didn't eat
    if (!ateFood) {
      game.snake.pop();
    } else {
      // Apply points
      if (game.doubleScore) {
        points *= 2;
      }
      game.score += points;

      // Level up every 100 points
      const newLevel = Math.floor(game.score / 100) + 1;
      if (newLevel > game.level) {
        game.level = newLevel;
        tickRateRef.current = Math.max(MIN_SPEED, INITIAL_SPEED - (game.level - 1) * SPEED_INCREMENT);
        audioController.playLevelUp();
        showToast(`🎉 Level ${game.level}!`);
      }
    }

    // Expire power-ups
    if (game.powerUp && Date.now() > game.powerUp.expiresAt) {
      game.powerUp = null;
    }
  }, [spawnFood, spawnBonusFood, spawnPowerUp, gameOver]);

  // ==================== SYNC UI ====================
  const syncUI = useCallback(() => {
    const game = gameRef.current;
    
    setUiState(prev => {
      const updates: Partial<typeof prev> = {};
      
      if (prev.score !== game.score) updates.score = game.score;
      if (prev.level !== game.level) updates.level = game.level;
      if (prev.length !== game.snake.length) updates.length = game.snake.length;
      if (prev.comboStreak !== game.comboStreak) updates.comboStreak = game.comboStreak;
      
      const activePowerUp = game.ghostMode ? 'GHOST' : 
                           game.shieldActive ? 'SHIELD' : 
                           game.slowMotion ? 'SLOW' : 
                           game.doubleScore ? 'DOUBLE' : null;
      if (prev.activePowerUp !== activePowerUp) updates.activePowerUp = activePowerUp;

      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, []);

  // ==================== DRAW CANVAS ====================
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const game = gameRef.current;
    const boardSize = boardSizeRef.current;
    const cellSize = boardSize / GRID_SIZE;

    // Clear canvas
    ctx.clearRect(0, 0, boardSize, boardSize);

    // Draw background grid
    const isDark = uiState.darkMode;
    ctx.fillStyle = isDark ? 'rgba(6, 6, 20, 0.95)' : 'rgba(245, 249, 255, 0.95)';
    ctx.fillRect(0, 0, boardSize, boardSize);

    // Draw subtle grid
    ctx.strokeStyle = isDark ? 'rgba(100, 100, 150, 0.1)' : 'rgba(100, 100, 150, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, boardSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(boardSize, pos);
      ctx.stroke();
    }

    // Draw food
    if (game.food) {
      const { x, y } = game.food.position;
      const centerX = x * cellSize + cellSize / 2;
      const centerY = y * cellSize + cellSize / 2;
      const radius = cellSize * 0.4;

      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      if (game.food.type === 'BONUS') {
        gradient.addColorStop(0, '#ffd700');
        gradient.addColorStop(1, '#ff8c00');
      } else {
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a5a');
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect
      ctx.shadowColor = game.food.type === 'BONUS' ? '#ffd700' : '#ff6b6b';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw bonus food
    if (game.bonusFood) {
      const { x, y } = game.bonusFood.position;
      const centerX = x * cellSize + cellSize / 2;
      const centerY = y * cellSize + cellSize / 2;
      const time = Date.now() / 200;
      const pulse = Math.sin(time) * 0.1 + 0.4;

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      
      // Star shape
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = cellSize * (i % 2 === 0 ? pulse : pulse * 0.5);
        const px = centerX + Math.cos(angle) * r;
        const py = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw power-up
    if (game.powerUp) {
      const { position, type } = game.powerUp;
      const { x, y } = position;
      const centerX = x * cellSize + cellSize / 2;
      const centerY = y * cellSize + cellSize / 2;
      const time = Date.now() / 150;
      const scale = Math.sin(time) * 0.15 + 0.85;

      ctx.fillStyle = POWER_UP_COLORS[type];
      ctx.beginPath();
      ctx.arc(centerX, centerY, cellSize * 0.4 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Inner symbol
      ctx.fillStyle = isDark ? '#000' : '#fff';
      ctx.font = `bold ${cellSize * 0.5}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const symbol = type === 'GHOST' ? '👻' : type === 'SHIELD' ? '🛡️' : type === 'SLOW' ? '🐌' : '2x';
      ctx.fillText(symbol, centerX, centerY);

      ctx.shadowColor = POWER_UP_COLORS[type];
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw snake
    game.snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 2;

      // Gradient color based on position
      const hue = (index * 5 + Date.now() / 50) % 360;
      const saturation = game.ghostMode ? 80 : 70;
      const lightness = game.shieldActive ? 60 : 50;
      
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      // Rounded rectangle
      const radius = cellSize * 0.3;
      const rectX = x + padding;
      const rectY = y + padding;
      const rectW = cellSize - padding * 2;
      const rectH = cellSize - padding * 2;

      ctx.beginPath();
      ctx.roundRect(rectX, rectY, rectW, rectH, radius);
      ctx.fill();

      // Eyes on head
      if (index === 0) {
        ctx.fillStyle = isDark ? '#fff' : '#000';
        const eyeSize = cellSize * 0.15;
        const eyeOffset = cellSize * 0.25;
        
        let eye1X, eye1Y, eye2X, eye2Y;
        const center = cellSize / 2;
        
        switch (game.direction) {
          case 'UP':
            eye1X = center - eyeOffset; eye1Y = center - eyeOffset;
            eye2X = center + eyeOffset; eye2Y = center - eyeOffset;
            break;
          case 'DOWN':
            eye1X = center - eyeOffset; eye1Y = center + eyeOffset;
            eye2X = center + eyeOffset; eye2Y = center + eyeOffset;
            break;
          case 'LEFT':
            eye1X = center - eyeOffset; eye1Y = center - eyeOffset;
            eye2X = center - eyeOffset; eye2Y = center + eyeOffset;
            break;
          case 'RIGHT':
            eye1X = center + eyeOffset; eye1Y = center - eyeOffset;
            eye2X = center + eyeOffset; eye2Y = center + eyeOffset;
            break;
        }
        
        ctx.beginPath();
        ctx.arc(eye1X + x, eye1Y + y, eyeSize, 0, Math.PI * 2);
        ctx.arc(eye2X + x, eye2Y + y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glow for head
      if (index === 0) {
        ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Canvas border glow when playing
    if (uiState.gameState === 'PLAYING') {
      ctx.strokeStyle = isDark ? 'rgba(0, 255, 255, 0.5)' : 'rgba(0, 100, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, boardSize - 3, boardSize - 3);
    }
  }, [uiState.darkMode, uiState.gameState]);

  // ==================== ANIMATION LOOP ====================
  useEffect(() => {
    const animate = (currentTime: number) => {
      // Skip if tab is hidden
      if (document.hidden) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      accumulatorRef.current += deltaTime;

      // Handle slow motion
      const effectiveTickRate = gameRef.current.slowMotion ? tickRateRef.current * 1.5 : tickRateRef.current;

      // Process game ticks
      while (accumulatorRef.current >= effectiveTickRate) {
        if (uiState.gameState === 'PLAYING') {
          tick();
          syncUI();
        }
        accumulatorRef.current -= effectiveTickRate;
      }

      // Draw every frame
      drawCanvas();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [tick, syncUI, drawCanvas, uiState.gameState]);

  // ==================== INPUT HANDLERS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (uiState.gameState === 'IDLE' || uiState.gameState === 'GAME_OVER') {
        if (e.key === 'Enter' || e.key === ' ') {
          startGame();
          return;
        }
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (uiState.gameState === 'PLAYING' || uiState.gameState === 'PAUSED') {
          pauseGame();
          return;
        }
      }

      if (uiState.gameState !== 'PLAYING') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState.gameState, startGame, pauseGame, changeDirection]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || uiState.gameState !== 'PLAYING') return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    const swipeThreshold = Math.max(SWIPE_THRESHOLD_BASE, boardSizeRef.current * 0.07);
    
    if (Math.abs(deltaX) < swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
      touchStartRef.current = null;
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      changeDirection(deltaX > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDirection(deltaY > 0 ? 'DOWN' : 'UP');
    }

    touchStartRef.current = null;
  }, [uiState.gameState, changeDirection]);

  // D-pad handler
  const handleDPadPress = useCallback((direction: Direction) => {
    if (uiState.gameState === 'PLAYING') {
      changeDirection(direction);
    }
  }, [uiState.gameState, changeDirection]);

  // Toggle settings
  const toggleSettings = useCallback(() => {
    setUiState(prev => ({ ...prev, showSettings: !prev.showSettings }));
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setUiState(prev => ({ ...prev, darkMode: !prev.darkMode }));
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !uiState.muted;
    audioController.setMuted(newMuted);
    setUiState(prev => ({ ...prev, muted: newMuted }));
  }, [uiState.muted]);

  // Toggle wall collision
  const toggleWallCollision = useCallback(() => {
    gameRef.current.wallCollision = !gameRef.current.wallCollision;
    setUiState(prev => ({ ...prev, wallCollision: !prev.wallCollision }));
  }, []);

  // ==================== RENDER ====================
  const isDark = uiState.darkMode;

  return (
    <div className={`snake-game ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="game-header">
        <div className="header-left">
          <h1>🐍 Snake</h1>
          <span className="mode-badge">{gameRef.current.wallCollision ? 'Classic' : 'Wrap'}</span>
        </div>
        <div className="header-right">
          <button 
            className="icon-btn" 
            onClick={toggleDarkMode}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button 
            className="icon-btn" 
            onClick={toggleMute}
            aria-label={uiState.muted ? 'Unmute' : 'Mute'}
          >
            {uiState.muted ? '🔇' : '🔊'}
          </button>
          <button 
            className="icon-btn" 
            onClick={toggleSettings}
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Stats Panel */}
      <div className="stats-panel glass-panel">
        <div className="stat-item">
          <span className="stat-label">Score</span>
          <span className="stat-value">{uiState.score}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Best</span>
          <span className="stat-value">{uiState.highScore}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Level</span>
          <span className="stat-value">{uiState.level}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Length</span>
          <span className="stat-value">{uiState.length}</span>
        </div>
        {uiState.comboStreak >= 2 && (
          <div className="stat-item combo">
            <span className="stat-label">Combo</span>
            <span className="stat-value">x{uiState.comboStreak}</span>
          </div>
        )}
        {uiState.activePowerUp && (
          <div className="stat-item powerup">
            <span className="stat-label">Power</span>
            <span className="stat-value">{uiState.activePowerUp}</span>
          </div>
        )}
      </div>

      {/* Game Container */}
      <div className="game-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="game-canvas"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {/* Overlay for IDLE / PAUSED / GAME_OVER */}
        {uiState.gameState !== 'PLAYING' && (
          <div className="overlay glass-panel">
            {uiState.gameState === 'IDLE' && (
              <>
                <h2 className="overlay-title">Ready to Play?</h2>
                <p className="overlay-subtitle">Use arrow keys or swipe to move</p>
                <button className="primary-btn" onClick={startGame}>
                  Start Game
                </button>
              </>
            )}
            {uiState.gameState === 'PAUSED' && (
              <>
                <h2 className="overlay-title">Paused</h2>
                <button className="primary-btn" onClick={pauseGame}>
                  Resume
                </button>
                <button className="secondary-btn" onClick={startGame}>
                  Restart
                </button>
              </>
            )}
            {uiState.gameState === 'GAME_OVER' && (
              <>
                <h2 className="overlay-title game-over">Game Over</h2>
                <div className="game-over-stats">
                  <div className="stat-row">
                    <span>Final Score:</span>
                    <span className="highlight">{uiState.score}</span>
                  </div>
                  <div className="stat-row">
                    <span>Level Reached:</span>
                    <span>{uiState.level}</span>
                  </div>
                  <div className="stat-row">
                    <span>Snake Length:</span>
                    <span>{uiState.length}</span>
                  </div>
                  {uiState.score >= uiState.highScore && uiState.score > 0 && (
                    <div className="stat-row highlight">
                      <span>🏆 New High Score!</span>
                    </div>
                  )}
                </div>
                <button className="primary-btn" onClick={startGame}>
                  Play Again
                </button>
              </>
            )}
          </div>
        )}

        {/* Toast Notification */}
        {toast.visible && (
          <div className="toast">
            {toast.message}
          </div>
        )}
      </div>

      {/* D-Pad Controls (Mobile) */}
      <div className="dpad-container">
        <div className="dpad">
          <button
            className="dpad-btn"
            onClick={() => handleDPadPress('UP')}
            aria-label="Move up"
          >
            ▲
          </button>
          <div className="dpad-row">
            <button
              className="dpad-btn"
              onClick={() => handleDPadPress('LEFT')}
              aria-label="Move left"
            >
              ◀
            </button>
            <div className="dpad-center" />
            <button
              className="dpad-btn"
              onClick={() => handleDPadPress('RIGHT')}
              aria-label="Move right"
            >
              ▶
            </button>
          </div>
          <button
            className="dpad-btn"
            onClick={() => handleDPadPress('DOWN')}
            aria-label="Move down"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {uiState.showSettings && (
        <div className="modal-overlay" onClick={toggleSettings}>
          <div className="settings-modal glass-panel" onClick={e => e.stopPropagation()}>
            <h3>Settings</h3>
            <div className="setting-row">
              <span>Dark Mode</span>
              <button 
                className={`toggle-btn ${isDark ? 'active' : ''}`}
                onClick={toggleDarkMode}
              >
                {isDark ? 'On' : 'Off'}
              </button>
            </div>
            <div className="setting-row">
              <span>Sound</span>
              <button 
                className={`toggle-btn ${!uiState.muted ? 'active' : ''}`}
                onClick={toggleMute}
              >
                {!uiState.muted ? 'On' : 'Off'}
              </button>
            </div>
            <div className="setting-row">
              <span>Wall Collision</span>
              <button 
                className={`toggle-btn ${gameRef.current.wallCollision ? 'active' : ''}`}
                onClick={toggleWallCollision}
              >
                {gameRef.current.wallCollision ? 'Classic' : 'Wrap'}
              </button>
            </div>
            <button className="close-btn" onClick={toggleSettings}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Instructions Footer */}
      <footer className="game-footer">
        <p>Desktop: Arrow keys / WASD • Mobile: Swipe or D-Pad • P/Esc: Pause</p>
      </footer>
    </div>
  );
};

export default SnakeGame;
