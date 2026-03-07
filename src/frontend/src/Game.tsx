import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameState = "start" | "playing" | "gameover";
type WeaponType = "pistol" | "rifle" | "shotgun";

interface Vec2 {
  x: number;
  y: number;
}

interface Player {
  pos: Vec2;
  vel: Vec2;
  angle: number; // radians
  health: number;
  armor: number;
  weapon: WeaponType;
  ammo: number; // -1 = infinite
  shootCooldown: number;
  invincibleTimer: number;
  radius: number;
}

interface Enemy {
  id: number;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  health: number;
  maxHealth: number;
  state: "patrol" | "chase" | "attack";
  patrolTarget: Vec2;
  patrolTimer: number;
  shootCooldown: number;
  radius: number;
  alive: boolean;
  weapon: WeaponType;
}

interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  fromPlayer: boolean;
  damage: number;
  radius: number;
  lifetime: number;
  weapon: WeaponType;
}

interface Pickup {
  id: number;
  pos: Vec2;
  type: WeaponType;
  ammo: number;
  radius: number;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "building" | "tree" | "rock" | "wall";
}

interface Particle {
  pos: Vec2;
  vel: Vec2;
  alpha: number;
  radius: number;
  color: string;
  lifetime: number;
}

interface SafeZone {
  cx: number;
  cy: number;
  radius: number;
  targetRadius: number;
  shrinkRate: number;
  phase: number;
  timer: number;
  phaseDuration: number;
}

interface LeaderboardEntry {
  name: string;
  kills: number;
  survivalTime: number;
  rank: number;
  date: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORLD_W = 3000;
const WORLD_H = 3000;
const CANVAS_W = 800;
const CANVAS_H = 600;
const PLAYER_SPEED = 200;
const PLAYER_RADIUS = 14;
const ENEMY_RADIUS = 13;
const BULLET_RADIUS = 4;
const ENEMY_DETECTION_RANGE = 280;
const ENEMY_ATTACK_RANGE = 220;
const ENEMY_COUNT = 18;

const WEAPON_STATS: Record<
  WeaponType,
  {
    fireRate: number;
    damage: number;
    bulletSpeed: number;
    bulletLife: number;
    spread: number;
    pellets: number;
  }
> = {
  pistol: {
    fireRate: 0.45,
    damage: 25,
    bulletSpeed: 600,
    bulletLife: 1.4,
    spread: 0.05,
    pellets: 1,
  },
  rifle: {
    fireRate: 0.12,
    damage: 18,
    bulletSpeed: 900,
    bulletLife: 2.0,
    spread: 0.03,
    pellets: 1,
  },
  shotgun: {
    fireRate: 0.8,
    damage: 15,
    bulletSpeed: 500,
    bulletLife: 0.6,
    spread: 0.3,
    pellets: 6,
  },
};

const WEAPON_AMMO: Record<WeaponType, number> = {
  pistol: -1,
  rifle: 30,
  shotgun: 8,
};

const ZONE_PHASES = [
  { duration: 90, targetFactor: 0.6 },
  { duration: 75, targetFactor: 0.35 },
  { duration: 60, targetFactor: 0.15 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function randomPos(margin = 100): Vec2 {
  return {
    x: margin + Math.random() * (WORLD_W - margin * 2),
    y: margin + Math.random() * (WORLD_H - margin * 2),
  };
}

function aabbCircle(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

function circleCircle(a: Vec2, ar: number, b: Vec2, br: number): boolean {
  return dist(a, b) < ar + br;
}

// ─── Obstacle Generation ──────────────────────────────────────────────────────

function generateObstacles(): Obstacle[] {
  const obs: Obstacle[] = [];

  // Perimeter walls
  obs.push({ x: 0, y: 0, w: WORLD_W, h: 20, type: "wall" });
  obs.push({ x: 0, y: WORLD_H - 20, w: WORLD_W, h: 20, type: "wall" });
  obs.push({ x: 0, y: 0, w: 20, h: WORLD_H, type: "wall" });
  obs.push({ x: WORLD_W - 20, y: 0, w: 20, h: WORLD_H, type: "wall" });

  // Buildings (large structures)
  const buildings = [
    [200, 200, 140, 100],
    [500, 150, 100, 120],
    [900, 300, 160, 80],
    [1400, 200, 120, 140],
    [1800, 300, 100, 100],
    [2200, 150, 140, 120],
    [2600, 200, 100, 100],
    [300, 600, 100, 120],
    [700, 700, 140, 80],
    [1100, 600, 120, 100],
    [1500, 700, 100, 120],
    [1900, 600, 140, 80],
    [2300, 700, 100, 100],
    [2700, 600, 120, 100],
    [200, 1200, 140, 100],
    [600, 1300, 100, 120],
    [1000, 1200, 120, 80],
    [1400, 1300, 140, 100],
    [1800, 1200, 100, 120],
    [2200, 1300, 120, 80],
    [2600, 1200, 100, 100],
    [300, 1800, 120, 140],
    [800, 1900, 140, 100],
    [1200, 1800, 100, 120],
    [1600, 1900, 120, 100],
    [2000, 1800, 140, 80],
    [2400, 1900, 100, 100],
    [2800, 1800, 120, 120],
    [200, 2400, 140, 100],
    [600, 2500, 100, 120],
    [1000, 2400, 120, 80],
    [1400, 2500, 140, 100],
    [1800, 2400, 100, 120],
    [2200, 2500, 120, 80],
    [2600, 2400, 100, 100],
    [2750, 2700, 140, 100],
    // Center area buildings
    [1350, 1350, 120, 120],
    [1550, 1350, 120, 120],
    [1350, 1550, 120, 120],
    [1550, 1550, 120, 120],
  ];
  for (const [x, y, w, h] of buildings) {
    obs.push({ x, y, w, h, type: "building" });
  }

  // Rocks (medium)
  const rng = [
    [400, 400],
    [800, 500],
    [1200, 400],
    [1700, 500],
    [2100, 400],
    [2500, 500],
    [350, 1000],
    [750, 900],
    [1100, 1000],
    [1500, 900],
    [2000, 1000],
    [2400, 900],
    [2800, 1000],
    [400, 1600],
    [850, 1500],
    [1300, 1600],
    [1700, 1500],
    [2100, 1600],
    [2500, 1500],
    [450, 2200],
    [900, 2100],
    [1350, 2200],
    [1800, 2100],
    [2250, 2200],
    [2700, 2100],
    [500, 2800],
    [1000, 2900],
    [1500, 2800],
    [2000, 2900],
    [2500, 2800],
    [1000, 1500],
    [2000, 1500],
  ];
  for (const [rx, ry] of rng) {
    const s = 30 + Math.random() * 30;
    obs.push({ x: rx, y: ry, w: s, h: s * 0.7, type: "rock" });
  }

  // Trees (small)
  for (let i = 0; i < 80; i++) {
    const tx = 50 + Math.random() * (WORLD_W - 100);
    const ty = 50 + Math.random() * (WORLD_H - 100);
    // Don't overlap center
    if (Math.abs(tx - WORLD_W / 2) < 200 && Math.abs(ty - WORLD_H / 2) < 200)
      continue;
    obs.push({ x: tx - 12, y: ty - 12, w: 24, h: 24, type: "tree" });
  }

  return obs;
}

// ─── Generate Pickups ─────────────────────────────────────────────────────────

function generatePickups(_obstacles: Obstacle[]): Pickup[] {
  const types: WeaponType[] = ["rifle", "shotgun", "pistol"];
  const picks: Pickup[] = [];
  let id = 1;

  const positions = [
    [350, 350],
    [900, 450],
    [1500, 250],
    [2000, 400],
    [2500, 350],
    [300, 900],
    [900, 800],
    [1500, 1000],
    [2100, 900],
    [2700, 800],
    [400, 1500],
    [1000, 1400],
    [1500, 1450],
    [2200, 1500],
    [2800, 1400],
    [350, 2100],
    [1000, 2000],
    [1600, 2100],
    [2200, 2000],
    [2700, 2100],
    [500, 2700],
    [1200, 2600],
    [1800, 2700],
    [2400, 2600],
    [2800, 2700],
  ];

  for (let i = 0; i < positions.length; i++) {
    const type = types[i % types.length];
    picks.push({
      id: id++,
      pos: { x: positions[i][0], y: positions[i][1] },
      type,
      ammo: WEAPON_AMMO[type] === -1 ? -1 : WEAPON_AMMO[type],
      radius: 14,
    });
  }

  return picks;
}

// ─── Draw Functions ───────────────────────────────────────────────────────────

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: Obstacle,
  camX: number,
  camY: number,
) {
  const sx = obs.x - camX;
  const sy = obs.y - camY;
  if (
    sx + obs.w < -20 ||
    sx > CANVAS_W + 20 ||
    sy + obs.h < -20 ||
    sy > CANVAS_H + 20
  )
    return;

  ctx.save();
  switch (obs.type) {
    case "building": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(sx + 6, sy + 6, obs.w, obs.h);
      // Building wall
      ctx.fillStyle = "#2a3520";
      ctx.fillRect(sx, sy, obs.w, obs.h);
      // Roof detail
      ctx.fillStyle = "#1e2a16";
      ctx.fillRect(sx + 4, sy + 4, obs.w - 8, obs.h - 8);
      // Windows
      ctx.fillStyle = "rgba(200, 255, 100, 0.15)";
      const wCols = Math.floor(obs.w / 28);
      const wRows = Math.floor(obs.h / 28);
      for (let wr = 0; wr < wRows; wr++) {
        for (let wc = 0; wc < wCols; wc++) {
          ctx.fillRect(sx + 10 + wc * 28, sy + 10 + wr * 28, 12, 10);
        }
      }
      // Outline
      ctx.strokeStyle = "#3a4a28";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, obs.w, obs.h);
      break;
    }
    case "rock": {
      ctx.fillStyle = "#3a3530";
      ctx.beginPath();
      ctx.ellipse(
        sx + obs.w / 2,
        sy + obs.h / 2,
        obs.w / 2,
        obs.h / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#4a453f";
      ctx.beginPath();
      ctx.ellipse(
        sx + obs.w / 2 - 3,
        sy + obs.h / 2 - 3,
        obs.w / 2.5,
        obs.h / 2.5,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case "tree": {
      // Trunk
      ctx.fillStyle = "#3d2b1a";
      ctx.fillRect(sx + obs.w / 2 - 3, sy + obs.h / 2, 6, obs.h / 2);
      // Canopy
      const g = ctx.createRadialGradient(
        sx + obs.w / 2,
        sy + obs.h / 3,
        2,
        sx + obs.w / 2,
        sy + obs.h / 3,
        obs.w / 2,
      );
      g.addColorStop(0, "#3a5a20");
      g.addColorStop(1, "#1e3010");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx + obs.w / 2, sy + obs.h / 3, obs.w / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "wall": {
      ctx.fillStyle = "#252820";
      ctx.fillRect(sx, sy, obs.w, obs.h);
      ctx.fillStyle = "#1a1c18";
      // Brick pattern
      const bw = 20;
      const bh = 10;
      for (let row = 0; row * bh < obs.h; row++) {
        const offset = row % 2 === 0 ? 0 : bw / 2;
        for (let col = -1; col * bw < obs.w + bw; col++) {
          ctx.strokeStyle = "#101210";
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + col * bw + offset, sy + row * bh, bw, bh);
        }
      }
      break;
    }
  }
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  // Base ground
  const startTileX = Math.floor(camX / 80) * 80;
  const startTileY = Math.floor(camY / 80) * 80;

  for (let tx = startTileX - 80; tx < camX + CANVAS_W + 80; tx += 80) {
    for (let ty = startTileY - 80; ty < camY + CANVAS_H + 80; ty += 80) {
      const sx = tx - camX;
      const sy = ty - camY;
      const shade =
        (Math.floor(tx / 80) + Math.floor(ty / 80)) % 2 === 0 ? 0.02 : 0;
      ctx.fillStyle = shade > 0 ? "#1a2212" : "#182010";
      ctx.fillRect(sx, sy, 80, 80);
    }
  }

  // Grass patches
  ctx.fillStyle = "rgba(30, 50, 15, 0.4)";
  const seed = (camX + camY) * 0.001;
  for (let i = 0; i < 8; i++) {
    const px =
      (Math.sin(seed * i + i * 2.3) * 0.5 + 0.5) * (CANVAS_W + 200) - 100;
    const py =
      (Math.cos(seed * i + i * 1.7) * 0.5 + 0.5) * (CANVAS_H + 200) - 100;
    ctx.beginPath();
    ctx.ellipse(px, py, 30 + i * 4, 15 + i * 2, i * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  camX: number,
  camY: number,
  timestamp: number,
) {
  const sx = player.pos.x - camX;
  const sy = player.pos.y - camY;

  const isInvincible = player.invincibleTimer > 0;
  if (isInvincible && Math.floor(timestamp / 100) % 2 === 1) return;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(player.angle);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = "#4a6e30";
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vest
  ctx.fillStyle = "#3a5520";
  ctx.fillRect(-7, -5, 14, 10);

  // Head
  ctx.fillStyle = "#5a4030";
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = "#3a5020";
  ctx.beginPath();
  ctx.arc(0, -9, 7, Math.PI, 0);
  ctx.fill();

  // Gun
  ctx.fillStyle = "#222820";
  ctx.fillRect(4, -2, 18, 4);
  ctx.fillStyle = "#111510";
  ctx.fillRect(18, -1, 4, 2);

  // Glow when shooting
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#88ff44";

  // Outline
  ctx.strokeStyle = "#88ff44";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  camX: number,
  camY: number,
) {
  const sx = enemy.pos.x - camX;
  const sy = enemy.pos.y - camY;

  if (sx < -40 || sx > CANVAS_W + 40 || sy < -40 || sy > CANVAS_H + 40) return;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(enemy.angle);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body - red/orange team
  ctx.fillStyle = "#6e2e20";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vest
  ctx.fillStyle = "#5a2218";
  ctx.fillRect(-6, -4, 12, 9);

  // Head
  ctx.fillStyle = "#4a3525";
  ctx.beginPath();
  ctx.arc(0, -7, 6, 0, Math.PI * 2);
  ctx.fill();

  // Enemy helmet - different color
  ctx.fillStyle = "#7a2010";
  ctx.beginPath();
  ctx.arc(0, -8, 7, Math.PI, 0);
  ctx.fill();

  // Gun
  ctx.fillStyle = "#1a1510";
  ctx.fillRect(4, -2, 16, 4);

  // Outline
  ctx.strokeStyle = "#ff4422";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#ff4422";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Health bar above
  ctx.save();
  const hbW = 30;
  const hbH = 4;
  const hbX = sx - hbW / 2;
  const hbY = sy - enemy.radius - 12;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(hbX - 1, hbY - 1, hbW + 2, hbH + 2);
  ctx.fillStyle = "#ff2222";
  ctx.fillRect(hbX, hbY, hbW, hbH);
  ctx.fillStyle = "#44ff22";
  ctx.fillRect(hbX, hbY, hbW * (enemy.health / enemy.maxHealth), hbH);
  ctx.restore();
}

function drawBullet(
  ctx: CanvasRenderingContext2D,
  bullet: Bullet,
  camX: number,
  camY: number,
) {
  const sx = bullet.pos.x - camX;
  const sy = bullet.pos.y - camY;
  if (sx < -10 || sx > CANVAS_W + 10 || sy < -10 || sy > CANVAS_H + 10) return;

  ctx.save();
  const color = bullet.fromPlayer ? "#ccff66" : "#ff6622";
  ctx.fillStyle = color;
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(sx, sy, bullet.radius, 0, Math.PI * 2);
  ctx.fill();

  // Trail
  const trailLen = bullet.weapon === "rifle" ? 16 : 8;
  const dir = normalize(bullet.vel);
  const grad = ctx.createLinearGradient(
    sx - dir.x * trailLen,
    sy - dir.y * trailLen,
    sx,
    sy,
  );
  grad.addColorStop(0, "transparent");
  grad.addColorStop(1, `${color}88`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = bullet.radius * 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - dir.x * trailLen, sy - dir.y * trailLen);
  ctx.lineTo(sx, sy);
  ctx.stroke();

  ctx.restore();
}

function drawPickup(
  ctx: CanvasRenderingContext2D,
  pickup: Pickup,
  camX: number,
  camY: number,
  timestamp: number,
) {
  const sx = pickup.pos.x - camX;
  const sy = pickup.pos.y - camY;
  if (sx < -30 || sx > CANVAS_W + 30 || sy < -30 || sy > CANVAS_H + 30) return;

  ctx.save();
  const pulse = Math.sin(timestamp * 0.003) * 0.15 + 0.85;
  const colors: Record<WeaponType, string> = {
    pistol: "#ffcc44",
    rifle: "#44aaff",
    shotgun: "#ff8844",
  };
  const color = colors[pickup.type];

  ctx.globalAlpha = pulse;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;

  // Glow circle
  ctx.fillStyle = `${color}22`;
  ctx.beginPath();
  ctx.arc(sx, sy, 18, 0, Math.PI * 2);
  ctx.fill();

  // Icon background
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.fill();

  // Gun shape
  ctx.fillStyle = color;
  if (pickup.type === "pistol") {
    ctx.fillRect(sx - 8, sy - 3, 14, 5);
    ctx.fillRect(sx - 2, sy + 2, 5, 4);
  } else if (pickup.type === "rifle") {
    ctx.fillRect(sx - 10, sy - 2, 20, 4);
    ctx.fillRect(sx - 9, sy - 5, 5, 3);
  } else {
    ctx.fillRect(sx - 8, sy - 3, 16, 5);
    ctx.fillRect(sx - 6, sy + 2, 4, 3);
    ctx.fillRect(sx + 2, sy + 2, 4, 3);
  }

  // Label
  ctx.globalAlpha = pulse * 0.9;
  ctx.fillStyle = color;
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(pickup.type.toUpperCase(), sx, sy + 26);

  ctx.restore();
}

function drawSafeZone(
  ctx: CanvasRenderingContext2D,
  zone: SafeZone,
  camX: number,
  camY: number,
) {
  const sx = zone.cx - camX;
  const sy = zone.cy - camY;

  ctx.save();

  // Blue zone overlay outside circle
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_W, CANVAS_H);
  ctx.arc(sx, sy, zone.radius, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(30, 100, 220, 0.15)";
  ctx.fill();

  // Zone border glow
  ctx.beginPath();
  ctx.arc(sx, sy, zone.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(80, 160, 255, 0.8)";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(80, 160, 255, 1)";
  ctx.stroke();

  // Inner glow
  ctx.beginPath();
  ctx.arc(sx, sy, zone.radius - 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(120, 200, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  camX: number,
  camY: number,
) {
  const sx = p.pos.x - camX;
  const sy = p.pos.y - camY;
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.shadowBlur = 4;
  ctx.shadowColor = p.color;
  ctx.beginPath();
  ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  player: Player,
  enemies: Enemy[],
  zone: SafeZone,
  pickups: Pickup[],
) {
  const mm = { x: CANVAS_W - 150, y: CANVAS_H - 150, w: 140, h: 140 };
  const scale = mm.w / WORLD_W;

  ctx.save();

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.strokeStyle = "rgba(100,200,100,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(mm.x, mm.y, mm.w, mm.h, 4);
  ctx.fill();
  ctx.stroke();

  // Clip to minimap bounds
  ctx.beginPath();
  ctx.rect(mm.x, mm.y, mm.w, mm.h);
  ctx.clip();

  // Zone circle
  const zx = mm.x + zone.cx * scale;
  const zy = mm.y + zone.cy * scale;
  const zr = zone.radius * scale;
  ctx.beginPath();
  ctx.arc(zx, zy, zr, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(80, 160, 255, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = mm.x + e.pos.x * scale;
    const ey = mm.y + e.pos.y * scale;
    ctx.fillStyle = "#ff4422";
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups
  for (const p of pickups) {
    const px = mm.x + p.pos.x * scale;
    const py = mm.y + p.pos.y * scale;
    ctx.fillStyle = "#ffcc44";
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player dot
  const px = mm.x + player.pos.x * scale;
  const py = mm.y + player.pos.y * scale;
  ctx.fillStyle = "#88ff44";
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#88ff44";
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Label
  ctx.save();
  ctx.fillStyle = "rgba(150, 220, 100, 0.7)";
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("MAP", CANVAS_W - 10, CANVAS_H - 152);
  ctx.restore();
}

// ─── Leaderboard Helpers ──────────────────────────────────────────────────────

function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem("battlezone_leaderboard_v2");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLeaderboard(entry: LeaderboardEntry) {
  const lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => b.kills - a.kills || b.survivalTime - a.survivalTime);
  const top = lb.slice(0, 10);
  localStorage.setItem("battlezone_leaderboard_v2", JSON.stringify(top));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Main Game Component ──────────────────────────────────────────────────────

let bulletIdCounter = 0;
let enemyIdCounter = 0;
let pickupIdCounter = 1000;

const BattleZoneGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>("start");
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Game world (all refs for loop stability)
  const playerRef = useRef<Player>({
    pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
    vel: { x: 0, y: 0 },
    angle: 0,
    health: 100,
    armor: 50,
    weapon: "pistol",
    ammo: -1,
    shootCooldown: 0,
    invincibleTimer: 0,
    radius: PLAYER_RADIUS,
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const safeZoneRef = useRef<SafeZone>({
    cx: WORLD_W / 2,
    cy: WORLD_H / 2,
    radius: 1800,
    targetRadius: 1800 * ZONE_PHASES[0].targetFactor,
    shrinkRate: 0,
    phase: 0,
    timer: ZONE_PHASES[0].duration,
    phaseDuration: ZONE_PHASES[0].duration,
  });

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({
    x: 0,
    y: 0,
    down: false,
  });
  const survivalTimeRef = useRef<number>(0);
  const killsRef = useRef<number>(0);
  const totalEnemiesRef = useRef<number>(ENEMY_COUNT);
  const playerNameRef = useRef<string>("");

  // Joystick refs for mobile
  const joyRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });
  const shootBtnRef = useRef<boolean>(false);

  // React state for UI
  const [gameState, setGameState] = useState<GameState>("start");
  const [playerName, setPlayerName] = useState("");
  const [kills, setKills] = useState(0);
  const [health, setHealth] = useState(100);
  const [armor, setArmor] = useState(50);
  const [weapon, setWeapon] = useState<WeaponType>("pistol");
  const [ammo, setAmmo] = useState<number>(-1);
  const [zoneTimer, setZoneTimer] = useState(ZONE_PHASES[0].duration);
  const [playersRemaining, setPlayersRemaining] = useState(ENEMY_COUNT + 1);
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>(getLeaderboard);
  const [finalStats, setFinalStats] = useState<{
    kills: number;
    time: number;
    rank: number;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const deferredPromptRef = useRef<
    | (Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
    | null
  >(null);

  useEffect(() => {
    const check = () =>
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as Event & {
        prompt: () => void;
        userChoice: Promise<{ outcome: string }>;
      };
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Also show banner on iOS (which doesn't support beforeinstallprompt)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    if (isIOS && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === "accepted") {
        setShowInstallBanner(false);
      }
      deferredPromptRef.current = null;
    } else {
      // iOS fallback - show instructions
      alert(
        "iPhone par:\n1. Safari mein neeche Share button dabao\n2. 'Add to Home Screen' select karo\n\nAndroid par:\n1. Chrome menu (3 dots) kholo\n2. 'Add to Home screen' select karo",
      );
    }
  };

  // ─── Spawn enemies ────────────────────────────────────────────────
  const spawnEnemies = useCallback(() => {
    const enemies: Enemy[] = [];
    const weapons: WeaponType[] = ["pistol", "rifle", "shotgun"];

    for (let i = 0; i < ENEMY_COUNT; i++) {
      let pos: Vec2;
      let attempts = 0;
      do {
        pos = randomPos(200);
        attempts++;
      } while (
        attempts < 20 &&
        dist(pos, { x: WORLD_W / 2, y: WORLD_H / 2 }) < 400
      );

      const w = weapons[i % weapons.length];
      enemies.push({
        id: enemyIdCounter++,
        pos,
        vel: { x: 0, y: 0 },
        angle: Math.random() * Math.PI * 2,
        health: 80 + Math.floor(Math.random() * 40),
        maxHealth: 100,
        state: "patrol",
        patrolTarget: randomPos(200),
        patrolTimer: 2 + Math.random() * 3,
        shootCooldown: 0,
        radius: ENEMY_RADIUS,
        alive: true,
        weapon: w,
      });
    }
    enemiesRef.current = enemies;
    totalEnemiesRef.current = ENEMY_COUNT;
  }, []);

  // ─── Collision helpers ────────────────────────────────────────────
  const collidesWithObstacles = useCallback(
    (pos: Vec2, radius: number): boolean => {
      for (const obs of obstaclesRef.current) {
        if (aabbCircle(pos.x, pos.y, radius, obs.x, obs.y, obs.w, obs.h))
          return true;
      }
      return false;
    },
    [],
  );

  // ─── Spawn particles ──────────────────────────────────────────────
  const spawnExplosion = useCallback(
    (pos: Vec2, count = 12, colorMain = "#ff6622") => {
      const colors = [colorMain, "#ff9944", "#ffdd44", "#ffffff"];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 60 + Math.random() * 100;
        particlesRef.current.push({
          pos: { x: pos.x, y: pos.y },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          alpha: 1,
          radius: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          lifetime: 0.6 + Math.random() * 0.4,
        });
      }
    },
    [],
  );

  const spawnBloodSplat = useCallback((pos: Vec2) => {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 50;
      particlesRef.current.push({
        pos: { x: pos.x, y: pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        alpha: 0.8,
        radius: 2 + Math.random() * 2,
        color: "#882222",
        lifetime: 0.5,
      });
    }
  }, []);

  // ─── Shoot ────────────────────────────────────────────────────────
  const shootBullet = useCallback(
    (
      fromPos: Vec2,
      angle: number,
      fromPlayer: boolean,
      weaponType: WeaponType,
    ) => {
      const stats = WEAPON_STATS[weaponType];
      for (let p = 0; p < stats.pellets; p++) {
        const spread = (Math.random() - 0.5) * stats.spread;
        const a = angle + spread;
        bulletIdCounter++;
        bulletsRef.current.push({
          id: bulletIdCounter,
          pos: {
            x: fromPos.x + Math.cos(a) * 20,
            y: fromPos.y + Math.sin(a) * 20,
          },
          vel: {
            x: Math.cos(a) * stats.bulletSpeed,
            y: Math.sin(a) * stats.bulletSpeed,
          },
          fromPlayer,
          damage: stats.damage,
          radius: fromPlayer ? BULLET_RADIUS : BULLET_RADIUS - 1,
          lifetime: stats.bulletLife,
          weapon: weaponType,
        });
      }
    },
    [],
  );

  // ─── Reset game ───────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    playerRef.current = {
      pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
      vel: { x: 0, y: 0 },
      angle: 0,
      health: 100,
      armor: 50,
      weapon: "pistol",
      ammo: -1,
      shootCooldown: 0,
      invincibleTimer: 0,
      radius: PLAYER_RADIUS,
    };
    bulletsRef.current = [];
    particlesRef.current = [];
    killsRef.current = 0;
    survivalTimeRef.current = 0;

    safeZoneRef.current = {
      cx: WORLD_W / 2,
      cy: WORLD_H / 2,
      radius: 1800,
      targetRadius: 1800 * ZONE_PHASES[0].targetFactor,
      shrinkRate: 0,
      phase: 0,
      timer: ZONE_PHASES[0].duration,
      phaseDuration: ZONE_PHASES[0].duration,
    };

    obstaclesRef.current = generateObstacles();
    pickupsRef.current = generatePickups(obstaclesRef.current);
    spawnEnemies();

    setKills(0);
    setHealth(100);
    setArmor(50);
    setWeapon("pistol");
    setAmmo(-1);
    setZoneTimer(ZONE_PHASES[0].duration);
    setPlayersRemaining(ENEMY_COUNT + 1);
    setFinalStats(null);
  }, [spawnEnemies]);

  // ─── Game loop ────────────────────────────────────────────────────
  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      if (gameStateRef.current !== "playing") return;

      const player = playerRef.current;
      const keys = keysRef.current;
      const mouse = mouseRef.current;
      const joy = joyRef.current;

      // ── Survival time
      survivalTimeRef.current += dt;

      // ── Player movement
      let mvx = 0;
      let mvy = 0;

      if (joy.active) {
        mvx = joy.dx;
        mvy = joy.dy;
      } else {
        if (keys.has("w") || keys.has("W") || keys.has("ArrowUp")) mvy -= 1;
        if (keys.has("s") || keys.has("S") || keys.has("ArrowDown")) mvy += 1;
        if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft")) mvx -= 1;
        if (keys.has("d") || keys.has("D") || keys.has("ArrowRight")) mvx += 1;
      }

      const mvNorm = normalize({ x: mvx, y: mvy });
      const newPX = player.pos.x + mvNorm.x * PLAYER_SPEED * dt;
      const newPY = player.pos.y + mvNorm.y * PLAYER_SPEED * dt;

      // Move with obstacle collision
      const candidateX = { x: newPX, y: player.pos.y };
      if (
        !collidesWithObstacles(candidateX, player.radius) &&
        newPX > player.radius &&
        newPX < WORLD_W - player.radius
      ) {
        player.pos.x = newPX;
      }
      const candidateY = { x: player.pos.x, y: newPY };
      if (
        !collidesWithObstacles(candidateY, player.radius) &&
        newPY > player.radius &&
        newPY < WORLD_H - player.radius
      ) {
        player.pos.y = newPY;
      }

      // ── Player aim
      const camX = Math.max(
        0,
        Math.min(WORLD_W - CANVAS_W, player.pos.x - CANVAS_W / 2),
      );
      const camY = Math.max(
        0,
        Math.min(WORLD_H - CANVAS_H, player.pos.y - CANVAS_H / 2),
      );

      if (!joy.active) {
        const worldMouseX = mouse.x + camX;
        const worldMouseY = mouse.y + camY;
        player.angle = Math.atan2(
          worldMouseY - player.pos.y,
          worldMouseX - player.pos.x,
        );
      } else if (mvx !== 0 || mvy !== 0) {
        player.angle = Math.atan2(mvy, mvx);
      }

      // ── Player shoot
      if (player.shootCooldown > 0) player.shootCooldown -= dt;
      const wantShoot = mouse.down || shootBtnRef.current;
      if (wantShoot && player.shootCooldown <= 0) {
        const stats = WEAPON_STATS[player.weapon];
        if (player.ammo === -1 || player.ammo > 0) {
          shootBullet(player.pos, player.angle, true, player.weapon);
          if (player.ammo > 0) player.ammo--;
          if (player.ammo === 0) {
            player.weapon = "pistol";
            player.ammo = -1;
            setWeapon("pistol");
            setAmmo(-1);
          }
          player.shootCooldown = stats.fireRate;
          setAmmo(player.ammo);
        }
      }

      // ── Invincible timer
      if (player.invincibleTimer > 0) player.invincibleTimer -= dt;

      // ── Safe zone
      const zone = safeZoneRef.current;
      zone.timer -= dt;
      if (zone.timer <= 0) {
        if (zone.phase < ZONE_PHASES.length - 1) {
          zone.phase++;
          const nextPhase = ZONE_PHASES[zone.phase];
          zone.timer = nextPhase.duration;
          zone.phaseDuration = nextPhase.duration;
          zone.targetRadius = 1800 * nextPhase.targetFactor;
        } else {
          zone.timer = 999; // Last phase holds
        }
      }

      // Shrink zone gradually
      if (zone.radius > zone.targetRadius) {
        const shrinkSpeed =
          ((zone.radius - zone.targetRadius) / (zone.timer + 1)) * 1.5;
        zone.radius = Math.max(
          zone.targetRadius,
          zone.radius - shrinkSpeed * dt,
        );
      }
      setZoneTimer(Math.max(0, zone.timer));

      // Zone damage
      const distToCenter = dist(player.pos, { x: zone.cx, y: zone.cy });
      if (distToCenter > zone.radius) {
        const dmg = 2 * dt;
        if (player.armor > 0) {
          player.armor = Math.max(0, player.armor - dmg);
          setArmor(Math.round(player.armor));
        } else {
          player.health -= dmg;
          setHealth(Math.round(player.health));
        }
        if (player.health <= 0) {
          const alive = enemiesRef.current.filter((e) => e.alive).length;
          const rank = alive + 1;
          setFinalStats({
            kills: killsRef.current,
            time: survivalTimeRef.current,
            rank,
          });
          gameStateRef.current = "gameover";
          setGameState("gameover");
          cancelAnimationFrame(animFrameRef.current);
          return;
        }
      }

      // ── Update pickups (collect)
      pickupsRef.current = pickupsRef.current.filter((pickup) => {
        if (
          circleCircle(
            player.pos,
            player.radius + 10,
            pickup.pos,
            pickup.radius,
          )
        ) {
          player.weapon = pickup.type;
          player.ammo = pickup.ammo;
          setWeapon(pickup.type);
          setAmmo(pickup.ammo);
          return false;
        }
        return true;
      });

      // ── Weapon swap Q
      if (keys.has("q") || keys.has("Q")) {
        keys.delete("q");
        keys.delete("Q");
        if (player.weapon !== "pistol") {
          player.weapon = "pistol";
          player.ammo = -1;
          setWeapon("pistol");
          setAmmo(-1);
        }
      }

      // ── Enemy AI
      const aliveEnemies = enemiesRef.current.filter((e) => e.alive);
      setPlayersRemaining(aliveEnemies.length + 1);

      for (const enemy of aliveEnemies) {
        const dToPlayer = dist(enemy.pos, player.pos);

        // State machine
        if (dToPlayer < ENEMY_DETECTION_RANGE) {
          enemy.state = dToPlayer < ENEMY_ATTACK_RANGE ? "attack" : "chase";
        } else {
          enemy.state = "patrol";
        }

        if (enemy.state === "patrol") {
          enemy.patrolTimer -= dt;
          if (
            enemy.patrolTimer <= 0 ||
            dist(enemy.pos, enemy.patrolTarget) < 30
          ) {
            enemy.patrolTarget = randomPos(100);
            enemy.patrolTimer = 3 + Math.random() * 4;
          }
          const dir = normalize({
            x: enemy.patrolTarget.x - enemy.pos.x,
            y: enemy.patrolTarget.y - enemy.pos.y,
          });
          const spd = 60;
          const nx = enemy.pos.x + dir.x * spd * dt;
          const ny = enemy.pos.y + dir.y * spd * dt;
          const cx2 = { x: nx, y: enemy.pos.y };
          const cy2 = { x: enemy.pos.x, y: ny };
          if (
            !collidesWithObstacles(cx2, enemy.radius) &&
            nx > enemy.radius &&
            nx < WORLD_W - enemy.radius
          )
            enemy.pos.x = nx;
          if (
            !collidesWithObstacles(cy2, enemy.radius) &&
            ny > enemy.radius &&
            ny < WORLD_H - enemy.radius
          )
            enemy.pos.y = ny;
          enemy.angle = Math.atan2(dir.y, dir.x);
        } else {
          // Chase or attack
          const dir = normalize({
            x: player.pos.x - enemy.pos.x,
            y: player.pos.y - enemy.pos.y,
          });
          enemy.angle = Math.atan2(dir.y, dir.x);

          if (enemy.state === "chase") {
            const spd = 110;
            const nx = enemy.pos.x + dir.x * spd * dt;
            const ny = enemy.pos.y + dir.y * spd * dt;
            const cx2 = { x: nx, y: enemy.pos.y };
            const cy2 = { x: enemy.pos.x, y: ny };
            if (
              !collidesWithObstacles(cx2, enemy.radius) &&
              nx > enemy.radius &&
              nx < WORLD_W - enemy.radius
            )
              enemy.pos.x = nx;
            if (
              !collidesWithObstacles(cy2, enemy.radius) &&
              ny > enemy.radius &&
              ny < WORLD_H - enemy.radius
            )
              enemy.pos.y = ny;
          }

          if (enemy.state === "attack") {
            if (enemy.shootCooldown <= 0) {
              // Add slight inaccuracy
              const inaccuracy = 0.15;
              const aimAngle = enemy.angle + (Math.random() - 0.5) * inaccuracy;
              shootBullet(enemy.pos, aimAngle, false, enemy.weapon);
              enemy.shootCooldown = WEAPON_STATS[enemy.weapon].fireRate * 2.5;
            }
          }
        }

        if (enemy.shootCooldown > 0) enemy.shootCooldown -= dt;
      }

      // ── Update bullets
      bulletsRef.current = bulletsRef.current.filter((bullet) => {
        bullet.pos.x += bullet.vel.x * dt;
        bullet.pos.y += bullet.vel.y * dt;
        bullet.lifetime -= dt;

        if (bullet.lifetime <= 0) return false;

        // Check obstacle collisions
        for (const obs of obstaclesRef.current) {
          if (
            aabbCircle(
              bullet.pos.x,
              bullet.pos.y,
              bullet.radius,
              obs.x,
              obs.y,
              obs.w,
              obs.h,
            )
          ) {
            spawnExplosion(bullet.pos, 3, "#886644");
            return false;
          }
        }

        // Bullet vs player
        if (!bullet.fromPlayer && player.invincibleTimer <= 0) {
          if (
            circleCircle(bullet.pos, bullet.radius, player.pos, player.radius)
          ) {
            const dmg = bullet.damage;
            if (player.armor > 0) {
              const armorAbsorb = Math.min(player.armor, dmg * 0.6);
              player.armor -= armorAbsorb;
              player.health -= dmg - armorAbsorb;
            } else {
              player.health -= dmg;
            }
            player.invincibleTimer = 0.2;
            setHealth(Math.round(Math.max(0, player.health)));
            setArmor(Math.round(Math.max(0, player.armor)));
            spawnBloodSplat(player.pos);

            if (player.health <= 0) {
              const alive = enemiesRef.current.filter((e) => e.alive).length;
              const rank = alive + 1;
              setFinalStats({
                kills: killsRef.current,
                time: survivalTimeRef.current,
                rank,
              });
              gameStateRef.current = "gameover";
              setGameState("gameover");
              cancelAnimationFrame(animFrameRef.current);
              return false;
            }
            return false;
          }
        }

        // Bullet vs enemies
        if (bullet.fromPlayer) {
          for (const enemy of enemiesRef.current) {
            if (!enemy.alive) continue;
            if (
              circleCircle(bullet.pos, bullet.radius, enemy.pos, enemy.radius)
            ) {
              enemy.health -= bullet.damage;
              spawnBloodSplat(enemy.pos);
              if (enemy.health <= 0) {
                enemy.alive = false;
                killsRef.current++;
                setKills(killsRef.current);
                spawnExplosion(enemy.pos, 15, "#ff4422");

                // Drop weapon pickup
                if (enemy.weapon !== "pistol") {
                  pickupIdCounter++;
                  pickupsRef.current.push({
                    id: pickupIdCounter,
                    pos: { x: enemy.pos.x, y: enemy.pos.y },
                    type: enemy.weapon,
                    ammo: WEAPON_AMMO[enemy.weapon],
                    radius: 14,
                  });
                }

                // Check win condition
                const remaining = enemiesRef.current.filter(
                  (e) => e.alive,
                ).length;
                if (remaining === 0) {
                  setFinalStats({
                    kills: killsRef.current,
                    time: survivalTimeRef.current,
                    rank: 1,
                  });
                  gameStateRef.current = "gameover";
                  setGameState("gameover");
                  cancelAnimationFrame(animFrameRef.current);
                  return false;
                }
              }
              return false;
            }
          }
        }

        return true;
      });

      // ── Update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.vel.x *= 0.95;
        p.vel.y *= 0.95;
        p.lifetime -= dt;
        p.alpha = Math.max(0, p.lifetime * 2);
        return p.lifetime > 0;
      });

      // ── Render ─────────────────────────────────────────────────────
      const camXr = Math.max(
        0,
        Math.min(WORLD_W - CANVAS_W, player.pos.x - CANVAS_W / 2),
      );
      const camYr = Math.max(
        0,
        Math.min(WORLD_H - CANVAS_H, player.pos.y - CANVAS_H / 2),
      );

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawGround(ctx, camXr, camYr);

      // Draw obstacles back-to-front
      for (const obs of obstaclesRef.current) {
        drawObstacle(ctx, obs, camXr, camYr);
      }

      // Pickups
      for (const pickup of pickupsRef.current) {
        drawPickup(ctx, pickup, camXr, camYr, timestamp);
      }

      // Enemies
      for (const enemy of enemiesRef.current) {
        if (enemy.alive) drawEnemy(ctx, enemy, camXr, camYr);
      }

      // Player
      drawPlayer(ctx, player, camXr, camYr, timestamp);

      // Bullets
      for (const bullet of bulletsRef.current) {
        drawBullet(ctx, bullet, camXr, camYr);
      }

      // Particles
      for (const p of particlesRef.current) {
        drawParticle(ctx, p, camXr, camYr);
      }

      // Safe zone
      drawSafeZone(ctx, safeZoneRef.current, camXr, camYr);

      // Minimap
      drawMinimap(
        ctx,
        player,
        enemiesRef.current,
        safeZoneRef.current,
        pickupsRef.current,
      );

      // Zone damage vignette
      if (distToCenter > zone.radius) {
        const intensity = Math.min(
          0.6,
          ((distToCenter - zone.radius) / 200) * 0.6,
        );
        const vigGrad = ctx.createRadialGradient(
          CANVAS_W / 2,
          CANVAS_H / 2,
          CANVAS_H * 0.3,
          CANVAS_W / 2,
          CANVAS_H / 2,
          CANVAS_H * 0.8,
        );
        vigGrad.addColorStop(0, "transparent");
        vigGrad.addColorStop(1, `rgba(30, 80, 220, ${intensity})`);
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    },
    [collidesWithObstacles, shootBullet, spawnExplosion, spawnBloodSplat],
  );

  // ─── Start game ────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    playerNameRef.current = playerName.trim() || "Soldier";
    resetGame();
    gameStateRef.current = "playing";
    setGameState("playing");
    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [playerName, resetGame, gameLoop]);

  // ─── Save score ────────────────────────────────────────────────────
  const handleSaveScore = useCallback(() => {
    if (!finalStats) return;
    const entry: LeaderboardEntry = {
      name: playerNameRef.current || "Soldier",
      kills: finalStats.kills,
      survivalTime: finalStats.time,
      rank: finalStats.rank,
      date: new Date().toLocaleDateString(),
    };
    saveToLeaderboard(entry);
    setLeaderboard(getLeaderboard());
  }, [finalStats]);

  // ─── Input ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        [
          "w",
          "W",
          "a",
          "A",
          "s",
          "S",
          "d",
          "D",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          " ",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
      keysRef.current.add(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      mouseRef.current.x = (e.clientX - rect.left) * scaleX;
      mouseRef.current.y = (e.clientY - rect.top) * scaleY;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.down = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.down = false;
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas?.addEventListener("mousemove", onMouseMove);
    canvas?.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas?.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas?.removeEventListener("mousemove", onMouseMove);
      canvas?.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas?.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ─── Save leaderboard on game over ────────────────────────────────
  useEffect(() => {
    if (gameState === "gameover" && finalStats) {
      handleSaveScore();
    }
  }, [gameState, finalStats, handleSaveScore]);

  const weaponLabel: Record<WeaponType, string> = {
    pistol: "PISTOL",
    rifle: "ASSAULT RIFLE",
    shotgun: "SHOTGUN",
  };
  const weaponColor: Record<WeaponType, string> = {
    pistol: "#ffcc44",
    rifle: "#44aaff",
    shotgun: "#ff8844",
  };

  // ─── Joystick handlers ────────────────────────────────────────────
  const handleJoyStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    joyRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      dx: 0,
      dy: 0,
    };
  }, []);

  const handleJoyMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!joyRef.current.active) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joyRef.current.startX;
    const dy = touch.clientY - joyRef.current.startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const maxR = 40;
    if (len > 0) {
      joyRef.current.dx =
        (dx / Math.max(len, maxR)) * (len > maxR ? 1 : len / maxR);
      joyRef.current.dy =
        (dy / Math.max(len, maxR)) * (len > maxR ? 1 : len / maxR);
    }
  }, []);

  const handleJoyEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    joyRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at center, #0d1a0a 0%, #060d04 100%)",
        fontFamily: "'Sora', 'General Sans', sans-serif",
        padding: "8px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Atmospheric background scanlines */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Title bar */}
      <div
        style={{
          marginBottom: 8,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#88ff44",
            textShadow:
              "0 0 20px rgba(136,255,68,0.6), 0 0 40px rgba(136,255,68,0.3)",
            margin: 0,
            lineHeight: 1,
          }}
        >
          ⚔ BATTLE ZONE
        </h1>
        <p
          style={{
            color: "rgba(136,200,80,0.5)",
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            margin: "2px 0 0",
          }}
        >
          BATTLE ROYALE · LAST SQUAD STANDING
        </p>
      </div>

      {/* Canvas wrapper */}
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          height: CANVAS_H,
          maxWidth: "100vw",
          maxHeight: "calc(100vh - 120px)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow:
            "0 0 40px rgba(100,200,50,0.15), 0 0 80px rgba(50,100,20,0.1), 0 8px 40px rgba(0,0,0,0.8)",
          border: "1px solid rgba(100,200,50,0.2)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", width: "100%", height: "100%" }}
          tabIndex={0}
        />

        {/* ── HUD (during play) ── */}
        {gameState === "playing" && (
          <>
            {/* Top-left: Health + Armor */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                pointerEvents: "none",
                minWidth: 160,
              }}
            >
              {/* Health */}
              <div style={{ marginBottom: 5 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      color: "#ff4444",
                      fontSize: "0.6rem",
                      letterSpacing: "0.1em",
                      fontWeight: 700,
                    }}
                  >
                    ❤ HP
                  </span>
                  <span
                    style={{
                      color: "#ff6666",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      fontFamily: "monospace",
                    }}
                  >
                    {health}
                  </span>
                </div>
                <div
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    borderRadius: 3,
                    overflow: "hidden",
                    height: 8,
                    width: 150,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, health)}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #cc2222, #ff4444)",
                      boxShadow: "0 0 6px rgba(255,68,68,0.6)",
                      transition: "width 0.1s ease",
                    }}
                  />
                </div>
              </div>
              {/* Armor */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      color: "#4488ff",
                      fontSize: "0.6rem",
                      letterSpacing: "0.1em",
                      fontWeight: 700,
                    }}
                  >
                    🛡 AR
                  </span>
                  <span
                    style={{
                      color: "#66aaff",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      fontFamily: "monospace",
                    }}
                  >
                    {armor}
                  </span>
                </div>
                <div
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    borderRadius: 3,
                    overflow: "hidden",
                    height: 8,
                    width: 150,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, armor)}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #2244cc, #4488ff)",
                      boxShadow: "0 0 6px rgba(68,136,255,0.6)",
                      transition: "width 0.1s ease",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Top-right: Kills + Players */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 160,
                textAlign: "right",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  color: "#88ff44",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  fontWeight: 700,
                  textShadow: "0 0 8px rgba(136,255,68,0.6)",
                }}
              >
                KILLS: {kills}
              </div>
              <div
                style={{
                  color: "rgba(200,255,150,0.7)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.08em",
                }}
              >
                ALIVE: {playersRemaining}
              </div>
            </div>

            {/* Top-center: Zone timer */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  color: "#6699ff",
                  fontSize: "0.6rem",
                  letterSpacing: "0.15em",
                }}
              >
                ◉ SAFE ZONE
              </div>
              <div
                style={{
                  color: zoneTimer < 15 ? "#ff4444" : "#88aaff",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  textShadow:
                    zoneTimer < 15
                      ? "0 0 10px rgba(255,68,68,0.8)"
                      : "0 0 8px rgba(136,170,255,0.6)",
                }}
              >
                {formatTime(zoneTimer)}
              </div>
            </div>

            {/* Bottom-right: Weapon + Ammo */}
            <div
              style={{
                position: "absolute",
                bottom: isMobile ? 110 : 10,
                right: 155,
                textAlign: "right",
                pointerEvents: "none",
                background: "rgba(0,0,0,0.55)",
                borderRadius: 6,
                padding: "5px 10px",
                border: `1px solid ${weaponColor[weapon]}44`,
              }}
            >
              <div
                style={{
                  color: weaponColor[weapon],
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                {weaponLabel[weapon]}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                }}
              >
                {ammo === -1 ? "∞" : ammo} ROUNDS
              </div>
            </div>

            {/* Controls reminder (top, semi-transparent) */}
            {!isMobile && (
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: "rgba(150,200,100,0.3)",
                  fontSize: "0.5rem",
                  letterSpacing: "0.08em",
                  pointerEvents: "none",
                  textAlign: "center",
                }}
              >
                WASD MOVE · MOUSE AIM · CLICK SHOOT · Q SWAP WEAPON
              </div>
            )}

            {/* Mobile controls */}
            {isMobile && (
              <>
                {/* Left joystick */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.4)",
                    border: "2px solid rgba(136,255,68,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(136,255,68,0.4)",
                    fontSize: "1.2rem",
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  onTouchStart={handleJoyStart}
                  onTouchMove={handleJoyMove}
                  onTouchEnd={handleJoyEnd}
                  onTouchCancel={handleJoyEnd}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "rgba(136,255,68,0.25)",
                      border: "1px solid rgba(136,255,68,0.4)",
                    }}
                  />
                </div>

                {/* Shoot button */}
                <button
                  type="button"
                  style={{
                    position: "absolute",
                    bottom: 25,
                    right: 165,
                    width: 70,
                    height: 70,
                    borderRadius: "50%",
                    background: shootBtnRef.current
                      ? "rgba(255,80,40,0.5)"
                      : "rgba(255,80,40,0.25)",
                    border: "2px solid rgba(255,100,50,0.5)",
                    color: "rgba(255,150,100,0.9)",
                    fontSize: "1.4rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    shootBtnRef.current = true;
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    shootBtnRef.current = false;
                  }}
                  onTouchCancel={() => {
                    shootBtnRef.current = false;
                  }}
                >
                  🔥
                </button>
              </>
            )}
          </>
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
              background: "rgba(5,12,3,0.92)",
              backdropFilter: "blur(4px)",
              gap: 14,
            }}
          >
            {/* Title */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: "3rem",
                  fontWeight: 900,
                  color: "#88ff44",
                  textShadow:
                    "0 0 30px rgba(136,255,68,0.7), 0 0 60px rgba(136,255,68,0.3)",
                  letterSpacing: "0.1em",
                  lineHeight: 1,
                }}
              >
                ⚔ BATTLE
                <br />
                ZONE
              </div>
              <div
                style={{
                  color: "rgba(150,220,80,0.5)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.2em",
                  marginTop: 4,
                }}
              >
                TOP-DOWN BATTLE ROYALE
              </div>
            </div>

            {/* How to play */}
            <div
              style={{
                background: "rgba(0,30,0,0.7)",
                border: "1px solid rgba(100,200,50,0.2)",
                borderRadius: 10,
                padding: "12px 20px",
                color: "rgba(180,240,120,0.8)",
                fontSize: "0.72rem",
                lineHeight: 1.9,
                textAlign: "center",
                maxWidth: 300,
              }}
            >
              <div
                style={{
                  color: "#88ff44",
                  fontWeight: 700,
                  marginBottom: 4,
                  letterSpacing: "0.1em",
                }}
              >
                HOW TO PLAY
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "2px 8px",
                  textAlign: "left",
                }}
              >
                <span style={{ color: "#88ff44" }}>WASD</span>
                <span>Move</span>
                <span style={{ color: "#88ff44" }}>MOUSE</span>
                <span>Aim</span>
                <span style={{ color: "#88ff44" }}>CLICK</span>
                <span>Shoot</span>
                <span style={{ color: "#88ff44" }}>Q</span>
                <span>Swap weapon</span>
                <span style={{ color: "#88ff44" }}>WALK</span>
                <span>Pick up weapons</span>
              </div>
            </div>

            {/* Name input */}
            <input
              type="text"
              placeholder="Enter your callsign..."
              value={playerName}
              maxLength={16}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startGame()}
              style={{
                width: 220,
                padding: "9px 14px",
                background: "rgba(0,40,0,0.6)",
                border: "1px solid rgba(100,200,50,0.3)",
                borderRadius: 8,
                color: "#ccff88",
                fontSize: "0.85rem",
                outline: "none",
                textAlign: "center",
                fontFamily: "'Sora', sans-serif",
              }}
            />

            <button
              type="button"
              onClick={startGame}
              style={{
                padding: "12px 40px",
                background: "linear-gradient(135deg, #558822, #336611)",
                border: "1px solid rgba(136,255,68,0.5)",
                borderRadius: 50,
                color: "#ccff88",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                cursor: "pointer",
                boxShadow:
                  "0 0 24px rgba(100,200,50,0.4), 0 4px 16px rgba(0,0,0,0.5)",
                transition: "all 0.15s ease",
                fontFamily: "'Fraunces', Georgia, serif",
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
              DROP IN!
            </button>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div
                style={{
                  width: 280,
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(100,200,50,0.15)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    color: "#88ff44",
                    fontSize: "0.6rem",
                    letterSpacing: "0.16em",
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  🏆 TOP SURVIVORS
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: "3px 8px",
                    fontSize: "0.68rem",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "rgba(150,200,80,0.5)" }}>#</span>
                  <span style={{ color: "rgba(150,200,80,0.5)" }}>NAME</span>
                  <span style={{ color: "rgba(150,200,80,0.5)" }}>KILLS</span>
                  <span style={{ color: "rgba(150,200,80,0.5)" }}>TIME</span>
                  {leaderboard.slice(0, 5).map((e, i) => (
                    <React.Fragment key={`lb1-${e.name}-${i}`}>
                      <span
                        style={{
                          color: i === 0 ? "#FFD700" : "rgba(200,255,150,0.6)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          color: i === 0 ? "#FFD700" : "rgba(200,255,150,0.8)",
                          fontWeight: i === 0 ? 700 : 400,
                        }}
                      >
                        {e.name}
                      </span>
                      <span style={{ color: "#ff6644", fontWeight: 700 }}>
                        {e.kills}
                      </span>
                      <span style={{ color: "rgba(150,200,100,0.7)" }}>
                        {formatTime(e.survivalTime)}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Game Over Screen ── */}
        {gameState === "gameover" && finalStats && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(5,12,3,0.9)",
              backdropFilter: "blur(4px)",
              gap: 12,
            }}
          >
            {finalStats.rank === 1 ? (
              <div
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: "#FFD700",
                  textShadow: "0 0 20px rgba(255,215,0,0.7)",
                  textAlign: "center",
                  letterSpacing: "0.08em",
                }}
              >
                🏆 WINNER
                <br />
                WINNER!
              </div>
            ) : (
              <div
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: "#ff4444",
                  textShadow: "0 0 20px rgba(255,68,68,0.7)",
                  textAlign: "center",
                  letterSpacing: "0.08em",
                }}
              >
                ☠ ELIMINATED
              </div>
            )}

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  color: "rgba(150,200,80,0.6)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.14em",
                }}
              >
                RANK
              </div>
              <div
                style={{
                  color: "#88ff44",
                  fontSize: "2rem",
                  fontWeight: 800,
                  fontFamily: "monospace",
                  textShadow: "0 0 12px rgba(136,255,68,0.6)",
                }}
              >
                #{finalStats.rank}
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 24px",
                background: "rgba(0,30,0,0.6)",
                border: "1px solid rgba(100,200,50,0.2)",
                borderRadius: 10,
                padding: "12px 24px",
                textAlign: "center",
              }}
            >
              <div>
                <div
                  style={{
                    color: "rgba(150,200,80,0.5)",
                    fontSize: "0.55rem",
                    letterSpacing: "0.12em",
                  }}
                >
                  KILLS
                </div>
                <div
                  style={{
                    color: "#ff6644",
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    fontFamily: "monospace",
                  }}
                >
                  {finalStats.kills}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: "rgba(150,200,80,0.5)",
                    fontSize: "0.55rem",
                    letterSpacing: "0.12em",
                  }}
                >
                  SURVIVED
                </div>
                <div
                  style={{
                    color: "#88aaff",
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    fontFamily: "monospace",
                  }}
                >
                  {formatTime(finalStats.time)}
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div
                style={{
                  width: 280,
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(100,200,50,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    color: "#88ff44",
                    fontSize: "0.6rem",
                    letterSpacing: "0.14em",
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  🏆 LEADERBOARD
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: "3px 8px",
                    fontSize: "0.68rem",
                  }}
                >
                  {leaderboard.slice(0, 5).map((e, i) => (
                    <React.Fragment key={`lb2-${e.name}-${i}`}>
                      <span
                        style={{
                          color: i === 0 ? "#FFD700" : "rgba(150,200,80,0.5)",
                        }}
                      >
                        {i + 1}.
                      </span>
                      <span
                        style={{
                          color: i === 0 ? "#FFD700" : "rgba(200,255,150,0.8)",
                        }}
                      >
                        {e.name}
                      </span>
                      <span style={{ color: "#ff6644" }}>{e.kills}K</span>
                      <span style={{ color: "rgba(150,200,100,0.6)" }}>
                        {formatTime(e.survivalTime)}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={startGame}
              style={{
                padding: "12px 40px",
                background: "linear-gradient(135deg, #558822, #336611)",
                border: "1px solid rgba(136,255,68,0.5)",
                borderRadius: 50,
                color: "#ccff88",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                cursor: "pointer",
                boxShadow:
                  "0 0 24px rgba(100,200,50,0.4), 0 4px 16px rgba(0,0,0,0.5)",
                transition: "all 0.15s ease",
                fontFamily: "'Fraunces', Georgia, serif",
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
      </div>

      {/* Add to Home Screen Banner */}
      {showInstallBanner && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,40,0,0.85)",
            border: "1px solid rgba(136,255,68,0.35)",
            borderRadius: 10,
            padding: "8px 14px",
            zIndex: 10,
            maxWidth: 380,
            width: "100%",
            boxShadow: "0 0 16px rgba(100,200,50,0.15)",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>📲</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                color: "#88ff44",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              Home Screen par Add karo
            </div>
            <div style={{ color: "rgba(150,220,80,0.6)", fontSize: "0.6rem" }}>
              Game seedha phone se kholo -- bilkul app ki tarah
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            style={{
              padding: "6px 14px",
              background: "linear-gradient(135deg, #558822, #336611)",
              border: "1px solid rgba(136,255,68,0.5)",
              borderRadius: 20,
              color: "#ccff88",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setShowInstallBanner(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(150,200,80,0.4)",
              fontSize: "1rem",
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          marginTop: 10,
          color: "rgba(100,150,60,0.4)",
          fontSize: "0.6rem",
          letterSpacing: "0.1em",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(136,200,60,0.5)", textDecoration: "none" }}
        >
          Built with ♥ using caffeine.ai
        </a>
      </p>
    </div>
  );
};

export default BattleZoneGame;
