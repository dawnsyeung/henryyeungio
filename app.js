const canvas = document.getElementById("track-canvas");
const ctx = canvas?.getContext("2d");
const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const paceEl = document.getElementById("pace");
const resetBtn = document.getElementById("reset-btn");
const pauseBtn = document.getElementById("pause-btn");
const bestStorageKey = "blockstep-best";

const config = {
  gravity: 2400,
  jumpVelocity: 980,
  baseSpeed: 280,
  maxSpeedBoost: 260,
  coyoteTime: 0.12,
  jumpBuffer: 0.16,
  platformHeight: 56,
  trailInterval: 0.08,
};

const state = {
  player: null,
  platforms: [],
  particles: [],
  cameraX: 0,
  distance: 0,
  bestDistance: loadBestDistance(),
  lastTime: 0,
  isRunning: true,
  paused: false,
  spawnX: 0,
  jumpGrace: 0,
  jumpBufferTimer: 0,
  onGround: false,
  startX: 0,
  speed: config.baseSpeed,
  trailTimer: 0,
};

function loadBestDistance() {
  try {
    const stored = localStorage.getItem(bestStorageKey);
    return stored ? Number(stored) : 0;
  } catch {
    return 0;
  }
}

function saveBestDistance() {
  try {
    localStorage.setItem(bestStorageKey, String(state.bestDistance));
  } catch {
    // ignore storage errors
  }
}

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
  state.trailTimer = 0;
  state.startX = state.player.x;
  state.isRunning = true;
  state.paused = false;
  state.lastTime = 0;
  state.speed = config.baseSpeed;
  seedWorld();
  updateHud();
  setPauseLabel();
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
  const cutoff = state.cameraX - 400;
  state.platforms = state.platforms.filter((platform) => platform.x + platform.width > cutoff);
}

function update(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  let dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  if (state.paused) {
    dt = 0;
  }

  if (state.isRunning && dt) {
    updateGame(dt);
  } else {
    updateParticles(dt || 0.016);
  }

  render(timestamp);
  requestAnimationFrame(update);
}

function updateGame(dt) {
  state.jumpGrace = Math.max(0, state.jumpGrace - dt);
  state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);

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
  state.trailTimer += dt;
  if (state.onGround && state.trailTimer >= config.trailInterval) {
    spawnTrailDust();
    state.trailTimer = 0;
  }

  updateParticles(dt);

  if (player.y > canvas.height + 260) {
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
      break;
    }
  }
}

function spawnTrailDust() {
  const player = state.player;
  state.particles.push({
    x: player.x + player.width / 2,
    y: player.y + player.height,
    vx: randomRange(-40, 40),
    vy: randomRange(40, 90),
    life: 0,
    maxLife: 0.25,
    color: "rgba(255,255,255,0.35)",
    size: randomRange(3, 6),
  });
}

function performJump() {
  state.player.vy = -config.jumpVelocity;
  state.onGround = false;
  state.jumpGrace = 0;
  state.jumpBufferTimer = 0;
}

function endRun() {
  state.isRunning = false;
  if (state.distance > state.bestDistance) {
    state.bestDistance = state.distance;
    saveBestDistance();
  }
  updateHud();
}

function queueJump() {
  state.jumpBufferTimer = config.jumpBuffer;
}

function emitLandingDust(x, y) {
  for (let i = 0; i < 12; i += 1) {
    const angle = randomRange(Math.PI, 2 * Math.PI);
    const speed = randomRange(120, 220);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.6,
      life: 0,
      maxLife: 0.45,
      color: "rgba(240, 247, 255, 0.45)",
      size: randomRange(2, 4),
    });
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.life += dt;
    if (particle.life > particle.maxLife) return false;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += config.gravity * 0.6 * dt;
    return true;
  });
}

function setPaused(value) {
  if (!state.isRunning && !value) return;
  state.paused = value;
  setPauseLabel();
  if (!state.paused) {
    state.lastTime = 0;
  }
}

function togglePause() {
  setPaused(!state.paused);
}

function setPauseLabel() {
  if (pauseBtn) {
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  }
}

function updateHud() {
  if (distanceEl) distanceEl.textContent = `${state.distance}m`;
  if (bestEl) bestEl.textContent = `${state.bestDistance}m`;
  if (paceEl) {
    const blocksPerSecond = (state.speed / 60).toFixed(1);
    paceEl.textContent = `${blocksPerSecond} b/s`;
  }
}

function render(time = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(time);
  drawParallax(time);
  drawPlatforms();
  drawParticles();
  drawPlayer(time);
  drawSpeedBar();

  if (!state.isRunning) {
    drawOverlay("Run Over", "Press R or Reset Run to try again");
  } else if (state.paused) {
    drawOverlay("Paused", "Press P or Resume to keep running");
  }
}

function drawBackground(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#041836");
  gradient.addColorStop(0.6, "#082238");
  gradient.addColorStop(1, "#0a1f24");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  const stripeOffset = (time * 0.03) % 120;
  for (let x = -stripeOffset; x < canvas.width; x += 120) {
    ctx.fillRect(x, canvas.height - 140, 60, 140);
  }
  ctx.restore();
}

function drawParallax(time) {
  ctx.save();
  ctx.fillStyle = "rgba(7, 32, 52, 0.6)";
  const horizon = canvas.height - 160;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  const waveOffset = (state.cameraX * 0.05 + time * 0.04) % canvas.width;
  for (let x = -200; x < canvas.width + 200; x += 120) {
    const peak = horizon + Math.sin((x + waveOffset) * 0.01) * 30;
    ctx.lineTo(x, peak);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlatforms() {
  ctx.save();
  for (const platform of state.platforms) {
    const screenX = platform.x - state.cameraX;
    const screenY = platform.y;
    if (screenX + platform.width < -10 || screenX > canvas.width + 10) continue;
    const gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + platform.height);
    gradient.addColorStop(0, "#265c69");
    gradient.addColorStop(1, "#14323c");
    ctx.fillStyle = gradient;
    ctx.fillRect(screenX, screenY, platform.width, platform.height);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(screenX, screenY, platform.width, 4);
  }
  ctx.restore();
}

function drawPlayer(time) {
  const player = state.player;
  const screenX = player.x - state.cameraX;
  ctx.save();
  ctx.translate(screenX, player.y);
  ctx.fillStyle = "#f7fffd";
  ctx.shadowColor = "rgba(123,255,155,0.45)";
  ctx.shadowBlur = 18;
  ctx.fillRect(0, 0, player.width, player.height);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff8a5c";
  ctx.fillRect(6, 8, player.width - 12, player.height / 2);
  ctx.fillStyle = "#1b2d3f";
  ctx.fillRect(6, player.height - 10, player.width - 12, 10);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const bob = Math.sin(time * 0.01) * 3;
  ctx.beginPath();
  ctx.arc(player.width / 2, -6 + bob, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const particle of state.particles) {
    const alpha = 1 - particle.life / particle.maxLife;
    ctx.fillStyle = particle.color ?? `rgba(255,255,255,${alpha * 0.6})`;
    const screenX = particle.x - state.cameraX;
    const size = particle.size ?? 3;
    ctx.beginPath();
    ctx.arc(screenX, particle.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpeedBar() {
  const pct = clamp((state.speed - config.baseSpeed) / config.maxSpeedBoost, 0, 1);
  const barWidth = canvas.width * 0.4;
  const barHeight = 12;
  const x = canvas.width - barWidth - 32;
  const y = canvas.height - 32;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, y, barWidth, barHeight);
  const gradient = ctx.createLinearGradient(x, y, x + barWidth, y);
  gradient.addColorStop(0, "#5ef2ff");
  gradient.addColorStop(1, "#ff8a5c");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, barWidth * pct, barHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);
  ctx.restore();
}

function drawOverlay(title, subtitle) {
  ctx.save();
  ctx.fillStyle = "rgba(4, 10, 18, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f6fffb";
  ctx.font = "700 48px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "500 20px Montserrat, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
  ctx.restore();
}

function handleKeyDown(event) {
  if (event.repeat) return;
  switch (event.key) {
    case " ":
    case "Spacebar":
    case "ArrowUp":
    case "ArrowDown":
    case "w":
    case "W":
      event.preventDefault();
      queueJump();
      break;
    case "r":
    case "R":
      resetGame();
      break;
    case "p":
    case "P":
      togglePause();
      break;
    default:
      break;
  }
}

function handlePointer(event) {
  event.preventDefault();
  queueJump();
}

function attachEvents() {
  if (resetBtn) resetBtn.addEventListener("click", resetGame);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  canvas.addEventListener("pointerdown", handlePointer);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("blur", () => setPaused(true));
}

function init() {
  if (!canvas || !ctx) return;
  attachEvents();
  resetGame();
  requestAnimationFrame(update);
}

init();
