const canvas = document.getElementById("game-canvas");
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

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life += dt;
    return particle.life < particle.maxLife;
  });
}

function updateHud() {
  distanceEl.textContent = `${state.distance}m`;
  bestEl.textContent = `${state.bestDistance}m`;
  const blocksPerSecond = (state.speed / 60).toFixed(1);
  paceEl.textContent = `${blocksPerSecond} b/s`;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#92e0ff");
  gradient.addColorStop(0.6, "#b0f7ff");
  gradient.addColorStop(1, "#c7ffe3");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  for (let i = 0; i < 8; i += 1) {
    const width = 110 + ((i * 37) % 70);
    const height = 24 + ((i * 19) % 18);
    const scroll = (state.cameraX * 0.18 + i * 140) % (canvas.width + width);
    const x = scroll - width;
    const y = 70 + (i % 3) * 42;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

function drawIslands() {
  const block = 16;
  state.platforms.forEach((platform) => {
    const screenX = platform.x - state.cameraX;
    if (screenX > canvas.width + 200 || screenX + platform.width < -200) return;

    ctx.save();
    ctx.translate(screenX, platform.y);

    ctx.fillStyle = "#4caf50";
    ctx.fillRect(0, -12, platform.width, 18);

    ctx.fillStyle = "#7c4a17";
    ctx.fillRect(0, 6, platform.width, platform.height - 6);

    for (let x = 0; x < platform.width; x += block) {
      ctx.fillStyle = x % (block * 2) === 0 ? "#6b3b16" : "#84501f";
      ctx.fillRect(x, 6, block, platform.height - 6);
    }

    ctx.restore();
  });
}

function drawPlayer() {
  const player = state.player;
  const screenX = player.x - state.cameraX;

  ctx.save();
  ctx.translate(screenX, player.y);
  ctx.fillStyle = "#fdfcf7";
  ctx.strokeStyle = "#1f1c1c";
  ctx.lineWidth = 3;
  ctx.fillRect(0, 0, player.width, player.height);
  ctx.strokeRect(0, 0, player.width, player.height);

  ctx.fillStyle = "#7cdbf5";
  ctx.fillRect(8, 8, 10, 10);
  ctx.fillRect(player.width - 18, 8, 10, 10);
  ctx.restore();
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = 1 - particle.life / particle.maxLife;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(particle.x - state.cameraX, particle.y, 6, 6);
    ctx.restore();
  });
}

function drawOverlay() {
  if (state.isRunning) return;
  ctx.save();
  ctx.fillStyle = "rgba(14, 30, 41, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f6fffb";
  ctx.textAlign = "center";
  ctx.font = "bold 36px Montserrat, sans-serif";
  ctx.fillText("You slipped!", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "20px Montserrat, sans-serif";
  ctx.fillText(`Final Distance: ${state.distance}m`, canvas.width / 2, canvas.height / 2 + 26);
  ctx.fillText("Press R or the restart button to run again", canvas.width / 2, canvas.height / 2 + 54);
  ctx.restore();
}

function render() {
  drawBackground();
  drawIslands();
  drawPlayer();
  drawParticles();
  drawOverlay();
}

resetBtn.addEventListener("click", resetGame);

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "Space", "KeyW"].includes(event.code)) {
    event.preventDefault();
    if (state.isRunning) queueJump();
  }
  if (event.code === "KeyR") {
    resetGame();
  }
});

resetGame();
requestAnimationFrame(update);
