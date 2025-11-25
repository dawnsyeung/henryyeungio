const canvas = document.getElementById("track-canvas");
const ctx = canvas?.getContext("2d");
const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const paceEl = document.getElementById("pace");
const checkpointEl = document.getElementById("checkpoint");
const dashEl = document.getElementById("dash");
const timerEl = document.getElementById("timer");
const cornerTimerEl = document.getElementById("corner-timer");
const resetBtn = document.getElementById("reset-btn");
const pauseBtn = document.getElementById("pause-btn");
const dashBtn = document.getElementById("dash-btn");
const dashBtnStateLabel = document.getElementById("dash-btn-state");
const bestStorageKey = "blockstep-best";

const config = {
  gravity: 2400,
  jumpVelocity: 980,
  baseSpeed: 308,
  coyoteTime: 0.12,
  jumpBuffer: 0.16,
  platformHeight: 56,
  platformGapMin: 140,
  platformGapMax: 300,
  platformGapBaseVariance: 26,
  platformGapVarianceGrowth: 34,
  platformWidthMin: 140,
  platformWidthMax: 240,
  platformVerticalVariance: 90,
  trailInterval: 0.08,
  checkpointInterval: 250,
  checkpointToastDuration: 2.5,
  respawnFlashDuration: 0.6,
  checkpointRespawnDelay: 2,
  lavaHeight: 160,
  lavaWaveAmplitude: 18,
  lavaWaveLength: 220,
  forestBaseHeight: 110,
  dashSpeedBonus: 420,
  dashDuration: 0.22,
  dashVerticalBoost: 620,
  dashGravityScale: 0.6,
  dashBuffer: 0.2,
  dashTrailInterval: 0.03,
};

const state = {
  player: null,
  platforms: [],
  particles: [],
  cameraX: 0,
  distance: 0,
  bestDistance: loadBestDistance(),
  lastTime: 0,
  lastPointerTap: 0,
  isRunning: true,
  paused: false,
  spawnX: 0,
  jumpGrace: 0,
  jumpBufferTimer: 0,
  dashBufferTimer: 0,
  dashActiveTimer: 0,
  dashTrailTimer: 0,
  dashCharge: true,
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
  elapsed: 0,
  lastPlatformGap: null,
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

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function formatSeconds(value) {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

function formatStopwatch(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${minutes}:${String(sec).padStart(2, "0")}.${tenths}`;
}

function createPlayer() {
  return {
    x: 80,
    y: canvas.height - 240,
    width: 32,
    height: 58,
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
  state.lastPointerTap = 0;
  state.dashBufferTimer = 0;
  state.dashActiveTimer = 0;
  state.dashTrailTimer = 0;
  state.dashCharge = true;
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
  state.elapsed = 0;
  state.lastPlatformGap = null;
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
    const progress = clamp(state.distance / 600, 0, 1);
    const targetGap = lerp(config.platformGapMin, config.platformGapMax, progress);
    const previousGap = state.lastPlatformGap ?? targetGap;
    const smoothedGap = lerp(previousGap, targetGap, 0.4);
    const varianceRange = config.platformGapBaseVariance + config.platformGapVarianceGrowth * progress;
    const minGap = clamp(smoothedGap - varianceRange, config.platformGapMin, config.platformGapMax);
    const maxGap = clamp(smoothedGap + varianceRange, config.platformGapMin, config.platformGapMax);
    const gap = randomRange(Math.min(minGap, maxGap), Math.max(minGap, maxGap));
    state.lastPlatformGap = gap;
    const width = randomRange(config.platformWidthMin, config.platformWidthMax);
    const variance = randomRange(-config.platformVerticalVariance, config.platformVerticalVariance);
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
  state.elapsed += dt;
  state.jumpGrace = Math.max(0, state.jumpGrace - dt);
  state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  state.dashBufferTimer = Math.max(0, state.dashBufferTimer - dt);

  const waitingForRespawn = processPendingRespawn(dt);
  if (waitingForRespawn) {
    updateCheckpointTimers(dt);
    updateParticles(dt);
    updateHud();
    return;
  }

  const player = state.player;
  const prevY = player.y;

  if (state.dashBufferTimer > 0 && canDash()) {
    startDash();
  }

  const dashStrength = state.dashActiveTimer > 0 ? state.dashActiveTimer / config.dashDuration : 0;
  const dashBonus = dashStrength * config.dashSpeedBonus;
  state.speed = config.baseSpeed + dashBonus;
  player.x += state.speed * dt;

  const gravityScale = state.dashActiveTimer > 0 ? config.dashGravityScale : 1;
  player.vy += config.gravity * gravityScale * dt;
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

  updateDashEffects(dt);
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
      const regainedDash = !state.dashCharge;
      state.dashCharge = true;
      state.dashActiveTimer = 0;
      state.dashTrailTimer = 0;
      if (regainedDash) {
        state.dashBufferTimer = 0;
      }
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
  state.dashBufferTimer = 0;
  state.dashActiveTimer = 0;
  state.dashTrailTimer = 0;
  state.dashCharge = true;
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
    color: "rgba(255, 166, 102, 0.45)",
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

function queueDash() {
  if (!state.isRunning) return;
  state.dashBufferTimer = config.dashBuffer;
}

function handleDashButton(event) {
  event.preventDefault();
  queueDash();
}

function canDash() {
  if (!state.player) return false;
  if (!state.dashCharge) return false;
  if (state.dashActiveTimer > 0) return false;
  if (state.onGround) return false;
  if (state.pendingRespawn) return false;
  if (!state.isRunning || state.paused) return false;
  return true;
}

function startDash() {
  const player = state.player;
  if (!player) return;
  state.dashCharge = false;
  state.dashActiveTimer = config.dashDuration;
  state.dashBufferTimer = 0;
  state.dashTrailTimer = 0;
  const boost = config.dashVerticalBoost;
  if (boost > 0 && player.vy > 0) {
    // Only cancel downward momentum so the dash feels flatter instead of launching upward
    player.vy = Math.max(0, player.vy - boost);
  }
  spawnDashBurst(player.x + player.width / 2, player.y + player.height / 2);
}

function updateDashEffects(dt) {
  if (state.dashActiveTimer <= 0) return;
  const player = state.player;
  if (player) {
    state.dashTrailTimer += dt;
    while (state.dashTrailTimer >= config.dashTrailInterval) {
      spawnDashTrail(player);
      state.dashTrailTimer -= config.dashTrailInterval;
    }
  }
  state.dashActiveTimer = Math.max(0, state.dashActiveTimer - dt);
  if (state.dashActiveTimer === 0) {
    state.dashTrailTimer = 0;
  }
}

function spawnDashTrail(player) {
  state.particles.push({
    x: player.x - 12 + randomRange(-10, 10),
    y: player.y + player.height * 0.4 + randomRange(-8, 8),
    vx: randomRange(-150, -40),
    vy: randomRange(-60, 60),
    life: 0,
    maxLife: 0.25,
    color: "rgba(255, 214, 240, 0.5)",
    size: randomRange(2, 4),
  });
}

function spawnDashBurst(x, y) {
  for (let i = 0; i < 18; i += 1) {
    const angle = randomRange(-Math.PI / 4, Math.PI / 4);
    const speed = randomRange(220, 420);
    state.particles.push({
      x: x - 12,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.5,
      life: 0,
      maxLife: randomRange(0.25, 0.45),
      color: "rgba(255, 190, 130, 0.65)",
      size: randomRange(2, 5),
    });
  }
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
      color: "rgba(255, 196, 140, 0.55)",
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
  const formattedTime = formatStopwatch(state.elapsed);
  if (timerEl) timerEl.textContent = formattedTime;
  if (cornerTimerEl) cornerTimerEl.textContent = formattedTime;
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
  if (dashEl) {
    if (state.dashActiveTimer > 0) {
      dashEl.textContent = "Boost!";
    } else if (state.dashCharge) {
      dashEl.textContent = "Ready";
    } else {
      dashEl.textContent = state.onGround ? "Refilling" : "Spent";
    }
  }
  syncDashButtonAppearance();
}

function syncDashButtonAppearance() {
  if (!dashBtn) return;
  const status = state.dashActiveTimer > 0 ? "boost" : state.dashCharge ? "ready" : state.onGround ? "refill" : "spent";
  dashBtn.dataset.state = status;
  if (dashBtnStateLabel) {
    const labelMap = {
      boost: "Boost!",
      ready: "Ready",
      refill: "Refilling",
      spent: "Spent",
    };
    dashBtnStateLabel.textContent = labelMap[status] ?? "Ready";
  }
  dashBtn.dataset.queued = state.dashBufferTimer > 0 ? "true" : "false";
  dashBtn.disabled = !state.isRunning;
}

function render(time = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(time);
  drawParallax(time);
  drawLavaRiver(time);
  drawPlatforms();
  drawCheckpoints(time);
  drawParticles();
  drawPlayer(time);
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
  gradient.addColorStop(0, "#2b0b43");
  gradient.addColorStop(0.45, "#3c0d2a");
  gradient.addColorStop(0.82, "#1a050d");
  gradient.addColorStop(1, "#080103");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const sunY = 140 + Math.sin(time * 0.0015) * 10;
  ctx.fillStyle = "rgba(255, 121, 71, 0.2)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.72, sunY, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 213, 175, 0.35)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.74, sunY, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParallax(time) {
  ctx.save();
  const forestFloor = canvas.height - config.lavaHeight - 20;
  const layers = [
    { color: "rgba(6, 32, 21, 0.55)", parallax: 0.12, height: config.forestBaseHeight + 30, noise: 26 },
    { color: "rgba(17, 56, 33, 0.8)", parallax: 0.2, height: config.forestBaseHeight, noise: 18 },
  ];

  layers.forEach((layer, index) => {
    const offset = ((state.cameraX * layer.parallax + time * (0.02 + index * 0.01)) % 80) - 80;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(-120, forestFloor);
    for (let x = -120; x < canvas.width + 160; x += 40) {
      const peakHeight = layer.height + Math.sin((x + offset) * 0.18) * layer.noise;
      ctx.lineTo(x + 20, forestFloor - peakHeight);
      ctx.lineTo(x + 40, forestFloor);
    }
    ctx.lineTo(canvas.width + 160, canvas.height);
    ctx.lineTo(-120, canvas.height);
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}

function drawLavaRiver(time) {
  const lavaTop = canvas.height - config.lavaHeight;
  const gradient = ctx.createLinearGradient(0, lavaTop, 0, canvas.height);
  gradient.addColorStop(0, "rgba(255, 120, 60, 0.85)");
  gradient.addColorStop(0.4, "rgba(234, 60, 19, 0.9)");
  gradient.addColorStop(1, "#350501");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, lavaTop, canvas.width, canvas.height - lavaTop);

  const waves = 2;
  for (let layer = 0; layer < waves; layer += 1) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 214, 158, ${0.4 - layer * 0.12})`;
    ctx.lineWidth = 3 - layer * 0.6;
    ctx.beginPath();
    const amplitude = config.lavaWaveAmplitude - layer * 3;
    const length = config.lavaWaveLength;
    const offset = (state.cameraX * (0.25 + layer * 0.1) + time * (18 + layer * 6)) % length;
    let firstPoint = true;
    for (let x = -length; x <= canvas.width + length; x += 10) {
      const waveY = lavaTop + 18 + layer * 16 + Math.sin((x + offset) * 0.025) * amplitude;
      if (firstPoint) {
        ctx.moveTo(x, waveY);
        firstPoint = false;
      } else {
        ctx.lineTo(x, waveY);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = "rgba(255, 240, 200, 0.28)";
  for (let i = 0; i < 40; i += 1) {
    const flicker = Math.sin((time * 0.008 + i) * 2.1);
    const x = ((i * 97 + time * 0.4 + state.cameraX * 0.6) % (canvas.width + 80)) - 40;
    const y = lavaTop + ((i * 37) % (canvas.height - lavaTop));
    ctx.globalAlpha = 0.15 + Math.abs(flicker) * 0.35;
    ctx.fillRect(x, y, 3, 10);
  }
  ctx.restore();
}

function drawPlatforms() {
  ctx.save();
  for (const platform of state.platforms) {
    const screenX = platform.x - state.cameraX;
    const screenY = platform.y;
    if (screenX + platform.width < -10 || screenX > canvas.width + 10) continue;
    const gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + platform.height);
    gradient.addColorStop(0, "#7fdc74"); // sunlit moss
    gradient.addColorStop(0.55, "#3c8f3f"); // forest green
    gradient.addColorStop(1, "#2a160a"); // earthy bark
    ctx.fillStyle = gradient;
    ctx.fillRect(screenX, screenY, platform.width, platform.height);
    ctx.fillStyle = "rgba(220, 255, 210, 0.28)";
    ctx.fillRect(screenX, screenY, platform.width, 4);
    ctx.fillStyle = "rgba(86, 52, 20, 0.4)";
    ctx.fillRect(screenX, screenY + platform.height - 5, platform.width, 5);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, platform.width - 1, platform.height - 1);
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
  const baseX = player.x - state.cameraX + player.width / 2;
  const baseY = player.y + player.height;
  drawStickFigure(baseX, baseY, {
    time,
    glow: true,
    color: "#fff5ec",
    accent: "#ffbe91",
    scale: 1,
    tempo: clamp(state.speed / config.baseSpeed, 0.7, 1.6),
    grounded: state.onGround,
    verticalVelocity: player.vy,
    lineWidth: 4,
  });
}

function drawStickFigure(x, baseY, options = {}) {
  const {
    time = 0,
    color = "#fff",
    accent = null,
    glow = false,
    scale = 1,
    tempo = 1,
    phase = 0,
    lineWidth = 3,
    grounded = true,
    verticalVelocity = 0,
  } = options;
  const runStrength = clamp(tempo, 0.45, 1.85);
  const animationSpeed = 0.008 * (0.7 + runStrength * 0.45);
  const timeline = time * animationSpeed + phase;
  const strideWave = Math.sin(timeline);
  const doubleWave = Math.sin(timeline * 2);
  const torso = 30 * scale;
  const headRadius = 8 * scale;
  const hipBob = doubleWave * 2.6 * scale * runStrength - (!grounded ? verticalVelocity * 0.01 : 0);
  const shoulderY = baseY - torso - headRadius * 2 + hipBob * 0.35;
  const hipY = baseY - headRadius + hipBob;
  const torsoLean = strideWave * 0.12 * runStrength + (grounded ? 0 : -verticalVelocity * 0.0008);
  const torsoOffsetX = Math.sin(timeline * 0.5) * 1.4 * scale;
  const spineTopX = x + torsoOffsetX - torsoLean * 6;
  const spineBottomX = x + torsoOffsetX + torsoLean * 8;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (glow) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(255, 130, 80, 0.55)";
  }

  // Core spine
  ctx.beginPath();
  ctx.moveTo(spineTopX, shoulderY);
  ctx.lineTo(spineBottomX, hipY - 6 * scale);
  ctx.stroke();

  function drawArm(side) {
    const phaseOffset = side === -1 ? 0 : Math.PI;
    const phase = timeline + phaseOffset;
    const swing = Math.sin(phase) * 10 * runStrength;
    const lift = Math.cos(phase) * 4 * runStrength;
    const shoulder = { x: spineTopX, y: shoulderY + 6 * scale };
    const elbow = {
      x: shoulder.x + (swing * 0.7 + torsoLean * 6) * side,
      y: shoulder.y + 10 * scale - lift * 0.4,
    };
    const hand = {
      x: shoulder.x + (swing + torsoLean * 10) * side,
      y: shoulder.y + 24 * scale - lift,
    };
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
  }

  function drawLeg(side) {
    const phaseOffset = side === -1 ? 0 : Math.PI;
    const phase = timeline + phaseOffset;
    const stride = Math.sin(phase) * runStrength;
    const lift = Math.max(0, Math.sin(phase)) * 12 * runStrength;
    const reach = stride * 12 * scale;
    const hip = { x: spineBottomX, y: hipY - 6 * scale };
    const knee = {
      x: hip.x + reach * 0.45 * side,
      y: hip.y + 18 * scale - lift * 0.35,
    };
    let footY = baseY - (grounded ? Math.max(0, -stride) * 2 * scale : 10 * scale) - lift * 0.35;
    footY -= Math.min(0, verticalVelocity) * 0.02;
    let footX = hip.x + reach * side;
    const minFootY = knee.y + 4 * scale;
    const maxFootY = baseY;
    footY = clamp(footY, minFootY, maxFootY);
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(footX, footY);
    ctx.stroke();
  }

  drawArm(-1);
  drawArm(1);
  drawLeg(-1);
  drawLeg(1);

  // Head
  ctx.shadowBlur = 0;
  ctx.beginPath();
  const headCenterY = shoulderY - headRadius - Math.sin(timeline * 2 + Math.PI / 2) * 1.2 * scale * runStrength;
  ctx.arc(spineTopX, headCenterY, headRadius, 0, Math.PI * 2);
  ctx.stroke();
  if (accent) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.fill();
  }

  // Trail sash
  if (accent) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(spineTopX - 8 * scale, shoulderY + 6 * scale);
    ctx.quadraticCurveTo(
      spineTopX - 2 * scale,
      shoulderY + 18 * scale + strideWave * 2 * scale,
      spineBottomX + 10 * scale,
      hipY - 10 * scale
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const particle of state.particles) {
    const alpha = 1 - particle.life / particle.maxLife;
    ctx.fillStyle = particle.color ?? `rgba(255, 210, 170, ${alpha * 0.7})`;
    const screenX = particle.x - state.cameraX;
    const size = particle.size ?? 3;
    ctx.beginPath();
    ctx.arc(screenX, particle.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
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
    case "ArrowRight":
      event.preventDefault();
      queueDash();
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
  const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  if (state.lastPointerTap && now - state.lastPointerTap <= 280) {
    queueDash();
    state.lastPointerTap = 0;
    return;
  }
  queueJump();
  state.lastPointerTap = now;
}

function attachEvents() {
  if (resetBtn) resetBtn.addEventListener("click", resetGame);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (dashBtn) {
    dashBtn.addEventListener("pointerdown", handleDashButton);
    dashBtn.addEventListener("click", handleDashButton);
  }
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
