const canvas = document.getElementById("runner-canvas");
const ctx = canvas?.getContext("2d");

if (!canvas || !ctx) {
  throw new Error("Missing canvas element #runner-canvas.");
}

const ui = {
  score: document.getElementById("score-value"),
  best: document.getElementById("best-value"),
  speed: document.getElementById("speed-value"),
  status: document.getElementById("status-text"),
  loadTrack: document.getElementById("load-track"),
  loadFill: document.getElementById("load-fill"),
  loadText: document.getElementById("load-text"),
};

const controls = {
  play: document.getElementById("play-btn"),
  pause: document.getElementById("pause-btn"),
  reset: document.getElementById("reset-btn"),
};

const BEST_KEY = "skyboundSpringsBest";

const config = {
  groundOffset: 68,
  gravity: 2500,
  jumpForce: 940,
  baseSpeed: 340,
  speedRamp: 170,
  difficultyScoreSpan: 500,
  maxDifficulty: 1.5,
  spawnBase: 1.2,
  spawnVariance: 0.55,
  obstacleWidth: { min: 32, max: 76 },
  obstacleHeight: { min: 38, max: 118 },
  scoreRate: 0.02,
  jumpFlashLife: 0.18,
  colors: ["#5ef5ff", "#7f74ff", "#ff84d8", "#4de0c2"],
};

const state = {
  phase: "idle",
  paused: true,
  obstacles: [],
  spawnTimer: config.spawnBase,
  score: 0,
  best: loadBestScore(),
  currentSpeed: config.baseSpeed,
  lastLoser: null,
  lastTime: 0,
  loadRatio: 0,
};

const players = [
  createPlayer({
    label: "Runner",
    x: 160,
    bodyColor: "#fefefe",
    accentColor: "#5ef5ff",
  }),
];

init();

function init() {
  resetToIdle();
  attachEvents();
  state.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function attachEvents() {
  controls.play?.addEventListener("click", () => {
    if (state.phase === "playing" && state.paused) {
      resumeRun();
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

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleJumpRequest();
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (
      event.code === "Space" ||
      event.code === "KeyW" ||
      event.code === "ArrowUp" ||
      event.code === "Numpad8"
    ) {
      event.preventDefault();
      handleJumpRequest();
      return;
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

  window.addEventListener("blur", () => {
    if (state.phase === "playing" && !state.paused) {
      pauseRun();
      setStatusText("Paused — focus lost.");
    }
  });
}

function gameLoop(timestamp = 0) {
  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.035) || 0;
  state.lastTime = timestamp;

  if (state.phase === "playing" && !state.paused) {
    update(delta);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  const ground = groundLine();
  for (const player of players) {
    player.vy += config.gravity * dt;
    player.y += player.vy * dt;

    if (player.y + player.height >= ground) {
      player.y = ground - player.height;
      player.vy = 0;
      player.grounded = true;
    }

    player.jumpFlash = Math.max(0, player.jumpFlash - dt);
  }

  const difficulty = Math.min(state.score / config.difficultyScoreSpan, config.maxDifficulty);
  state.currentSpeed = config.baseSpeed + config.speedRamp * difficulty;
  state.loadRatio = config.maxDifficulty > 0 ? difficulty / config.maxDifficulty : 0;

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
  }

  state.obstacles = state.obstacles.filter((obstacle) => {
    obstacle.x -= state.currentSpeed * dt;
    return obstacle.x + obstacle.width > -20;
  });

  for (const obstacle of state.obstacles) {
    for (const player of players) {
      if (intersectsPlayer(player, obstacle)) {
        endRun(player);
        return;
      }
    }
  }

  state.score += dt * state.currentSpeed * config.scoreRate;
  updateScoreUI();
  updateSpeedReadout();
  updateLoadBar();
}

function draw() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#162452");
  gradient.addColorStop(0.5, "#0c1430");
  gradient.addColorStop(1, "#050714");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawBackgroundStreaks();
  drawGround();
  drawObstacles();
  drawPlayers();
  drawJumpFlash();
  drawOverlay();
}

function drawBackgroundStreaks() {
  ctx.save();
  ctx.strokeStyle = "rgba(94,245,255,0.12)";
  ctx.lineWidth = 1;
  const width = canvas.width;
  const height = canvas.height;
  const offset = (state.score * 2) % width;
  for (let i = -1; i < 3; i += 1) {
    ctx.beginPath();
    const x = offset + i * (width / 3);
    ctx.moveTo(x, 0);
    ctx.lineTo(x - width * 0.4, height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGround() {
  const ground = groundLine();
  ctx.save();
  ctx.fillStyle = "#060b1d";
  ctx.fillRect(0, ground, canvas.width, canvas.height - ground);
  ctx.fillStyle = "rgba(94,245,255,0.08)";
  ctx.fillRect(0, ground - 10, canvas.width, 10);
  ctx.strokeStyle = "rgba(94,245,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ground);
  ctx.lineTo(canvas.width, ground);
  ctx.stroke();
  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    drawRoundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 10, obstacle.color);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.width - 8, 2);
  }
}

function drawPlayers() {
  for (const player of players) {
    drawPlayer(player);
  }
}

function drawPlayer(player) {
  drawRoundedRect(player.x, player.y, player.width, player.height, 12, player.bodyColor);
  ctx.save();
  ctx.fillStyle = "rgba(15,22,49,0.9)";
  ctx.fillRect(player.x + 12, player.y + 16, player.width - 24, 10);
  ctx.fillRect(player.x + 14, player.y + 32, player.width - 28, 12);
  ctx.fillStyle = player.accentColor;
  ctx.fillRect(player.x + player.width - 10, player.y + player.height - 18, 6, 14);
  ctx.restore();
}

function drawJumpFlash() {
  ctx.save();
  for (const player of players) {
    if (player.jumpFlash <= 0) continue;
    const ratio = player.jumpFlash / config.jumpFlashLife;
    ctx.strokeStyle = `rgba(94,245,255,${ratio * 0.9})`;
    ctx.lineWidth = 6 * ratio;
    const cx = player.x + player.width / 2;
    const cy = groundLine();
    const rx = 24 + (1 - ratio) * 50;
    const ry = 10 + (1 - ratio) * 16;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOverlay() {
  if (state.phase !== "over") return;
  ctx.save();
  ctx.fillStyle = "rgba(5, 6, 18, 0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fefefe";
  ctx.font = "700 36px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Run Over", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "600 18px Montserrat, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Tap Play to try again", canvas.width / 2, canvas.height / 2 + 22);
  ctx.restore();
}

function spawnObstacle() {
  const height = rand(config.obstacleHeight.min, config.obstacleHeight.max);
  const width = rand(config.obstacleWidth.min, config.obstacleWidth.max);
  const x = canvas.width + width;
  const y = groundLine() - height;
  const color = config.colors[Math.floor(Math.random() * config.colors.length)];
  state.obstacles.push({ x, y, width, height, color });
  const cadenceTrim = Math.min(state.score / 700, 0.6);
  state.spawnTimer = config.spawnBase - cadenceTrim + Math.random() * config.spawnVariance;
}

function handleJumpRequest() {
  const player = players[0];
  if (!player) return;
  if (state.phase === "idle" || state.phase === "over") {
    startRun();
  } else if (state.phase === "playing" && state.paused) {
    resumeRun();
  }
  jump(player);
}

function jump(player) {
  if (!player) return;
  if (state.phase !== "playing" || state.paused) return;
  if (!player.grounded) return;
  player.vy = -config.jumpForce;
  player.grounded = false;
  player.jumpFlash = config.jumpFlashLife;
}

function startRun() {
  state.phase = "playing";
  state.paused = false;
  state.score = 0;
  state.obstacles = [];
  state.spawnTimer = 0.8;
  state.currentSpeed = config.baseSpeed;
  state.jumpFlash = 0;
  state.loadRatio = 0;
  placePlayers();
  updateScoreUI();
  updateSpeedReadout();
  updateLoadBar(0);
  setStatusText(getStatusMessage());
  updateControls();
}

function resetToIdle(message) {
  state.phase = "idle";
  state.paused = true;
  state.obstacles = [];
  state.spawnTimer = config.spawnBase;
  state.score = 0;
  state.currentSpeed = config.baseSpeed;
  state.jumpFlash = 0;
  state.loadRatio = 0;
  placePlayers();
  updateScoreUI();
  updateSpeedReadout();
  updateLoadBar(0);
  setStatusText(message);
  updateControls();
}

function pauseRun() {
  if (state.phase !== "playing" || state.paused) return;
  state.paused = true;
  setStatusText(getStatusMessage());
  updateControls();
}

function resumeRun() {
  if (state.phase !== "playing" || !state.paused) return;
  state.paused = false;
  setStatusText(getStatusMessage());
  updateControls();
}

function endRun(loser) {
  state.phase = "over";
  state.paused = true;
  state.lastLoser = loser?.label ?? null;
  for (const player of players) {
    player.jumpFlash = 0;
  }
  setStatusText(getStatusMessage());
  updateControls();
}

function updateScoreUI() {
  const scoreValue = Math.max(0, Math.floor(state.score));
  if (ui.score) ui.score.textContent = scoreValue.toString();
  if (scoreValue > state.best) {
    state.best = scoreValue;
    saveBestScore(scoreValue);
  }
  if (ui.best) ui.best.textContent = state.best.toString();
}

function updateSpeedReadout() {
  const multiplier = (state.currentSpeed / config.baseSpeed).toFixed(1);
  if (ui.speed) {
    ui.speed.textContent = `${multiplier}x`;
  }
}

function updateLoadBar(ratio = state.loadRatio) {
  const safeRatio = Number.isFinite(ratio) ? ratio : 0;
  const clamped = Math.max(0, Math.min(safeRatio, 1));
  const percent = Math.round(clamped * 100);

  if (ui.loadFill) {
    ui.loadFill.style.width = `${percent}%`;
  }
  if (ui.loadTrack) {
    ui.loadTrack.setAttribute("aria-valuenow", percent.toString());
  }
  if (ui.loadText) {
    ui.loadText.textContent = `${percent}%`;
  }
}

function updateControls() {
  if (controls.pause) {
    controls.pause.disabled = state.phase !== "playing";
    controls.pause.textContent = state.phase === "playing" && state.paused ? "Resume" : "Pause";
  }
  if (controls.play) {
    let label = "Play";
    if (state.phase === "playing") {
      label = state.paused ? "Resume" : "Restart";
    }
    controls.play.textContent = label;
  }
}

function setStatusText(message) {
  if (ui.status) {
    ui.status.textContent = message;
  }
}

function getStatusMessage() {
  const controlHelp = "Jump with Space, click, or Arrow Up.";
  if (state.phase === "idle") return `Tap Play to begin. ${controlHelp}`;
  if (state.phase === "playing") {
    return state.paused ? "Paused — press Play or P." : controlHelp;
  }
  const loserMessage = state.lastLoser ? `${state.lastLoser} clipped a block!` : "You clipped a block!";
  return `${loserMessage} Tap Play to retry.`;
}

function placePlayers() {
  const ground = groundLine();
  for (const player of players) {
    player.y = ground - player.height;
    player.vy = 0;
    player.grounded = true;
    player.jumpFlash = 0;
  }
}

function groundLine() {
  return canvas.height - config.groundOffset;
}

function drawRoundedRect(x, y, width, height, radius, color) {
  ctx.save();
  const r = Math.min(radius, width / 2, height / 2);
  ctx.fillStyle = color;
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
  ctx.fill();
  ctx.restore();
}

function intersectsPlayer(player, obstacle) {
  return !(
    player.x + player.width < obstacle.x ||
    player.x > obstacle.x + obstacle.width ||
    player.y + player.height < obstacle.y ||
    player.y > obstacle.y + obstacle.height
  );
}

function createPlayer({ label, x, bodyColor, accentColor }) {
  return {
    label,
    width: 46,
    height: 54,
    x,
    y: 0,
    vy: 0,
    grounded: true,
    bodyColor,
    accentColor,
    jumpFlash: 0,
  };
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function loadBestScore() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (error) {
    console.error("Failed to read best score:", error);
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    console.error("Failed to save best score:", error);
  }
}
