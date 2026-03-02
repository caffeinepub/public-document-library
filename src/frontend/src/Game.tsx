import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameState = "start" | "playing" | "gameover";

interface Car {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  glowColor: string;
  lane: number;
  speed?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  radius: number;
  color: string;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 650;
const ROAD_LEFT = 50;
const ROAD_WIDTH = 300;
const LANE_COUNT = 3;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

const PLAYER_WIDTH = 38;
const PLAYER_HEIGHT = 64;
const OPPONENT_WIDTH = 36;
const OPPONENT_HEIGHT = 62;

const OPPONENT_COLORS = [
  { body: "#FF4444", glow: "#FF000080" },
  { body: "#FF8C00", glow: "#FF8C0080" },
  { body: "#9B59B6", glow: "#9B59B680" },
  { body: "#2ECC71", glow: "#2ECC7180" },
  { body: "#E74C3C", glow: "#E74C3C80" },
  { body: "#F39C12", glow: "#F39C1280" },
];

const INITIAL_SPEED = 200; // px/s
const SPEED_INCREMENT = 15; // px/s per 5 seconds
const SPEED_MAX = 700;
const PLAYER_H_SPEED = 280; // px/s
const OPPONENT_SPAWN_INTERVAL_BASE = 1800; // ms
const INVINCIBILITY_DURATION = 2000; // ms after hit

// ─── Helper: Get lane center X ───────────────────────────────────────────────

function getLaneCenterX(lane: number): number {
  return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

// ─── Helper: Draw car ────────────────────────────────────────────────────────

function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Car,
  isPlayer: boolean,
  alpha = 1,
) {
  const { x, y, width, height, color, glowColor } = car;
  const cx = x - width / 2;
  const cy = y - height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Glow effect
  ctx.shadowBlur = isPlayer ? 24 : 16;
  ctx.shadowColor = glowColor;

  // Body
  ctx.beginPath();
  ctx.roundRect(cx + 4, cy, width - 8, height, [4, 4, 4, 4]);
  ctx.fillStyle = color;
  ctx.fill();

  // Windshield
  ctx.beginPath();
  ctx.roundRect(cx + 7, cy + 8, width - 14, 14, 3);
  ctx.fillStyle = isPlayer ? "rgba(100,200,255,0.8)" : "rgba(80,80,120,0.7)";
  ctx.fill();

  // Rear window
  ctx.beginPath();
  ctx.roundRect(cx + 7, cy + height - 22, width - 14, 12, 3);
  ctx.fillStyle = isPlayer ? "rgba(100,200,255,0.6)" : "rgba(60,60,100,0.6)";
  ctx.fill();

  // Headlights (player at bottom = rear, opponent at top = headlights)
  ctx.shadowBlur = 15;
  ctx.shadowColor = isPlayer ? "#FFFF88" : "#FFE066";

  if (isPlayer) {
    // Taillights at top
    ctx.fillStyle = "#FF3333";
    ctx.shadowColor = "#FF333380";
    ctx.beginPath();
    ctx.roundRect(cx + 5, cy + 4, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + width - 15, cy + 4, 10, 6, 2);
    ctx.fill();

    // Headlights at bottom (since player faces down road direction from player perspective)
    ctx.fillStyle = "#FFFFCC";
    ctx.shadowColor = "#FFFF8880";
    ctx.beginPath();
    ctx.roundRect(cx + 5, cy + height - 10, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + width - 15, cy + height - 10, 10, 6, 2);
    ctx.fill();
  } else {
    // Headlights at bottom for opponents (coming towards player)
    ctx.fillStyle = "#FFFF88";
    ctx.shadowColor = "#FFFF8880";
    ctx.beginPath();
    ctx.roundRect(cx + 5, cy + height - 10, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + width - 15, cy + height - 10, 10, 6, 2);
    ctx.fill();

    // Taillights at top
    ctx.fillStyle = "#FF3333";
    ctx.shadowColor = "#FF333380";
    ctx.beginPath();
    ctx.roundRect(cx + 5, cy + 4, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + width - 15, cy + 4, 10, 6, 2);
    ctx.fill();
  }

  // Wheels
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1a1a2e";
  // Left wheels
  ctx.beginPath();
  ctx.roundRect(cx - 3, cy + 12, 7, 14, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 3, cy + height - 26, 7, 14, 2);
  ctx.fill();
  // Right wheels
  ctx.beginPath();
  ctx.roundRect(cx + width - 4, cy + 12, 7, 14, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + width - 4, cy + height - 26, 7, 14, 2);
  ctx.fill();

  ctx.restore();
}

// ─── Helper: Draw road ───────────────────────────────────────────────────────

function drawRoad(
  ctx: CanvasRenderingContext2D,
  roadOffset: number,
  width: number,
  height: number,
) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.15);
  sky.addColorStop(0, "#050714");
  sky.addColorStop(1, "#0a0a24");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Road surface
  const roadGrad = ctx.createLinearGradient(
    ROAD_LEFT,
    0,
    ROAD_LEFT + ROAD_WIDTH,
    0,
  );
  roadGrad.addColorStop(0, "#1a1a2e");
  roadGrad.addColorStop(0.5, "#16213e");
  roadGrad.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = roadGrad;
  ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, height);

  // Road edge glow (left)
  const leftEdge = ctx.createLinearGradient(
    ROAD_LEFT - 20,
    0,
    ROAD_LEFT + 8,
    0,
  );
  leftEdge.addColorStop(0, "transparent");
  leftEdge.addColorStop(1, "rgba(0, 255, 255, 0.08)");
  ctx.fillStyle = leftEdge;
  ctx.fillRect(ROAD_LEFT - 20, 0, 28, height);

  // Road edge glow (right)
  const rightEdge = ctx.createLinearGradient(
    ROAD_LEFT + ROAD_WIDTH - 8,
    0,
    ROAD_LEFT + ROAD_WIDTH + 20,
    0,
  );
  rightEdge.addColorStop(0, "rgba(0, 255, 255, 0.08)");
  rightEdge.addColorStop(1, "transparent");
  ctx.fillStyle = rightEdge;
  ctx.fillRect(ROAD_LEFT + ROAD_WIDTH - 8, 0, 28, height);

  // Grass / curb (left)
  ctx.fillStyle = "#0d2818";
  ctx.fillRect(0, 0, ROAD_LEFT, height);
  // Grass / curb (right)
  ctx.fillRect(
    ROAD_LEFT + ROAD_WIDTH,
    0,
    width - ROAD_LEFT - ROAD_WIDTH,
    height,
  );

  // White side lines
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(ROAD_LEFT, 0);
  ctx.lineTo(ROAD_LEFT, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ROAD_LEFT + ROAD_WIDTH, 0);
  ctx.lineTo(ROAD_LEFT + ROAD_WIDTH, height);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Dashed lane markings
  const dashLen = 40;
  const dashGap = 30;
  const dashTotal = dashLen + dashGap;
  const dashStartOffset = roadOffset % dashTotal;

  ctx.strokeStyle = "rgba(255,255,200,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([dashLen, dashGap]);

  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const lx = ROAD_LEFT + lane * LANE_WIDTH;
    ctx.beginPath();
    ctx.lineDashOffset = -dashStartOffset;
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, height);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

// ─── Helper: Draw particles ──────────────────────────────────────────────────

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.shadowBlur = 6;
  ctx.shadowColor = p.color;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── LeaderboardStorage ──────────────────────────────────────────────────────

function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem("racing_leaderboard");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  const top5 = entries.sort((a, b) => b.score - a.score).slice(0, 5);
  localStorage.setItem("racing_leaderboard", JSON.stringify(top5));
}

// ─── Main Game Component ─────────────────────────────────────────────────────

const CarRacingGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>("start");
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Game world state refs (mutable, not React state)
  const playerRef = useRef<Car>({
    x: getLaneCenterX(1),
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: "#00AAFF",
    glowColor: "#00AAFF80",
    lane: 1,
  });

  const opponentsRef = useRef<Car[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const speedRef = useRef<number>(INITIAL_SPEED);
  const roadOffsetRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const speedTimerRef = useRef<number>(0);
  const invincibleTimerRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const playerTargetXRef = useRef<number>(getLaneCenterX(1));

  // React state for UI overlay updates
  const [gameState, setGameState] = useState<GameState>("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>(getLeaderboard);
  const [playerName, setPlayerName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [touchLeft, setTouchLeft] = useState(false);
  const [touchRight, setTouchRight] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ─── Spawn opponent ─────────────────────────────────────────────
  const spawnOpponent = useCallback(() => {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const colorPair =
      OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)];
    const opponent: Car = {
      x: getLaneCenterX(lane),
      y: -OPPONENT_HEIGHT / 2 - 10,
      width: OPPONENT_WIDTH,
      height: OPPONENT_HEIGHT,
      color: colorPair.body,
      glowColor: colorPair.glow,
      lane,
      speed: speedRef.current * (0.5 + Math.random() * 0.5),
    };
    opponentsRef.current.push(opponent);
  }, []);

  // ─── Spawn explosion particles ───────────────────────────────────
  const spawnExplosion = useCallback((x: number, y: number) => {
    const colors = ["#FF6600", "#FFAA00", "#FF3300", "#FFFFFF", "#FFFF00"];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
      const sp = 80 + Math.random() * 120;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        alpha: 1,
        radius: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  // ─── Check collision ──────────────────────────────────────────────
  const checkCollision = useCallback((a: Car, b: Car): boolean => {
    const margin = 6; // slight forgiveness
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 - margin &&
      Math.abs(a.y - b.y) < (a.height + b.height) / 2 - margin
    );
  }, []);

  // ─── Reset game ──────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    playerRef.current = {
      x: getLaneCenterX(1),
      y: CANVAS_HEIGHT - 100,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      color: "#00AAFF",
      glowColor: "#00AAFF80",
      lane: 1,
    };
    playerTargetXRef.current = getLaneCenterX(1);
    opponentsRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    livesRef.current = 3;
    speedRef.current = INITIAL_SPEED;
    roadOffsetRef.current = 0;
    spawnTimerRef.current = 0;
    speedTimerRef.current = 0;
    invincibleTimerRef.current = 0;
    setScore(0);
    setLives(3);
    setSpeed(INITIAL_SPEED);
    setNameSaved(false);
  }, []);

  // ─── Game Loop ───────────────────────────────────────────────────
  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      if (gameStateRef.current !== "playing") return;

      const speed = speedRef.current;
      const keys = keysRef.current;

      // ── Handle touch buttons
      const leftPressed =
        keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || touchLeft;
      const rightPressed =
        keys.has("ArrowRight") || keys.has("d") || keys.has("D") || touchRight;

      // ── Player horizontal movement
      const player = playerRef.current;
      if (leftPressed) {
        player.x -= PLAYER_H_SPEED * dt;
      }
      if (rightPressed) {
        player.x += PLAYER_H_SPEED * dt;
      }
      // Clamp player within road
      player.x = Math.max(
        ROAD_LEFT + PLAYER_WIDTH / 2 + 4,
        Math.min(ROAD_LEFT + ROAD_WIDTH - PLAYER_WIDTH / 2 - 4, player.x),
      );

      // ── Road scrolling
      roadOffsetRef.current += speed * dt;

      // ── Score
      scoreRef.current += speed * dt * 0.02;
      if (Math.round(scoreRef.current) !== score) {
        setScore(Math.round(scoreRef.current));
      }

      // ── Speed increment
      speedTimerRef.current += dt * 1000;
      if (speedTimerRef.current >= 5000) {
        speedTimerRef.current = 0;
        speedRef.current = Math.min(
          speedRef.current + SPEED_INCREMENT,
          SPEED_MAX,
        );
        setSpeed(Math.round(speedRef.current));
      }

      // ── Spawn opponents
      const spawnInterval = Math.max(
        600,
        OPPONENT_SPAWN_INTERVAL_BASE - (speedRef.current - INITIAL_SPEED) * 2.5,
      );
      spawnTimerRef.current += dt * 1000;
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current = 0;
        spawnOpponent();
      }

      // ── Update opponents
      opponentsRef.current = opponentsRef.current.filter((opp) => {
        opp.y += (speed + (opp.speed ?? speed)) * dt;
        return opp.y < CANVAS_HEIGHT + OPPONENT_HEIGHT;
      });

      // ── Invincibility countdown
      if (invincibleTimerRef.current > 0) {
        invincibleTimerRef.current -= dt * 1000;
      }

      // ── Collision detection
      if (invincibleTimerRef.current <= 0) {
        for (const opp of opponentsRef.current) {
          if (checkCollision(player, opp)) {
            livesRef.current -= 1;
            setLives(livesRef.current);
            invincibleTimerRef.current = INVINCIBILITY_DURATION;
            spawnExplosion(player.x, player.y);
            if (livesRef.current <= 0) {
              gameStateRef.current = "gameover";
              setGameState("gameover");
              cancelAnimationFrame(animFrameRef.current);
              return;
            }
            break;
          }
        }
      }

      // ── Update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // gravity
        p.alpha -= dt * 1.5;
        return p.alpha > 0;
      });

      // ── Render ──────────────────────────────────────────────────
      drawRoad(ctx, roadOffsetRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw opponents
      for (const opp of opponentsRef.current) {
        drawCar(ctx, opp, false);
      }

      // Draw player (blink when invincible)
      const isInvincible = invincibleTimerRef.current > 0;
      const blinkVisible =
        !isInvincible || Math.floor(timestamp / 150) % 2 === 0;
      if (blinkVisible) {
        drawCar(ctx, player, true, 1.0);
      }

      // Headlight beam for player
      if (blinkVisible) {
        const beamGrad = ctx.createLinearGradient(
          player.x,
          player.y - player.height / 2,
          player.x,
          player.y - player.height / 2 - 80,
        );
        beamGrad.addColorStop(0, "rgba(0,200,255,0.15)");
        beamGrad.addColorStop(1, "rgba(0,200,255,0)");
        ctx.beginPath();
        ctx.moveTo(player.x - 15, player.y - player.height / 2);
        ctx.lineTo(player.x - 30, player.y - player.height / 2 - 80);
        ctx.lineTo(player.x + 30, player.y - player.height / 2 - 80);
        ctx.lineTo(player.x + 15, player.y - player.height / 2);
        ctx.closePath();
        ctx.fillStyle = beamGrad;
        ctx.fill();
      }

      // Draw particles
      for (const p of particlesRef.current) {
        drawParticle(ctx, p);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    },
    [
      score,
      touchLeft,
      touchRight,
      spawnOpponent,
      spawnExplosion,
      checkCollision,
    ],
  );

  // ─── Start / restart ────────────────────────────────────────────
  const startGame = useCallback(() => {
    resetGame();
    gameStateRef.current = "playing";
    setGameState("playing");
    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [resetGame, gameLoop]);

  // ─── Input ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "a",
          "A",
          "d",
          "D",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
      keysRef.current.add(e.key);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // ─── Cleanup on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ─── Draw static start / gameover screens ───────────────────────
  useEffect(() => {
    if (gameState === "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawRoad(ctx, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw idle cars for scene
    const sceneCars: Car[] = [
      {
        x: getLaneCenterX(0),
        y: 380,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        color: "#FF4444",
        glowColor: "#FF000080",
        lane: 0,
      },
      {
        x: getLaneCenterX(2),
        y: 200,
        width: OPPONENT_WIDTH,
        height: OPPONENT_HEIGHT,
        color: "#9B59B6",
        glowColor: "#9B59B680",
        lane: 2,
      },
      {
        x: getLaneCenterX(1),
        y: CANVAS_HEIGHT - 100,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        color: "#00AAFF",
        glowColor: "#00AAFF80",
        lane: 1,
      },
    ];
    sceneCars.forEach((c, i) => drawCar(ctx, c, i === 2));
  }, [gameState]);

  // ─── Save score handler ──────────────────────────────────────────
  const handleSaveScore = useCallback(() => {
    const name = playerName.trim() || "Driver";
    const entry: LeaderboardEntry = {
      name,
      score: Math.round(scoreRef.current),
      date: new Date().toLocaleDateString(),
    };
    const current = getLeaderboard();
    current.push(entry);
    saveLeaderboard(current);
    setLeaderboard(getLeaderboard());
    setNameSaved(true);
  }, [playerName]);

  // ─── Speed in km/h (display) ─────────────────────────────────────
  const speedKmh = Math.round((speed / INITIAL_SPEED) * 80 + 40);

  // ─── Mobile control handlers ─────────────────────────────────────
  const handleTouchLeft = useCallback(
    (active: boolean) => setTouchLeft(active),
    [],
  );
  const handleTouchRight = useCallback(
    (active: boolean) => setTouchRight(active),
    [],
  );

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #050714 0%, #0a0a24 50%, #050714 100%)",
        fontFamily: "'Sora', sans-serif",
      }}
    >
      {/* Title bar */}
      <div className="mb-3 text-center">
        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
            fontWeight: 900,
            letterSpacing: "0.06em",
            background: "linear-gradient(90deg, #00DDFF, #00AAFF, #7B2FFF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
            lineHeight: 1.1,
          }}
        >
          🏎 TURBO RACER
        </h1>
        <p
          style={{
            color: "rgba(150,200,255,0.6)",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
          }}
        >
          NIGHT CIRCUIT
        </p>
      </div>

      {/* Canvas wrapper */}
      <div
        style={{
          position: "relative",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          maxWidth: "98vw",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            "0 0 60px rgba(0,170,255,0.2), 0 0 120px rgba(0,100,255,0.1), 0 8px 32px rgba(0,0,0,0.6)",
          border: "1px solid rgba(0,200,255,0.2)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{ display: "block" }}
        />

        {/* ── HUD (during play) ── */}
        {gameState === "playing" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "10px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              pointerEvents: "none",
            }}
          >
            {/* Lives */}
            <div style={{ display: "flex", gap: 6 }}>
              {([0, 1, 2] as const).map((i) => (
                <span
                  key={`life-${i}`}
                  style={{
                    fontSize: "1.3rem",
                    filter:
                      i < lives
                        ? "drop-shadow(0 0 6px #FF4444)"
                        : "grayscale(1) opacity(0.3)",
                  }}
                >
                  ❤️
                </span>
              ))}
            </div>

            {/* Score + Speed */}
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  color: "#00DDFF",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  textShadow: "0 0 12px rgba(0,220,255,0.8)",
                  letterSpacing: "0.05em",
                }}
              >
                {score.toLocaleString()}
              </div>
              <div
                style={{
                  color: "#7BFFD8",
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  textShadow: "0 0 8px rgba(0,255,200,0.6)",
                }}
              >
                {speedKmh} km/h
              </div>
            </div>
          </div>
        )}

        {/* ── Start Screen ── */}
        {gameState === "start" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(5,7,20,0.78)",
              backdropFilter: "blur(2px)",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "2.8rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                background: "linear-gradient(90deg, #00DDFF, #00AAFF, #7B2FFF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
                lineHeight: 1,
              }}
            >
              🏎 TURBO
              <br />
              RACER
            </div>
            <div
              style={{
                color: "rgba(150,200,255,0.5)",
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                marginTop: -8,
              }}
            >
              NIGHT CIRCUIT
            </div>

            <div
              style={{
                background: "rgba(0,170,255,0.06)",
                border: "1px solid rgba(0,200,255,0.15)",
                borderRadius: 12,
                padding: "12px 20px",
                color: "rgba(180,220,255,0.75)",
                fontSize: "0.78rem",
                lineHeight: 1.8,
                textAlign: "center",
                maxWidth: 260,
              }}
            >
              <div
                style={{ marginBottom: 4, color: "#00DDFF", fontWeight: 600 }}
              >
                HOW TO PLAY
              </div>
              ⬅ ➡ Arrow Keys or A / D<br />
              Avoid opponent cars
              <br />3 lives · Speed increases over time
            </div>

            <button
              type="button"
              onClick={startGame}
              style={{
                marginTop: 8,
                padding: "12px 36px",
                background: "linear-gradient(135deg, #0099DD, #0055FF)",
                border: "none",
                borderRadius: 50,
                color: "white",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                cursor: "pointer",
                boxShadow:
                  "0 0 24px rgba(0,170,255,0.5), 0 4px 16px rgba(0,0,0,0.4)",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1)";
              }}
            >
              START RACE
            </button>

            {/* Leaderboard preview */}
            {leaderboard.length > 0 && (
              <div
                style={{
                  width: "80%",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(0,200,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    color: "#00DDFF",
                    fontSize: "0.65rem",
                    letterSpacing: "0.14em",
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  🏆 TOP SCORES
                </div>
                {leaderboard.map((e, i) => (
                  <div
                    key={`top-${e.name}-${e.score}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: i === 0 ? "#FFD700" : "rgba(180,220,255,0.7)",
                      fontSize: "0.72rem",
                      padding: "2px 0",
                      borderBottom:
                        i < leaderboard.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                    }}
                  >
                    <span>
                      {i + 1}. {e.name}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {e.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Game Over Screen ── */}
        {gameState === "gameover" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(5,7,20,0.85)",
              backdropFilter: "blur(3px)",
              gap: 12,
            }}
          >
            <div
              style={{
                color: "#FF3333",
                fontSize: "2rem",
                fontWeight: 900,
                fontFamily: "'Fraunces', Georgia, serif",
                letterSpacing: "0.1em",
                textShadow: "0 0 20px rgba(255,50,50,0.7)",
                textAlign: "center",
              }}
            >
              GAME OVER
            </div>

            <div
              style={{
                color: "#00DDFF",
                fontSize: "2.4rem",
                fontWeight: 800,
                textShadow: "0 0 16px rgba(0,220,255,0.8)",
              }}
            >
              {Math.round(scoreRef.current).toLocaleString()}
            </div>
            <div
              style={{
                color: "rgba(150,200,255,0.5)",
                fontSize: "0.65rem",
                letterSpacing: "0.14em",
                marginTop: -8,
              }}
            >
              FINAL SCORE
            </div>

            {/* Save score */}
            {!nameSaved ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  width: "80%",
                }}
              >
                <input
                  type="text"
                  placeholder="Enter your name…"
                  value={playerName}
                  maxLength={16}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveScore()}
                  style={{
                    width: "100%",
                    padding: "8px 14px",
                    background: "rgba(0,100,200,0.12)",
                    border: "1px solid rgba(0,200,255,0.3)",
                    borderRadius: 8,
                    color: "white",
                    fontSize: "0.85rem",
                    outline: "none",
                    textAlign: "center",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveScore}
                  style={{
                    padding: "8px 24px",
                    background: "linear-gradient(135deg, #0099DD, #0055FF)",
                    border: "none",
                    borderRadius: 50,
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(0,170,255,0.4)",
                  }}
                >
                  SAVE SCORE
                </button>
              </div>
            ) : (
              <div
                style={{
                  color: "#7BFFD8",
                  fontSize: "0.8rem",
                  letterSpacing: "0.08em",
                }}
              >
                ✓ Score saved!
              </div>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div
                style={{
                  width: "80%",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(0,200,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    color: "#00DDFF",
                    fontSize: "0.65rem",
                    letterSpacing: "0.14em",
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  🏆 LEADERBOARD
                </div>
                {leaderboard.map((e, i) => (
                  <div
                    key={`lb-${e.name}-${e.score}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: i === 0 ? "#FFD700" : "rgba(180,220,255,0.7)",
                      fontSize: "0.72rem",
                      padding: "2px 0",
                      borderBottom:
                        i < leaderboard.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                    }}
                  >
                    <span>
                      {i + 1}. {e.name}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {e.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={startGame}
              style={{
                padding: "12px 36px",
                background: "linear-gradient(135deg, #0099DD, #0055FF)",
                border: "none",
                borderRadius: 50,
                color: "white",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                cursor: "pointer",
                boxShadow:
                  "0 0 24px rgba(0,170,255,0.5), 0 4px 16px rgba(0,0,0,0.4)",
                transition: "transform 0.12s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1)";
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* ── Mobile Touch Controls ── */}
        {gameState === "playing" && isMobile && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-between",
              padding: "0 20px",
              pointerEvents: "none",
            }}
          >
            {/* Left button */}
            <button
              type="button"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: touchLeft
                  ? "rgba(0,170,255,0.5)"
                  : "rgba(0,170,255,0.2)",
                border: "2px solid rgba(0,200,255,0.5)",
                color: "rgba(0,200,255,0.9)",
                fontSize: "1.8rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                pointerEvents: "all",
                WebkitUserSelect: "none",
                userSelect: "none",
                transition: "background 0.1s",
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleTouchLeft(true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleTouchLeft(false);
              }}
              onTouchCancel={() => handleTouchLeft(false)}
              onMouseDown={() => handleTouchLeft(true)}
              onMouseUp={() => handleTouchLeft(false)}
              onMouseLeave={() => handleTouchLeft(false)}
            >
              ◀
            </button>

            {/* Right button */}
            <button
              type="button"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: touchRight
                  ? "rgba(0,170,255,0.5)"
                  : "rgba(0,170,255,0.2)",
                border: "2px solid rgba(0,200,255,0.5)",
                color: "rgba(0,200,255,0.9)",
                fontSize: "1.8rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                pointerEvents: "all",
                WebkitUserSelect: "none",
                userSelect: "none",
                transition: "background 0.1s",
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleTouchRight(true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleTouchRight(false);
              }}
              onTouchCancel={() => handleTouchRight(false)}
              onMouseDown={() => handleTouchRight(true)}
              onMouseUp={() => handleTouchRight(false)}
              onMouseLeave={() => handleTouchRight(false)}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p
        style={{
          marginTop: 20,
          color: "rgba(100,150,200,0.4)",
          fontSize: "0.65rem",
          letterSpacing: "0.1em",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(0,200,255,0.5)", textDecoration: "none" }}
        >
          Built with ♥ using caffeine.ai
        </a>
      </p>
    </div>
  );
};

export default CarRacingGame;
