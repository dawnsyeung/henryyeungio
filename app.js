const canvas = document.getElementById("tree-canvas");
const ctx = canvas.getContext("2d");
const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const paceEl = document.getElementById("pace");
const resetBtn = document.getElementById("reset-btn");

const config = {
  gravity: 2200,
  jumpVelocity: 940,
  baseSpeed: 260,
  maxSpeedBoost: 220,
  coyoteTime: 0.12,
  jumpBuffer: 0.16,
  platformHeight: 56,
};

const state = {
  player: null,
  platforms: [],
  particles: [],
  cameraX: 0,
  distance: 0,
  bestDistance: 0,
  lastTime: 0,
  isRunning: true,
  spawnX: 0,
  jumpGrace: 0,
  jumpBufferTimer: 0,
  onGround: false,
  startX: 0,
  speed: config.baseSpeed,
};

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createPlayer() {
  return {
    x: 80,
    y: canvas.height - 220,
    width: 44,
    height: 44,
    vy: 0,
  };
}

function createPlatform(x, y, width) {
  return {
    x,
    y,
    width,
    height: config.platformHeight,
  };
}

function resetGame() {
  state.player = createPlayer();
  state.platforms = [];
  state.particles = [];
  state.cameraX = 0;
  state.distance = 0;
  state.spawnX = -200;
  state.jumpGrace = 0;
  state.jumpBufferTimer = 0;
  state.onGround = false;
  state.startX = state.player.x;
  state.isRunning = true;
  state.lastTime = 0;
  state.speed = config.baseSpeed;
  seedWorld();
  updateHud();
}

function seedWorld() {
  const baseY = canvas.height - 110;
  state.platforms.push(createPlatform(-320, baseY, 720));
  state.spawnX = 420;
  ensurePlatforms();
}

function ensurePlatforms() {
  const lookAhead = state.player.x + 1600;
  while (state.spawnX < lookAhead) {
    const prev = state.platforms[state.platforms.length - 1];
    const gap = randomRange(110, 220 + Math.min(140, state.distance * 0.25));
    const width = randomRange(120, 260);
    const variance = randomRange(-120, 120);
    const minY = canvas.height - 320;
    const maxY = canvas.height - 140;
    const y = clamp(prev.y + variance, minY, maxY);
    const platform = createPlatform(state.spawnX + gap, y, width);
    state.platforms.push(platform);
    state.spawnX = platform.x + platform.width;
  }
}

function cullPlatforms() {
  const cutoff = state.cameraX - 300;
  state.platforms = state.platforms.filter((platform) => platform.x + platform.width > cutoff);
}

function update(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  if (state.isRunning) {
    updateGame(dt);
  } else {
    updateParticles(dt);
  }

  render();
  requestAnimationFrame(update);
}

function updateGame(dt) {
  if (state.jumpGrace > 0) state.jumpGrace -= dt;
  if (state.jumpBufferTimer > 0) state.jumpBufferTimer -= dt;

  const player = state.player;
  const prevY = player.y;

  state.speed = config.baseSpeed + Math.min(config.maxSpeedBoost, state.distance * 0.8);
  player.x += state.speed * dt;

  player.vy += config.gravity * dt;
  player.y += player.vy * dt;

  handleCollisions(prevY);

  if (state.jumpBufferTimer > 0 && (state.onGround || state.jumpGrace > 0)) {
    performJump();
  }

  state.cameraX = Math.max(0, player.x - 320);
  ensurePlatforms();
  cullPlatforms();

  state.distance = Math.max(0, Math.floor((player.x - state.startX) / 8));
  updateParticles(dt);

  if (player.y > canvas.height + 240) {
    endRun();
  }
  updateHud();
}

function handleCollisions(prevY) {
  const player = state.player;
  const wasGrounded = state.onGround;
  state.onGround = false;

  const prevBottom = prevY + player.height;
  const bottom = player.y + player.height;

  for (const platform of state.platforms) {
    if (player.x + player.width < platform.x || player.x > platform.x + platform.width) continue;
    const platformTop = platform.y;
    if (prevBottom <= platformTop && bottom >= platformTop) {
      player.y = platformTop - player.height;
      player.vy = 0;
      state.onGround = true;
      state.jumpGrace = config.coyoteTime;
      if (!wasGrounded) {
        emitLandingDust(player.x + player.width / 2, platformTop);
      }
    }
  }
}

function performJump() {
  state.player.vy = -config.jumpVelocity;
  state.onGround = false;
  state.jumpGrace = 0;
  state.jumpBufferTimer = 0;
}

function endRun() {
  state.isRunning = false;
  state.bestDistance = Math.max(state.bestDistance, state.distance);
  updateHud();
}

function queueJump() {
  state.jumpBufferTimer = config.jumpBuffer;
}

function emitLandingDust(x, y) {
  for (let i = 0; i < 12; i += 1) {
    const angle = randomRange(Math.PI, 2 * Math.PI);
    const speed = randomRange(60, 160);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.4,
      life: 0,
      maxLife: 0.4,
    });
  }
}

function createLightGarlands() {
  const layers = [
    { y: 200, spread: 200, count: 12 },
    { y: 275, spread: 260, count: 14 },
    { y: 350, spread: 300, count: 16 },
    { y: 430, spread: 340, count: 18 },
  ];
  const lights = [];
  layers.forEach((layer, layerIndex) => {
    for (let i = 0; i < layer.count; i += 1) {
      const t = i / (layer.count - 1);
      const offset = (t - 0.5) * layer.spread;
      const wobble = Math.sin(t * Math.PI * 2 + layerIndex) * 14;
      lights.push({
        x: canvas.width / 2 + offset,
        y: layer.y + wobble,
        hue: 10 + Math.random() * 320,
        phase: Math.random() * Math.PI * 2,
      });
    }
  });
  return lights;
}

function updateHud() {
  distanceEl.textContent = `${state.distance}m`;
  bestEl.textContent = `${state.bestDistance}m`;
  const blocksPerSecond = (state.speed / 60).toFixed(1);
  paceEl.textContent = `${blocksPerSecond} b/s`;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#030920");
  gradient.addColorStop(0.5, "#061c2d");
  gradient.addColorStop(1, "#0b2a2f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < canvas.width; i += 80) {
    ctx.fillRect(i, canvas.height - 120, 40, 120);
  }
  ctx.restore();

  ctx.save();
  const snowGradient = ctx.createLinearGradient(0, canvas.height - 120, 0, canvas.height);
  snowGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  snowGradient.addColorStop(1, "rgba(255, 255, 255, 0.35)");
  ctx.fillStyle = snowGradient;
  ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
  ctx.restore();
}

function drawTreeBody() {
  const centerX = canvas.width / 2;
  const layers = 4;
  for (let i = 0; i < layers; i += 1) {
    const top = treeGeometry.apex.y + i * 90;
    const height = 120;
    const width = 80 + i * 90;
    const gradient = ctx.createLinearGradient(centerX, top, centerX, top + height);
    gradient.addColorStop(0, "#0f5f3d");
    gradient.addColorStop(0.5, "#0d4c32");
    gradient.addColorStop(1, "#0a3725");
    ctx.beginPath();
    ctx.moveTo(centerX, top);
    ctx.lineTo(centerX - width, top + height);
    ctx.lineTo(centerX + width, top + height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // trunk
  ctx.fillStyle = "#6f3c1f";
  ctx.fillRect(centerX - 30, treeGeometry.leftBase.y, 60, treeGeometry.trunkHeight);
}

function drawGarlands() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 223, 186, 0.3)";
  ctx.lineWidth = 3;
  const segments = 4;
  const centerX = canvas.width / 2;
  for (let i = 0; i < segments; i += 1) {
    const y = 190 + i * 80;
    const width = 120 + i * 70;
    ctx.beginPath();
    ctx.moveTo(centerX - width, y - 10);
    ctx.quadraticCurveTo(centerX, y + 30, centerX + width, y - 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLights(time) {
  ctx.save();
  ctx.shadowBlur = 12;
  state.lights.forEach((light, index) => {
    const pulse = (Math.sin(time * 0.003 + light.phase) + 1) / 2;
    const intensity = 0.4 + pulse * state.twinkle;
    ctx.shadowColor = `hsla(${light.hue}, 80%, 70%, ${intensity})`;
    ctx.fillStyle = `hsla(${light.hue}, 85%, ${65 + pulse * 20}%, ${intensity})`;
    ctx.beginPath();
    ctx.arc(light.x, light.y, 5 + Math.sin(index) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawOrnaments(time) {
  state.ornaments.forEach((ornament) => {
    const spec = ornamentCatalog[ornament.type] ?? ornamentCatalog.classic;
    ctx.save();
    const sway = Math.sin(time * 0.0012 + ornament.swayOffset) * 2;
    ctx.translate(ornament.x + sway, ornament.y);
    ctx.rotate(ornament.rotation * 0.05);
    switch (spec.shape) {
      case "flake":
        drawFlake(spec);
        break;
      case "bell":
        drawBell(spec);
        break;
      case "drop":
        drawDrop(spec);
        break;
      case "star":
        drawStar(spec);
        break;
      default:
        drawRound(spec);
    }
    ctx.restore();
  });
}

function drawRound(spec) {
  const gradient = ctx.createRadialGradient(0, 0, 4, -4, -4, spec.size);
  gradient.addColorStop(0, spec.accent);
  gradient.addColorStop(1, spec.color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, spec.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = spec.accent;
  ctx.beginPath();
  ctx.arc(-4, -6, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlake(spec) {
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * spec.size, Math.sin(angle) * spec.size);
  }
  ctx.stroke();
}

function drawBell(spec) {
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.moveTo(-spec.size * 0.6, -spec.size * 0.2);
  ctx.quadraticCurveTo(0, -spec.size * 1.2, spec.size * 0.6, -spec.size * 0.2);
  ctx.lineTo(spec.size * 0.5, spec.size * 0.6);
  ctx.quadraticCurveTo(0, spec.size * 0.9, -spec.size * 0.5, spec.size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = spec.accent;
  ctx.fillRect(-spec.size * 0.4, spec.size * 0.35, spec.size * 0.8, 3);
  ctx.beginPath();
  ctx.arc(0, spec.size * 0.7, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrop(spec) {
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.moveTo(0, -spec.size);
  ctx.quadraticCurveTo(spec.size, -spec.size * 0.2, 0, spec.size);
  ctx.quadraticCurveTo(-spec.size, -spec.size * 0.2, 0, -spec.size);
  ctx.fill();
  ctx.fillStyle = spec.accent;
  ctx.beginPath();
  ctx.arc(-3, -spec.size * 0.2, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(spec) {
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  const spikes = 5;
  const outerRadius = spec.size;
  const innerRadius = spec.size * 0.4;
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / spikes) * i;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSnow() {
  if (!state.snowEnabled) return;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  state.snowflakes.forEach((flake) => {
    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawTreeTopper(time) {
  ctx.save();
  const pulse = (Math.sin(time * 0.004) + 1) / 2;
  const radius = 20 + pulse * 4;
  ctx.translate(treeGeometry.apex.x, treeGeometry.apex.y + 10);
  ctx.fillStyle = `rgba(255, 247, 160, ${0.7 + pulse * 0.3})`;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 5) * i;
    const r = i % 2 === 0 ? radius : radius * 0.4;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function loop(timestamp) {
  if (!state.lastFrame) state.lastFrame = timestamp;
  const dt = Math.min(0.033, (timestamp - state.lastFrame) / 1000);
  state.lastFrame = timestamp;

  updateSnow(dt);

  drawBackground();
  drawSnow();
  drawTreeBody();
  drawGarlands();
  drawLights(timestamp);
  drawOrnaments(timestamp);
  drawTreeTopper(timestamp);

  requestAnimationFrame(loop);
}

setSelectedType("classic");
updateStats();
requestAnimationFrame(loop);
