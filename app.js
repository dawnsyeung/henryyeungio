const canvas = document.getElementById("track-canvas");
const ctx = canvas?.getContext("2d");
const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const paceEl = document.getElementById("pace");
const checkpointEl = document.getElementById("checkpoint");
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
  checkpointInterval: 250,
  checkpointToastDuration: 2.5,
  respawnFlashDuration: 0.6,
  checkpointRespawnDelay: 2,
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
  checkpoints: [],
  checkpointCounter: 0,
  nextCheckpointDistance: 0,
  lastUnlockedCheckpointDistance: null,
  checkpointToastTimer: 0,
  checkpointToastText: "",
  respawnFlashTimer: 0,
  lastGroundPlatform: null,
  maxDistanceThisRun: 0,
  pendingRespawn: null,
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

function formatSeconds(value) {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
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
  state.checkpoints = [];
  state.checkpointCounter = 0;
  state.nextCheckpointDistance = config.checkpointInterval;
  state.lastUnlockedCheckpointDistance = null;
  state.checkpointToastTimer = 0;
  state.checkpointToastText = "";
  state.respawnFlashTimer = 0;
  state.lastGroundPlatform = null;
  state.maxDistanceThisRun = 0;
  state.pendingRespawn = null;
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
  state.platforms = state.platforms.filter((platform) => {
    if (platform.checkpointReferences && platform.checkpointReferences > 0) {
      return true;
    }
    return platform.x + platform.width > cutoff;
  });
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

  const waitingForRespawn = processPendingRespawn(dt);
  if (waitingForRespawn) {
    updateCheckpointTimers(dt);
    updateParticles(dt);
    updateHud();
    return;
  }

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
  state.maxDistanceThisRun = Math.max(state.maxDistanceThisRun, state.distance);
  maybePlaceCheckpoint();
  state.trailTimer += dt;
  if (state.onGround && state.trailTimer >= config.trailInterval) {
    spawnTrailDust();
    state.trailTimer = 0;
  }

  updateCheckpointTimers(dt);
  updateParticles(dt);

  if (player.y > canvas.height + 260) {
    if (!tryRespawnFromCheckpoint()) {
      endRun();
    }
  }
  updateHud();
}

function handleCollisions(prevY) {
  const player = state.player;
  const wasGrounded = state.onGround;
  state.onGround = false;
  state.lastGroundPlatform = null;

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
      state.lastGroundPlatform = platform;
      if (!wasGrounded) {
        emitLandingDust(player.x + player.width / 2, platformTop);
      }
      break;
    }
  }
}

function maybePlaceCheckpoint() {
  if (!state.onGround) return;
  if (!state.lastGroundPlatform) return;
  if (state.distance < state.nextCheckpointDistance) return;
  createCheckpoint(state.lastGroundPlatform);
}

function createCheckpoint(platform) {
  state.checkpointCounter += 1;
  const checkpoint = {
    id: state.checkpointCounter,
    x: platform.x + platform.width / 2,
    y: platform.y,
    distance: state.distance,
    platform,
  };
  platform.checkpointReferences = (platform.checkpointReferences || 0) + 1;
  state.checkpoints.push(checkpoint);
  state.nextCheckpointDistance += config.checkpointInterval;
  state.lastUnlockedCheckpointDistance = checkpoint.distance;
  state.checkpointToastText = `Checkpoint ${state.checkpoints.length} • ${checkpoint.distance}m`;
  state.checkpointToastTimer = config.checkpointToastDuration;
  emitCheckpointBeacon(checkpoint);
}

function emitCheckpointBeacon(checkpoint) {
  for (let i = 0; i < 18; i += 1) {
    const angle = randomRange(Math.PI, 2 * Math.PI);
    const speed = randomRange(140, 240);
    state.particles.push({
      x: checkpoint.x,
      y: checkpoint.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.5,
      life: 0,
      maxLife: randomRange(0.35, 0.55),
      color: "rgba(255, 184, 108, 0.65)",
      size: randomRange(2, 4),
    });
  }
}

function tryRespawnFromCheckpoint() {
  if (state.pendingRespawn) {
    return true;
  }
  if (!state.checkpoints.length) {
    return false;
  }
  const checkpoint = state.checkpoints.pop();
  if (checkpoint?.platform && checkpoint.platform.checkpointReferences) {
    checkpoint.platform.checkpointReferences = Math.max(0, checkpoint.platform.checkpointReferences - 1);
  }
  const delay = Math.max(0, config.checkpointRespawnDelay ?? 0);
  if (delay === 0) {
    state.checkpointToastText = `Respawned • ${checkpoint.distance}m`;
    state.checkpointToastTimer = Math.max(state.checkpointToastTimer, 1.4);
    respawnAt(checkpoint);
    return true;
  }
  state.pendingRespawn = {
    checkpoint,
    timer: delay,
  };
  state.checkpointToastText = `Respawning in ${formatSeconds(delay)}s`;
  state.checkpointToastTimer = delay + 0.2;
  return true;
}

function respawnAt(checkpoint) {
  const player = state.player;
  player.x = checkpoint.x - player.width / 2;
  player.y = checkpoint.y - player.height;
  player.vy = 0;
  state.cameraX = Math.max(0, player.x - 320);
  state.jumpGrace = config.coyoteTime;
  state.jumpBufferTimer = 0;
  state.onGround = true;
  state.trailTimer = 0;
  state.speed = config.baseSpeed;
  state.respawnFlashTimer = config.respawnFlashDuration;
  state.lastGroundPlatform = checkpoint.platform ?? null;
  state.distance = Math.max(0, Math.floor((player.x - state.startX) / 8));
  ensurePlatforms();
  cullPlatforms();
}

function processPendingRespawn(dt) {
  if (!state.pendingRespawn) return false;
  const pending = state.pendingRespawn;
  pending.timer = Math.max(0, pending.timer - dt);
  const secondsLeft = Math.max(0, pending.timer);
  const countdownLabel = formatSeconds(secondsLeft);
  state.checkpointToastText = `Respawning in ${countdownLabel}s`;
  state.checkpointToastTimer = Math.max(state.checkpointToastTimer, secondsLeft + 0.2);
  if (pending.timer <= 0) {
    const checkpoint = pending.checkpoint;
    state.pendingRespawn = null;
    state.checkpointToastText = `Respawned • ${checkpoint.distance}m`;
    state.checkpointToastTimer = Math.max(state.checkpointToastTimer, 1.4);
    respawnAt(checkpoint);
    return false;
  }
  return true;
}

function updateCheckpointTimers(dt) {
  if (state.checkpointToastTimer > 0) {
    state.checkpointToastTimer = Math.max(0, state.checkpointToastTimer - dt);
  }
  if (state.respawnFlashTimer > 0) {
    state.respawnFlashTimer = Math.max(0, state.respawnFlashTimer - dt);
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
  const runDistance = Math.max(state.distance, state.maxDistanceThisRun);
  state.distance = runDistance;
  state.maxDistanceThisRun = runDistance;
  if (runDistance > state.bestDistance) {
    state.bestDistance = runDistance;
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
  if (checkpointEl) {
    if (state.lastUnlockedCheckpointDistance === null) {
      checkpointEl.textContent = `Next @ ${state.nextCheckpointDistance}m`;
    } else if (state.checkpoints.length > 0) {
      const banked = state.checkpoints.length;
      const label = banked === 1 ? "charge" : "charges";
      checkpointEl.textContent = `${state.lastUnlockedCheckpointDistance}m • ${banked} ${label}`;
    } else {
      checkpointEl.textContent = `${state.lastUnlockedCheckpointDistance}m • spent`;
    }
  }
}

function render(time = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(time);
  drawParallax(time);
  drawPlatforms();
  drawCheckpoints(time);
  drawParticles();
  drawPlayer(time);
  drawSpeedBar();
  drawCheckpointToast();

  if (!state.isRunning) {
    drawOverlay("Run Over", "Press R or Reset Run to try again");
  } else if (state.paused) {
    drawOverlay("Paused", "Press P or Resume to keep running");
  }
  drawRespawnFlash();
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

function drawCheckpoints(time) {
  if (!state.checkpoints.length) return;
  ctx.save();
  for (const checkpoint of state.checkpoints) {
    const screenX = checkpoint.x - state.cameraX;
    if (screenX < -80 || screenX > canvas.width + 80) continue;
    const poleHeight = 46;
    const pulse = 0.5 + Math.sin((time + checkpoint.id * 32) * 0.008) * 0.25;
    const topY = checkpoint.y - poleHeight;
    ctx.fillStyle = `rgba(255, 188, 110, ${0.35 + pulse * 0.2})`;
    ctx.fillRect(screenX - 3, topY, 6, poleHeight);
    ctx.fillStyle = `rgba(255, 138, 92, ${0.6 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(screenX + 3, topY + 6);
    ctx.lineTo(screenX + 32, topY + 14);
    ctx.lineTo(screenX + 3, topY + 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(screenX - 16, checkpoint.y - 4, 32, 4);
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

function drawCheckpointToast() {
  if (state.checkpointToastTimer <= 0 || !state.checkpointToastText) return;
  const life = state.checkpointToastTimer / config.checkpointToastDuration;
  const fadeIn = clamp(1 - Math.max(0, life - 0.6) / 0.4, 0, 1);
  const alpha = clamp(Math.min(life * 1.1, fadeIn), 0, 1);
  if (alpha <= 0) return;
  const text = state.checkpointToastText;
  ctx.save();
  ctx.font = "600 20px Montserrat, sans-serif";
  const metrics = ctx.measureText(text);
  const paddingX = 22;
  const paddingY = 14;
  const width = metrics.width + paddingX * 2;
  const height = 44;
  const x = (canvas.width - width) / 2;
  const y = 28;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(6, 18, 28, 0.85)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = "#ffdca3";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, y + height / 2);
  ctx.restore();
}

function drawRespawnFlash() {
  if (state.respawnFlashTimer <= 0) return;
  const alpha = clamp(state.respawnFlashTimer / config.respawnFlashDuration, 0, 1);
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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
