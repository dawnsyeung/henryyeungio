const canvas = document.getElementById("expedition-canvas");
const ctx = canvas?.getContext("2d");

if (!canvas || !ctx) {
  throw new Error("Missing canvas element #expedition-canvas.");
}

const ui = {
  score: document.getElementById("score-value"),
  best: document.getElementById("best-value"),
  threat: document.getElementById("speed-value"),
  status: document.getElementById("status-text"),
  loadTrack: document.getElementById("load-track"),
  loadFill: document.getElementById("load-fill"),
  loadText: document.getElementById("load-text"),
  objective: document.getElementById("objective-value"),
};

const controls = {
  play: document.getElementById("play-btn"),
  pause: document.getElementById("pause-btn"),
  reset: document.getElementById("reset-btn"),
};

const BEST_KEY = "starwatchExpeditionBest";

const config = {
  playerSpeed: 230,
  sprintMultiplier: 1.55,
  staminaDrainRate: 1.35,
  staminaRegenRate: 0.65,
  playerRadius: 20,
  artifactGoal: 9,
  pulseCooldown: 6,
  pulseDuration: 1.4,
  worldPadding: 36,
  sentinelSpeed: 60,
  sentinelChaseSpeed: 120,
  sentinelVision: 150,
  sentinelHoldTime: 1.5,
  sentinelRadius: 22,
  pulseSlowMultiplier: 0.35,
  maxHearts: 3,
  extractionRadius: 60,
};

const spawnPoint = { x: canvas.width / 2, y: canvas.height - 110 };

const ruins = [
  { x: 80, y: 60, width: 260, height: 80 },
  { x: 110, y: 210, width: 180, height: 90 },
  { x: 360, y: 70, width: 160, height: 120 },
  { x: 530, y: 180, width: 320, height: 80 },
  { x: 620, y: 300, width: 240, height: 70 },
  { x: 120, y: 360, width: 260, height: 120 },
  { x: 440, y: 410, width: 180, height: 90 },
  { x: 720, y: 420, width: 140, height: 80 },
];

const sentinelPresets = [
  {
    path: [
      { x: 180, y: 150 },
      { x: 420, y: 150 },
      { x: 420, y: 260 },
      { x: 180, y: 260 },
    ],
    vision: 160,
  },
  {
    path: [
      { x: 640, y: 120 },
      { x: 860, y: 120 },
      { x: 860, y: 220 },
      { x: 640, y: 220 },
    ],
    vision: 150,
  },
  {
    path: [
      { x: 520, y: 330 },
      { x: 780, y: 330 },
      { x: 780, y: 480 },
      { x: 520, y: 480 },
    ],
    vision: 175,
  },
];

const moveBindings = new Map([
  ["KeyW", "up"],
  ["ArrowUp", "up"],
  ["KeyS", "down"],
  ["ArrowDown", "down"],
  ["KeyA", "left"],
  ["ArrowLeft", "left"],
  ["KeyD", "right"],
  ["ArrowRight", "right"],
]);

const player = createPlayer();
const input = { up: false, down: false, left: false, right: false, sprint: false };
let sentries = [];
let artifacts = [];

const state = {
  phase: "idle",
  paused: true,
  score: 0,
  best: loadBestScore(),
  alertLevel: 0,
  lastTime: performance.now(),
  pulse: { cooldown: 0, remaining: 0, wave: 0 },
  lastOutcome: "",
  extractionActive: false,
  extractionPoint: selectExtractionPoint(),
};

init();

function init() {
  resetWorld();
  resetToIdle();
  attachEvents();
  requestAnimationFrame(gameLoop);
}

function attachEvents() {
  controls.play?.addEventListener("click", () => {
    if (state.phase === "playing" && state.paused) {
      resumeRun();
    } else if (state.phase === "playing") {
      startRun();
    } else {
      startRun();
    }
  });

  controls.pause?.addEventListener("click", () => {
    if (state.phase !== "playing") return;
    state.paused ? resumeRun() : pauseRun();
  });

  controls.reset?.addEventListener("click", () => {
    resetToIdle();
  });

  canvas.addEventListener("pointerdown", () => {
    if (state.phase === "playing" && !state.paused) {
      triggerPulse();
    } else if (state.phase === "playing" && state.paused) {
      resumeRun();
    } else {
      startRun();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const direction = moveBindings.get(event.code);
    if (direction) {
      event.preventDefault();
      input[direction] = true;
    }

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      input.sprint = true;
    }

    if (event.code === "Space") {
      event.preventDefault();
      triggerPulse();
    }

    if (event.code === "KeyP") {
      event.preventDefault();
      if (state.phase === "playing") {
        state.paused ? resumeRun() : pauseRun();
      }
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      startRun();
    }
  });

  window.addEventListener("keyup", (event) => {
    const direction = moveBindings.get(event.code);
    if (direction) {
      input[direction] = false;
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      input.sprint = false;
    }
  });

  window.addEventListener("blur", () => {
    if (state.phase === "playing" && !state.paused) {
      pauseRun();
      setStatusText("Paused — focus lost.");
    }
  });
}

function gameLoop(timestamp = 0) {
  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.04) || 0;
  state.lastTime = timestamp;

  if (state.phase === "playing" && !state.paused) {
    update(delta);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  updatePulse(dt);
  updatePlayer(dt);
  updateArtifacts(dt);
  checkExtractionProgress();
  updateSentries(dt);
  updateScoreUI();
  updateThreatReadout();
  updateLoadBar();
  updateObjectiveReadout();
  setStatusText(getStatusMessage());
}

function updatePulse(dt) {
  if (state.pulse.cooldown > 0) {
    state.pulse.cooldown = Math.max(0, state.pulse.cooldown - dt);
  }
  if (state.pulse.remaining > 0) {
    state.pulse.remaining = Math.max(0, state.pulse.remaining - dt);
  }
  if (state.pulse.wave > 0) {
    state.pulse.wave = Math.max(0, state.pulse.wave - dt);
  }
  if (player.invulnerable > 0) {
    player.invulnerable = Math.max(0, player.invulnerable - dt);
  }
}

function updatePlayer(dt) {
  const moveVector = { x: 0, y: 0 };
  if (input.up) moveVector.y -= 1;
  if (input.down) moveVector.y += 1;
  if (input.left) moveVector.x -= 1;
  if (input.right) moveVector.x += 1;

  const moving = moveVector.x !== 0 || moveVector.y !== 0;
  if (moving) {
    const length = Math.hypot(moveVector.x, moveVector.y) || 1;
    moveVector.x /= length;
    moveVector.y /= length;
    player.heading = Math.atan2(moveVector.y, moveVector.x);
  }

  let speed = config.playerSpeed;
  if (input.sprint && moving && player.stamina > 0.05) {
    speed *= config.sprintMultiplier;
    player.stamina = Math.max(0, player.stamina - config.staminaDrainRate * dt);
  } else {
    player.stamina = Math.min(1, player.stamina + config.staminaRegenRate * dt);
  }

  const dx = moveVector.x * speed * dt;
  const dy = moveVector.y * speed * dt;
  moveWithCollisions(player, dx, dy);
}

function moveWithCollisions(entity, dx, dy) {
  entity.x += dx;
  clampToWorld(entity);
  for (const ruin of ruins) {
    if (circleRectIntersect(entity.x, entity.y, entity.radius, ruin)) {
      if (dx > 0) {
        entity.x = ruin.x - entity.radius;
      } else if (dx < 0) {
        entity.x = ruin.x + ruin.width + entity.radius;
      }
    }
  }

  entity.y += dy;
  clampToWorld(entity);
  for (const ruin of ruins) {
    if (circleRectIntersect(entity.x, entity.y, entity.radius, ruin)) {
      if (dy > 0) {
        entity.y = ruin.y - entity.radius;
      } else if (dy < 0) {
        entity.y = ruin.y + ruin.height + entity.radius;
      }
    }
  }
}

function clampToWorld(entity) {
  entity.x = clamp(entity.x, config.worldPadding, canvas.width - config.worldPadding);
  entity.y = clamp(entity.y, config.worldPadding, canvas.height - config.worldPadding);
}

function updateArtifacts(dt) {
  for (const artifact of artifacts) {
    artifact.wobble += dt * 2.4;
    artifact.flash = Math.max(0, artifact.flash - dt);
    if (artifact.collected) continue;
    const dist = distance(entityPosition(player), artifact);
    if (dist <= player.radius + artifact.radius - 2) {
      artifact.collected = true;
      artifact.flash = 0.4;
      state.score += 1;
    }
  }
}

function checkExtractionProgress() {
  if (!state.extractionActive && state.score >= config.artifactGoal) {
    state.extractionActive = true;
    updateObjectiveReadout();
    setStatusText(getStatusMessage());
  }

  if (
    state.extractionActive &&
    distance(entityPosition(player), state.extractionPoint) <= config.extractionRadius + player.radius - 6
  ) {
    winRun();
  }
}

function updateSentries(dt) {
  let chasing = 0;
  for (const sentinel of sentries) {
    const target = sentinel.state === "chase" ? player : sentinel.path[sentinel.pathIndex];
    const baseSpeed = sentinel.state === "chase" ? config.sentinelChaseSpeed : config.sentinelSpeed;
    const slowFactor = state.pulse.remaining > 0 ? config.pulseSlowMultiplier : 1;
    const speed = baseSpeed * slowFactor;
    const angle = Math.atan2(target.y - sentinel.y, target.x - sentinel.x);
    sentinel.x += Math.cos(angle) * speed * dt;
    sentinel.y += Math.sin(angle) * speed * dt;

    if (sentinel.state === "chase") {
      sentinel.alertTimer = config.sentinelHoldTime;
    }

    const distToPlayer = distance(entityPosition(player), sentinel);
    const vision = sentinel.vision;
    if (distToPlayer <= vision) {
      sentinel.state = "chase";
    } else if (sentinel.state === "chase") {
      sentinel.alertTimer -= dt;
      if (sentinel.alertTimer <= 0) {
        sentinel.state = "patrol";
      }
    }

    if (sentinel.state !== "chase") {
      const pathTarget = sentinel.path[sentinel.pathIndex];
      if (distance(pathTarget, sentinel) < 6) {
        sentinel.pathIndex = (sentinel.pathIndex + 1) % sentinel.path.length;
      }
    } else {
      chasing += 1;
    }

    if (distToPlayer < sentinel.radius + player.radius - 4) {
      handlePlayerHit();
    }
  }

  state.alertLevel = chasing;
}

function handlePlayerHit() {
  if (player.invulnerable > 0) return;
  player.health -= 1;
  player.invulnerable = 1.2;
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.stamina = 1;
  if (player.health <= 0) {
    endRun("Sentries overwhelmed the scout.");
  }
}

function draw() {
  drawBackdrop();
  drawRuins();
  drawArtifacts();
  drawExtractionZone();
  drawPulseWave();
  drawSentries();
  drawPlayer();
  drawOverlay();
}

function drawBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#051125");
  gradient.addColorStop(1, "#020812");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(94,245,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawRuins() {
  for (const ruin of ruins) {
    ctx.fillStyle = "rgba(14, 24, 46, 0.92)";
    ctx.strokeStyle = "rgba(94,245,255,0.2)";
    ctx.lineWidth = 2;
    roundedRectPath(ruin.x, ruin.y, ruin.width, ruin.height, 14);
    ctx.fill();
    ctx.stroke();
  }
}

function drawArtifacts() {
  for (const artifact of artifacts) {
    const wobble = Math.sin(artifact.wobble) * 4;
    const radius = artifact.radius + wobble * 0.2;
    const gradient = ctx.createRadialGradient(artifact.x, artifact.y, radius * 0.2, artifact.x, artifact.y, radius);
    const baseColor = artifact.collected ? "rgba(255,255,255,0.02)" : "rgba(94,245,255,0.6)";
    gradient.addColorStop(0, "#fef9d7");
    gradient.addColorStop(0.6, artifact.collected ? "rgba(255,255,255,0.08)" : "rgba(94,245,255,0.7)");
    gradient.addColorStop(1, artifact.collected ? "rgba(94,245,255,0.08)" : "rgba(94,245,255,0)");
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(artifact.x, artifact.y - wobble, radius, 0, Math.PI * 2);
    ctx.fill();

    if (artifact.flash > 0) {
      ctx.save();
      ctx.globalAlpha = artifact.flash * 2;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(artifact.x, artifact.y - wobble, radius + artifact.flash * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawExtractionZone() {
  const target = state.extractionPoint;
  if (!target) return;
  const radius = config.extractionRadius;
  const time = performance.now() / 600;
  const pulse = (Math.sin(time * 2) + 1) * 0.5;
  const outerRadius = radius + 12 + pulse * 20;

  ctx.save();
  const gradient = ctx.createRadialGradient(target.x, target.y, radius * 0.4, target.x, target.y, outerRadius);
  if (state.extractionActive) {
    gradient.addColorStop(0, "rgba(94,245,255,0.6)");
    gradient.addColorStop(1, "rgba(94,245,255,0)");
  } else {
    gradient.addColorStop(0, "rgba(255,192,125,0.35)");
    gradient.addColorStop(1, "rgba(255,192,125,0)");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(target.x, target.y, outerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = state.extractionActive ? "#5ef5ff" : "rgba(255,198,155,0.7)";
  ctx.lineWidth = state.extractionActive ? 3 : 2;
  ctx.setLineDash(state.extractionActive ? [] : [10, 8]);
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "600 14px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = state.extractionActive ? "#c8feff" : "rgba(255,233,208,0.85)";
  ctx.fillText(state.extractionActive ? "EVAC READY" : "EVAC LOCKED", target.x, target.y - radius - 12);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("EVAC FLARE", target.x, target.y + radius + 22);
  ctx.restore();
}

function drawPulseWave() {
  if (state.pulse.wave <= 0) return;
  const ratio = state.pulse.wave / config.pulseDuration;
  const radius = (1 - ratio) * Math.max(canvas.width, canvas.height) * 1.2;
  ctx.save();
  const gradient = ctx.createRadialGradient(player.x, player.y, radius * 0.1, player.x, player.y, radius);
  gradient.addColorStop(0, "rgba(94,245,255,0.35)");
  gradient.addColorStop(1, "rgba(94,245,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSentries() {
  for (const sentinel of sentries) {
    ctx.save();
    ctx.strokeStyle = sentinel.state === "chase" ? "rgba(255,122,122,0.25)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(sentinel.x, sentinel.y, sentinel.vision, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = sentinel.state === "chase" ? "#ff7a7a" : "#f9c86b";
    ctx.shadowBlur = 18;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(sentinel.x, sentinel.y, sentinel.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.fillStyle = "#fefefe";
  ctx.shadowColor = "rgba(94,245,255,0.6)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  const indicatorLength = player.radius + 12;
  ctx.strokeStyle = "#5ef5ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(
    player.x + Math.cos(player.heading) * indicatorLength,
    player.y + Math.sin(player.heading) * indicatorLength
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(94,245,255,0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    player.x,
    player.y,
    player.radius + 10,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * player.stamina
  );
  ctx.stroke();
  ctx.restore();

  if (player.invulnerable > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOverlay() {
  if (state.phase !== "over" && state.phase !== "won") return;
  ctx.save();
  ctx.fillStyle = "rgba(2, 8, 16, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fefefe";
  ctx.textAlign = "center";
  ctx.font = "700 36px Montserrat, sans-serif";
  const title = state.phase === "won" ? "Extraction Ready" : "Run Lost";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "600 18px Montserrat, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Tap Play to deploy again", canvas.width / 2, canvas.height / 2 + 24);
  ctx.restore();
}

function triggerPulse() {
  if (state.phase !== "playing" || state.paused) return;
  if (state.pulse.cooldown > 0) return;
  state.pulse.cooldown = config.pulseCooldown;
  state.pulse.remaining = config.pulseDuration;
  state.pulse.wave = config.pulseDuration;
}

function updateScoreUI() {
  const scoreValue = Math.max(0, Math.floor(state.score));
  if (ui.score) ui.score.textContent = `${scoreValue}/${config.artifactGoal}`;
  if (scoreValue > state.best) {
    state.best = scoreValue;
    saveBestScore(scoreValue);
  }
  if (ui.best) ui.best.textContent = `${state.best}`;
}

function updateThreatReadout() {
  if (!ui.threat) return;
  const labels = ["Calm", "Tracking", "Hunted", "Critical"];
  const index = clamp(Math.floor(state.alertLevel), 0, labels.length - 1);
  ui.threat.textContent = labels[index];
}

function updateLoadBar() {
  if (!ui.loadFill || !ui.loadTrack || !ui.loadText) return;
  const ratio = config.pulseCooldown > 0 ? 1 - state.pulse.cooldown / config.pulseCooldown : 1;
  const clamped = clamp(ratio, 0, 1);
  const percent = Math.round(clamped * 100);
  ui.loadFill.style.width = `${percent}%`;
  ui.loadTrack.setAttribute("aria-valuenow", percent.toString());
  ui.loadText.textContent = percent >= 100 ? "Ready" : `${percent}%`;
}

function updateObjectiveReadout() {
  if (!ui.objective) return;
  let message = "Standby";
  if (state.phase === "idle") {
    message = `Collect ${config.artifactGoal} shards`;
  } else if (state.phase === "playing") {
    if (state.paused) {
      message = "Paused";
    } else if (state.extractionActive) {
      message = "Reach evac flare";
    } else {
      const remaining = Math.max(0, config.artifactGoal - state.score);
      message = `${remaining} shards left`;
    }
  } else if (state.phase === "won") {
    message = "Extraction complete";
  } else if (state.phase === "over") {
    message = "Recon failed";
  }
  ui.objective.textContent = message;
}

function getStatusMessage() {
  const remaining = Math.max(0, config.artifactGoal - state.score);
  if (state.phase === "idle") {
    return `Tap Play to deploy. Collect ${config.artifactGoal} skyshards.`;
  }
  if (state.phase === "playing") {
    if (state.paused) {
      return "Paused — press Play or P.";
    }
    if (state.extractionActive) {
      return `All shards secured — reach the evac flare! • Hearts ${player.health}/${config.maxHearts}`;
    }
    return `${remaining} artifacts remain • Hearts ${player.health}/${config.maxHearts}`;
  }
  if (state.phase === "won") {
    return "All shards secured. Extraction shuttle inbound.";
  }
  return "Sentries overwhelmed the scout. Tap Play to retry.";
}

function setStatusText(message) {
  if (ui.status) {
    ui.status.textContent = message;
  }
}

function resetWorld() {
  resetPlayerState();
  state.extractionActive = false;
  state.extractionPoint = selectExtractionPoint();
  sentries = sentinelPresets.map(createSentinel);
  artifacts = [];
  spawnArtifacts(config.artifactGoal);
}

function resetPlayerState() {
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.radius = config.playerRadius;
  player.heading = -Math.PI / 2;
  player.stamina = 1;
  player.invulnerable = 0;
  player.health = config.maxHearts;
}

function spawnArtifacts(targetCount) {
  let attempts = 0;
  while (artifacts.length < targetCount && attempts < 600) {
    attempts += 1;
    const candidate = {
      x: randBetween(config.worldPadding, canvas.width - config.worldPadding),
      y: randBetween(config.worldPadding, canvas.height - config.worldPadding),
      radius: randBetween(14, 20),
      wobble: Math.random() * Math.PI * 2,
      flash: 0,
      collected: false,
    };
    const intersectsRuin = ruins.some((zone) => circleRectIntersect(candidate.x, candidate.y, candidate.radius + 6, zone));
    if (!intersectsRuin) {
      artifacts.push(candidate);
    }
  }
}

function selectExtractionPoint() {
  let attempts = 0;
  const padding = config.worldPadding + config.extractionRadius + 10;
  while (attempts < 400) {
    attempts += 1;
    const candidate = {
      x: randBetween(padding, canvas.width - padding),
      y: randBetween(padding, canvas.height - padding),
    };
    const intersectsRuin = ruins.some((zone) =>
      circleRectIntersect(candidate.x, candidate.y, config.extractionRadius + 18, zone)
    );
    if (!intersectsRuin) {
      return candidate;
    }
  }
  return { x: canvas.width / 2, y: canvas.height / 2 };
}

function startRun() {
  state.phase = "playing";
  state.paused = false;
  state.score = 0;
  state.alertLevel = 0;
  state.pulse.cooldown = 0;
  state.pulse.remaining = 0;
  state.pulse.wave = 0;
  resetWorld();
  updateScoreUI();
  updateThreatReadout();
  updateLoadBar();
  updateObjectiveReadout();
  setStatusText(getStatusMessage());
  updateControls();
}

function resetToIdle() {
  state.phase = "idle";
  state.paused = true;
  state.score = 0;
  state.alertLevel = 0;
  state.pulse.cooldown = 0;
  state.pulse.remaining = 0;
  state.pulse.wave = 0;
  resetWorld();
  updateScoreUI();
  updateThreatReadout();
  updateLoadBar();
  updateObjectiveReadout();
  setStatusText(getStatusMessage());
  updateControls();
}

function pauseRun() {
  if (state.phase !== "playing" || state.paused) return;
  state.paused = true;
  setStatusText(getStatusMessage());
  updateObjectiveReadout();
  updateControls();
}

function resumeRun() {
  if (state.phase !== "playing" || !state.paused) return;
  state.paused = false;
  setStatusText(getStatusMessage());
  updateObjectiveReadout();
  updateControls();
}

function winRun() {
  state.phase = "won";
  state.paused = true;
  state.extractionActive = false;
  updateScoreUI();
  updateControls();
  setStatusText(getStatusMessage());
  updateObjectiveReadout();
}

function endRun(reason) {
  state.phase = "over";
  state.paused = true;
  state.lastOutcome = reason;
  state.extractionActive = false;
  updateControls();
  setStatusText(getStatusMessage());
  updateObjectiveReadout();
}

function updateControls() {
  if (controls.pause) {
    controls.pause.disabled = state.phase !== "playing";
    controls.pause.textContent = state.paused ? "Resume" : "Pause";
  }
  if (controls.play) {
    let label = "Play";
    if (state.phase === "playing") {
      label = state.paused ? "Resume" : "Restart";
    } else if (state.phase === "won") {
      label = "Replay";
    } else if (state.phase === "over") {
      label = "Play Again";
    }
    controls.play.textContent = label;
  }
}

function createPlayer() {
  return {
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: config.playerRadius,
    heading: -Math.PI / 2,
    stamina: 1,
    invulnerable: 0,
    health: config.maxHearts,
  };
}

function createSentinel({ path, vision = config.sentinelVision }) {
  const start = path[0];
  return {
    x: start.x,
    y: start.y,
    radius: config.sentinelRadius,
    path,
    pathIndex: 1 % path.length,
    state: "patrol",
    alertTimer: config.sentinelHoldTime,
    vision,
  };
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circleRectIntersect(cx, cy, radius, rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.width);
  const closestY = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function distance(a, b) {
  const dx = (a.x - b.x) || 0;
  const dy = (a.y - b.y) || 0;
  return Math.hypot(dx, dy);
}

function entityPosition(entity) {
  return { x: entity.x, y: entity.y };
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function saveBestScore(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    console.error("Failed to save best score", error);
  }
}

function loadBestScore() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (error) {
    console.error("Failed to read best score", error);
    return 0;
  }
}
