const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const livesEl = document.getElementById("lives");
const killsEl = document.getElementById("kills");
const gunEl = document.getElementById("gun");
const resetBtn = document.getElementById("reset-btn");

const guns = [
  {
    name: "Starter Pistol",
    fireRate: 280,
    bulletSpeed: 520,
    damage: 1,
    pellets: 1,
    spread: 0.02,
    color: "#fefefe",
  },
  {
    name: "Auto SMG",
    fireRate: 110,
    bulletSpeed: 460,
    damage: 0.55,
    pellets: 1,
    spread: 0.07,
    color: "#8af0ff",
  },
  {
    name: "Slug Cannon",
    fireRate: 600,
    bulletSpeed: 640,
    damage: 2.2,
    pellets: 1,
    spread: 0.01,
    color: "#ffbb6e",
  },
  {
    name: "Tri-Beam Laser",
    fireRate: 260,
    bulletSpeed: 720,
    damage: 0.9,
    pellets: 3,
    spread: 0.04,
    color: "#a18bff",
  },
  {
    name: "Pulse Shotgun",
    fireRate: 420,
    bulletSpeed: 520,
    damage: 0.65,
    pellets: 6,
    spread: 0.15,
    color: "#ff6db9",
  },
];

const state = {
  player: null,
  bullets: [],
  enemies: [],
  particles: [],
  lives: 10,
  kills: 0,
  gunIndex: 0,
  isRunning: true,
  pointer: { x: canvas.width / 2, y: canvas.height / 2 },
  pointerDown: false,
  keys: new Set(),
  spawnTimer: 0,
  spawnInterval: 1.4,
  lastTime: 0,
};

function createPlayer() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 18,
    speed: 240,
    lastShot: 0,
    invulnerableUntil: 0,
  };
}

function resetGame() {
  state.player = createPlayer();
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.lives = 10;
  state.kills = 0;
  state.gunIndex = 0;
  state.spawnInterval = 1.4;
  state.spawnTimer = 0;
  state.lastTime = 0;
  state.isRunning = true;
  state.pointer.x = canvas.width / 2;
  state.pointer.y = canvas.height / 2;
  state.pointerDown = false;
  state.keys.clear();
  updateHud();
}

function currentGun() {
  return guns[state.gunIndex];
}

function updateHud() {
  livesEl.textContent = state.lives.toString();
  killsEl.textContent = state.kills.toString();
  gunEl.textContent = currentGun().name;
}

resetBtn.addEventListener("click", () => {
  resetGame();
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.pointer.x = event.clientX - rect.left;
  state.pointer.y = event.clientY - rect.top;
});

canvas.addEventListener("mousedown", () => {
  state.pointerDown = true;
});

window.addEventListener("mouseup", () => {
  state.pointerDown = false;
});

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  state.keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

function tryShoot(timestamp) {
  if (!state.pointerDown || !state.isRunning) return;
  const gun = currentGun();
  if (timestamp - state.player.lastShot < gun.fireRate) return;

  const angle = Math.atan2(state.pointer.y - state.player.y, state.pointer.x - state.player.x);

  for (let i = 0; i < gun.pellets; i += 1) {
    const offset = (Math.random() - 0.5) * gun.spread;
    const dir = angle + offset;
    const vx = Math.cos(dir) * gun.bulletSpeed;
    const vy = Math.sin(dir) * gun.bulletSpeed;
    state.bullets.push({
      x: state.player.x,
      y: state.player.y,
      vx,
      vy,
      damage: gun.damage,
      life: 0,
      maxLife: 1.5,
      color: gun.color,
    });
  }

  state.player.lastShot = timestamp;
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;
  if (edge === 0) {
    x = Math.random() * canvas.width;
    y = -30;
  } else if (edge === 1) {
    x = canvas.width + 30;
    y = Math.random() * canvas.height;
  } else if (edge === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + 30;
  } else {
    x = -30;
    y = Math.random() * canvas.height;
  }

  const radius = 16 + Math.random() * 10;
  const baseSpeed = 50 + Math.random() * 40;
  const speedBoost = Math.min(120, state.kills * 1.5);
  const speed = baseSpeed + speedBoost;
  const hp = 1 + Math.floor(state.kills / 6);

  state.enemies.push({
    x,
    y,
    radius,
    speed,
    hp,
  });
}

function updatePlayer(dt) {
  const player = state.player;
  if (!player) return;

  let moveX = 0;
  let moveY = 0;

  if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) moveY -= 1;
  if (state.keys.has("KeyS") || state.keys.has("ArrowDown")) moveY += 1;
  if (state.keys.has("KeyA") || state.keys.has("ArrowLeft")) moveX -= 1;
  if (state.keys.has("KeyD") || state.keys.has("ArrowRight")) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    moveX /= length;
    moveY /= length;
  }

  player.x += moveX * player.speed * dt;
  player.y += moveY * player.speed * dt;

  player.x = Math.min(Math.max(player.radius, player.x), canvas.width - player.radius);
  player.y = Math.min(Math.max(player.radius, player.y), canvas.height - player.radius);
}

function updateBullets(dt) {
  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life += dt;
    const onCanvas =
      bullet.x > -40 && bullet.x < canvas.width + 40 && bullet.y > -40 && bullet.y < canvas.height + 40;
    return bullet.life < bullet.maxLife && onCanvas;
  });
}

function updateEnemies(dt, timestamp) {
  const player = state.player;

  state.enemies.forEach((enemy) => {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;
  });

  // Bullet collisions
  state.enemies = state.enemies.filter((enemy) => {
    let alive = true;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
      if (dist < enemy.radius) {
        enemy.hp -= bullet.damage;
        state.bullets.splice(i, 1);
        if (enemy.hp <= 0) {
          handleEnemyDown(enemy);
          alive = false;
        }
        break;
      }
    }
    return alive;
  });

  // Player collisions
  if (!state.isRunning) return;
  if (timestamp < state.player.invulnerableUntil) return;

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < enemy.radius + player.radius) {
      state.enemies.splice(i, 1);
      applyDamage();
      state.player.invulnerableUntil = timestamp + 650;
      break;
    }
  }
}

function handleEnemyDown(enemy) {
  state.kills += 1;
  cycleGun();
  maybeTightenSpawn();
  spawnParticles(enemy.x, enemy.y);
  updateHud();
}

function applyDamage() {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    state.isRunning = false;
  }
  updateHud();
}

function cycleGun() {
  state.gunIndex = (state.gunIndex + 1) % guns.length;
}

function maybeTightenSpawn() {
  const target = Math.max(0.5, 1.4 - state.kills * 0.018);
  state.spawnInterval = target;
}

function spawnParticles(x, y) {
  for (let i = 0; i < 10; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
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

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#070918");
  gradient.addColorStop(1, "#1b1036");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x <= canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const player = state.player;
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = "#fdf5ff";
  ctx.shadowColor = "#a060ff";
  ctx.shadowBlur = 20;
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPointer() {
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.setLineDash([4, 6]);
  ctx.arc(state.pointer.x, state.pointer.y, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 12;
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,91,91,0.85)";
    ctx.shadowColor = "#ff2c54";
    ctx.shadowBlur = 20;
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = 1 - particle.life / particle.maxLife;
    ctx.fillStyle = "#ffbeff";
    ctx.fillRect(particle.x, particle.y, 3, 3);
    ctx.restore();
  });
}

function drawOverlay() {
  if (state.isRunning) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 36px Montserrat, sans-serif";
  ctx.fillText("Run Over", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "20px Montserrat, sans-serif";
  ctx.fillText(`Final Kills: ${state.kills}`, canvas.width / 2, canvas.height / 2 + 26);
  ctx.fillText("Click restart to try again", canvas.width / 2, canvas.height / 2 + 54);
  ctx.restore();
}

function update(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  if (state.isRunning) {
    handleSpawning(dt);
    updatePlayer(dt);
    tryShoot(timestamp);
    updateBullets(dt);
    updateEnemies(dt, timestamp);
    updateParticles(dt);
  } else {
    updateParticles(dt);
  }

  render();
  requestAnimationFrame(update);
}

function handleSpawning(dt) {
  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnInterval) {
    spawnEnemy();
    state.spawnTimer = 0;
  }
}

function render() {
  drawBackground();
  drawGrid();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawPointer();
  drawOverlay();
}

resetGame();
updateHud();
requestAnimationFrame(update);
