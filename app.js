const canvas = document.getElementById("track-canvas");
const ctx = canvas?.getContext("2d");

const ui = {
  missionTime: document.getElementById("mission-time"),
  score: document.getElementById("score-value"),
  wave: document.getElementById("wave-value"),
  integrity: document.getElementById("integrity-value"),
  threat: document.getElementById("threat-value"),
  weaponStatus: document.getElementById("weapon-status"),
  weaponBtnState: document.getElementById("weapon-btn-state"),
  cornerTimer: document.getElementById("corner-timer"),
};

const controls = {
  reset: document.getElementById("reset-btn"),
  pause: document.getElementById("pause-btn"),
  fire: document.getElementById("fire-btn"),
};

const config = {
  worldWidth: 260,
  minDepth: 60,
  maxDepth: 640,
  cameraOffset: 220,
  cameraHeight: 150,
  cameraScreenOffset: 50,
  playerForwardSpeed: 280,
  playerBackwardSpeed: 220,
  strafeSpeed: 320,
  autoDrift: 40,
  bulletSpeed: 780,
  bulletLife: 1.4,
  fireCooldown: 0.22,
  enemySpawnInterval: 1.35,
  enemySpawnRamp: 0.94,
  enemyBaseSpeed: 92,
  enemyDamage: 18,
  integrityMax: 100,
  threatDecay: 22,
  threatGain: 45,
  gridStep: 42,
  starCount: 60,
  particleMax: 220,
  threatLabels: ["Trickle", "Pressing", "Storm", "Overrun", "Terminal"],
  threatThresholds: [0, 600, 1500, 2600, 4000],
};

const state = {
  running: false,
  paused: false,
  gameOver: false,
  lastTime: 0,
  elapsed: 0,
  player: createPlayer(),
  bullets: [],
  enemies: [],
  particles: [],
  starfield: [],
  spawnTimer: config.enemySpawnInterval,
  fireCooldown: 0,
  score: 0,
  wave: 1,
  integrity: config.integrityMax,
  threatMeter: 0,
  input: { forward: 0, right: 0, firing: false },
  keys: { forward: false, back: false, left: false, right: false },
};

function createPlayer() {
  return {
    x: 0,
    z: 140,
  };
}

function initStars() {
  const stars = [];
  for (let i = 0; i < config.starCount; i += 1) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4,
      speed: randRange(8, 32),
      size: Math.random() * 1.6 + 0.4,
    });
  }
  return stars;
}

function resetMission() {
  if (!ctx) return;
  state.player = createPlayer();
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.starfield = initStars();
  state.spawnTimer = config.enemySpawnInterval;
  state.fireCooldown = 0;
  state.score = 0;
  state.wave = 1;
  state.integrity = config.integrityMax;
  state.threatMeter = 0;
  state.elapsed = 0;
  state.lastTime = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  state.input.firing = false;
  updateHUD();
  updateWeaponIndicators();
  if (controls.pause) controls.pause.textContent = "Pause";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function threatLabel() {
  const thresholds = config.threatThresholds;
  for (let i = thresholds.length - 1; i >= 0; i -= 1) {
    if (state.threatMeter >= thresholds[i]) {
      return config.threatLabels[i] ?? config.threatLabels[0];
    }
  }
  return config.threatLabels[0];
}

function currentSpawnInterval() {
  const scaled = config.enemySpawnInterval * Math.pow(config.enemySpawnRamp, state.wave - 1);
  return clamp(scaled, 0.45, config.enemySpawnInterval);
}

function updateInputAxis() {
  const forward = (state.keys.forward ? 1 : 0) + (state.keys.back ? -1 : 0);
  const right = (state.keys.right ? 1 : 0) + (state.keys.left ? -1 : 0);
  state.input.forward = clamp(forward, -1, 1);
  state.input.right = clamp(right, -1, 1);
}

function movePlayer(dt) {
  const forward = state.input.forward;
  const forwardSpeed = forward >= 0 ? config.playerForwardSpeed : config.playerBackwardSpeed;
  state.player.z += (forward * forwardSpeed + config.autoDrift) * dt;
  state.player.z = clamp(state.player.z, config.minDepth, config.maxDepth);
  state.player.x += state.input.right * config.strafeSpeed * dt;
  state.player.x = clamp(state.player.x, -config.worldWidth, config.worldWidth);
}

function maybeFire(dt) {
  const wasCooling = state.fireCooldown > 0;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  if (wasCooling && state.fireCooldown === 0) {
    updateWeaponIndicators();
  }
  if (!state.running || state.paused) return;
  if (state.input.firing && state.fireCooldown === 0) {
    firePulse();
  }
}

function firePulse() {
  const dirInfluence = clamp(state.input.right * 40, -60, 60);
  state.bullets.push({
    x: state.player.x + dirInfluence * 0.02,
    z: state.player.z,
    vz: config.bulletSpeed,
    life: config.bulletLife,
    hue: randRange(170, 210),
    wobble: dirInfluence * 0.006,
    dead: false,
  });
  state.fireCooldown = config.fireCooldown;
  updateWeaponIndicators();
}

function spawnEnemy() {
  const spread = config.worldWidth * 0.9;
  const baseZ = state.player.z + randRange(360, 520);
  state.enemies.push({
    x: randRange(-spread, spread),
    z: baseZ,
    speed: config.enemyBaseSpeed + randRange(-12, 24) + state.wave * 8,
    radius: randRange(22, 32),
    hp: 1 + Math.floor(state.wave / 3),
    driftAmp: randRange(6, 32),
    driftFreq: randRange(0.5, 1.2),
    driftPhase: Math.random() * Math.PI * 2,
    alive: true,
  });
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.z += bullet.vz * dt;
    bullet.x += bullet.wobble * bullet.vz * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.z > state.player.z + config.maxDepth + 420) {
      bullet.dead = true;
    }
  }
}

function damagePlayer(amount = config.enemyDamage) {
  state.integrity = clamp(state.integrity - amount, 0, config.integrityMax);
  spawnParticles(state.player.x, state.player.z, 14, "#ff7b7b");
  if (state.integrity <= 0 && state.running) {
    endMission();
  }
}

function updateEnemies(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = currentSpawnInterval();
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.z -= enemy.speed * dt;
    enemy.x += Math.sin(state.elapsed * enemy.driftFreq + enemy.driftPhase) * enemy.driftAmp * dt;
    if (enemy.z <= state.player.z - 20) {
      enemy.alive = false;
      damagePlayer(enemy.radius * 0.4 + config.enemyDamage);
    } else {
      const dist = Math.hypot(enemy.x - state.player.x, enemy.z - state.player.z);
      if (dist < enemy.radius + 22) {
        enemy.alive = false;
        damagePlayer(enemy.radius * 0.6 + config.enemyDamage);
      }
    }
  }
}

function resolveCombat() {
  for (const bullet of state.bullets) {
    if (bullet.dead) continue;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - bullet.x;
      const dz = enemy.z - bullet.z;
      if (Math.hypot(dx, dz) <= enemy.radius + 8) {
        enemy.hp -= 1;
        bullet.dead = true;
        spawnParticles(bullet.x, bullet.z, 12, "#5df7ff");
        if (enemy.hp <= 0) {
          enemy.alive = false;
          creditKill(enemy);
        }
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((bullet) => !bullet.dead);
  state.enemies = state.enemies.filter((enemy) => {
    if (!enemy.alive) return false;
    return enemy.z > state.player.z - 80;
  });
}

function creditKill(enemy) {
  const reward = 120 + Math.round(enemy.speed);
  state.score += reward;
  state.threatMeter += config.threatGain + enemy.speed * 1.2;
  spawnParticles(enemy.x, enemy.z, 24, "#ff9df7");
}

function spawnParticles(x, z, count, color) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length > config.particleMax) break;
    state.particles.push({
      x,
      z,
      vx: randRange(-60, 60),
      vz: randRange(-120, 120),
      life: randRange(0.3, 0.8),
      maxLife: randRange(0.4, 0.9),
      color,
    });
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter((p) => {
    p.life -= dt;
    if (p.life <= 0) return false;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    return true;
  });
}

function updateWaveAndThreat(dt) {
  const nextWave = 1 + Math.floor(state.score / 600);
  if (nextWave !== state.wave) {
    state.wave = nextWave;
    state.threatMeter += 220;
  }
  state.threatMeter = Math.max(0, state.threatMeter - config.threatDecay * dt);
}

function updateHUD() {
  const timeLabel = formatTime(state.elapsed);
  if (ui.missionTime) ui.missionTime.textContent = timeLabel;
  if (ui.cornerTimer) ui.cornerTimer.textContent = timeLabel;
  if (ui.score) ui.score.textContent = state.score.toLocaleString();
  if (ui.wave) ui.wave.textContent = state.wave.toString();
  if (ui.integrity) ui.integrity.textContent = `${Math.round((state.integrity / config.integrityMax) * 100)}%`;
  if (ui.threat) ui.threat.textContent = threatLabel();
}

function updateWeaponIndicators() {
  const ready = state.fireCooldown === 0 && state.running && !state.paused;
  const label = !state.running
    ? "Offline"
    : state.paused
    ? "Paused"
    : ready
    ? "Ready"
    : "Cooling";
  if (ui.weaponStatus) ui.weaponStatus.textContent = label;
  if (ui.weaponBtnState) ui.weaponBtnState.textContent = label;
  if (controls.fire) {
    controls.fire.dataset.state = ready ? "ready" : "cooldown";
    controls.fire.disabled = !state.running || state.gameOver;
  }
}

function setPaused(value) {
  if (!state.running && !value) return;
  state.paused = value;
  if (controls.pause) controls.pause.textContent = state.paused ? "Resume" : "Pause";
  if (!state.paused) {
    state.lastTime = 0;
  }
  updateWeaponIndicators();
}

function togglePause() {
  setPaused(!state.paused);
}

function endMission() {
  state.running = false;
  state.gameOver = true;
  state.input.firing = false;
  updateHUD();
  updateWeaponIndicators();
}

function update(timestamp) {
  if (!canvas || !ctx) return;
  if (!state.lastTime) state.lastTime = timestamp;
  let dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  if (state.paused) {
    dt = 0;
  }

  if (state.running && dt > 0) {
    state.elapsed += dt;
    updateInputAxis();
    movePlayer(dt);
    maybeFire(dt);
    updateBullets(dt);
    updateEnemies(dt);
    resolveCombat();
    updateParticles(dt);
    updateWaveAndThreat(dt);
    updateHUD();
  } else if (!state.running && !state.paused) {
    updateParticles(dt || 0.016);
  }

  render(timestamp);
  requestAnimationFrame(update);
}

function projectPoint(x, z, height = 0) {
  if (!canvas) return null;
  const cameraZ = state.player.z - config.cameraOffset;
  const depth = z - cameraZ;
  if (depth <= 12) return null;
  const scale = 260 / depth;
  const screenX = canvas.width / 2 + x * scale;
  const screenY = canvas.height - (height + config.cameraHeight) * scale - config.cameraScreenOffset;
  return { x: screenX, y: screenY, scale };
}

function drawBackground(time) {
  if (!ctx || !canvas) return;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#060013");
  gradient.addColorStop(0.35, "#0a0320");
  gradient.addColorStop(0.65, "#050116");
  gradient.addColorStop(1, "#020007");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  for (const star of state.starfield) {
    ctx.globalAlpha = clamp(0.35 + Math.sin(time * 0.001 + star.x) * 0.15, 0.2, 0.8);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
    star.x -= star.speed * 0.05;
    if (star.x < -4) {
      star.x = canvas.width + randRange(0, 40);
      star.y = Math.random() * canvas.height * 0.4;
    }
  }
  ctx.restore();
}

function drawGroundGrid(time) {
  if (!ctx || !canvas) return;
  const horizonY = canvas.height * 0.32;
  const gradient = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
  gradient.addColorStop(0, "rgba(16, 16, 60, 0.3)");
  gradient.addColorStop(1, "#05000a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

  ctx.save();
  ctx.strokeStyle = "rgba(111, 196, 255, 0.25)";
  ctx.lineWidth = 1;

  for (let i = 1; i < 26; i += 1) {
    const z = state.player.z + i * config.gridStep;
    const left = projectPoint(-config.worldWidth * 1.4, z);
    const right = projectPoint(config.worldWidth * 1.4, z);
    if (!left || !right) continue;
    ctx.globalAlpha = clamp(1 - i * 0.04, 0, 0.7);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }

  const laneCount = 6;
  for (let i = -laneCount; i <= laneCount; i += 1) {
    const x = (i / laneCount) * config.worldWidth;
    const top = projectPoint(x, state.player.z + config.gridStep * 2);
    const bottom = projectPoint(x, state.player.z + config.gridStep * 24);
    if (!top || !bottom) continue;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 120, 240, 0.12)";
  ctx.filter = "blur(24px)";
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height * 0.92, 280, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  if (!ctx) return;
  const projected = projectPoint(state.player.x, state.player.z, 0);
  if (!projected) return;
  const scale = clamp(projected.scale, 0.35, 1.25);
  const bodyHeight = clamp(105 * scale, 40, 150);
  const torsoHeight = bodyHeight * 0.55;
  const torsoWidth = bodyHeight * 0.2;
  const headRadius = bodyHeight * 0.12;
  const limbLength = bodyHeight * 0.45;
  const lean = clamp(state.input.right * 0.55, -0.9, 0.9);
  const sprint = clamp(state.input.forward, -1, 1);
  const stride = Math.sin(state.elapsed * 8.5 + state.player.z * 0.01) * sprint;

  ctx.save();
  ctx.translate(projected.x, projected.y);
  ctx.rotate(lean * 0.22);
  ctx.lineCap = "round";

  ctx.fillStyle = "rgba(96, 245, 255, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, bodyHeight * 0.2, bodyHeight * 0.5, bodyHeight * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(77, 210, 255, 0.9)";
  ctx.lineWidth = clamp(6.5 * scale, 2, 8);
  ctx.beginPath();
  ctx.moveTo(-torsoWidth * 0.7, 0);
  ctx.lineTo(-torsoWidth * 0.2 - lean * 4, limbLength * 0.95 + stride * 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(torsoWidth * 0.7, 0);
  ctx.lineTo(torsoWidth * 0.2 - lean * 4, limbLength * 0.95 - stride * 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 161, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-torsoWidth * 0.2 - lean * 4, limbLength * 0.95 + stride * 8, headRadius * 0.4, headRadius * 0.2, 0, 0, Math.PI * 2);
  ctx.ellipse(torsoWidth * 0.2 - lean * 4, limbLength * 0.95 - stride * 8, headRadius * 0.4, headRadius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const torsoGradient = ctx.createLinearGradient(0, -torsoHeight, 0, 0);
  torsoGradient.addColorStop(0, "#e6fbff");
  torsoGradient.addColorStop(0.65, "#7ad7ff");
  torsoGradient.addColorStop(1, "#3482ff");
  ctx.fillStyle = torsoGradient;
  ctx.beginPath();
  ctx.moveTo(-torsoWidth, 0);
  ctx.lineTo(-torsoWidth * 1.1, -torsoHeight * 0.35);
  ctx.quadraticCurveTo(0, -torsoHeight * 1.1, torsoWidth * 1.1, -torsoHeight * 0.35);
  ctx.lineTo(torsoWidth, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = clamp(3 * scale, 1.2, 4);
  ctx.beginPath();
  ctx.moveTo(0, -torsoHeight * 1.02);
  ctx.lineTo(0, -torsoHeight * 0.05);
  ctx.stroke();

  ctx.strokeStyle = "rgba(214, 251, 255, 0.9)";
  ctx.lineWidth = clamp(5 * scale, 1.5, 6);
  ctx.beginPath();
  ctx.moveTo(-torsoWidth * 1.05, -torsoHeight * 0.5);
  ctx.lineTo(-torsoWidth * 0.2 - stride * 5, -torsoHeight * 0.1 + sprint * 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(torsoWidth * 1.05, -torsoHeight * 0.5);
  ctx.lineTo(torsoWidth * 0.2 - stride * 5, -torsoHeight * 0.1 - sprint * 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(93, 247, 255, 0.85)";
  ctx.beginPath();
  ctx.arc(-torsoWidth * 0.2 - stride * 5, -torsoHeight * 0.1 + sprint * 8, headRadius * 0.45, 0, Math.PI * 2);
  ctx.arc(torsoWidth * 0.2 - stride * 5, -torsoHeight * 0.1 - sprint * 8, headRadius * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(14, 24, 48, 0.7)";
  const plateWidth = torsoWidth * 1.2;
  const plateHeight = torsoHeight * 0.35;
  const plateX = -plateWidth / 2;
  const plateY = -torsoHeight * 0.55;
  const plateRadius = plateWidth * 0.25;
  ctx.beginPath();
  ctx.moveTo(plateX + plateRadius, plateY);
  ctx.lineTo(plateX + plateWidth - plateRadius, plateY);
  ctx.quadraticCurveTo(plateX + plateWidth, plateY, plateX + plateWidth, plateY + plateRadius);
  ctx.lineTo(plateX + plateWidth, plateY + plateHeight - plateRadius);
  ctx.quadraticCurveTo(plateX + plateWidth, plateY + plateHeight, plateX + plateWidth - plateRadius, plateY + plateHeight);
  ctx.lineTo(plateX + plateRadius, plateY + plateHeight);
  ctx.quadraticCurveTo(plateX, plateY + plateHeight, plateX, plateY + plateHeight - plateRadius);
  ctx.lineTo(plateX, plateY + plateRadius);
  ctx.quadraticCurveTo(plateX, plateY, plateX + plateRadius, plateY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(93, 247, 255, 0.65)";
  ctx.fillRect(-plateWidth * 0.35, plateY + plateHeight * 0.22, plateWidth * 0.7, plateHeight * 0.22);

  const headY = -torsoHeight - headRadius * 0.4;
  const helmetGradient = ctx.createRadialGradient(0, headY - headRadius * 0.2, headRadius * 0.3, 0, headY - headRadius * 0.2, headRadius);
  helmetGradient.addColorStop(0, "#ffffff");
  helmetGradient.addColorStop(0.5, "#b3f3ff");
  helmetGradient.addColorStop(1, "#3e6fff");
  ctx.fillStyle = helmetGradient;
  ctx.beginPath();
  ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(6, 13, 34, 0.8)";
  ctx.fillRect(-headRadius * 0.6, headY - headRadius * 0.4, headRadius * 1.2, headRadius * 0.65);
  ctx.fillStyle = "rgba(122, 244, 255, 0.75)";
  ctx.fillRect(-headRadius * 0.5, headY - headRadius * 0.32, headRadius, headRadius * 0.35);

  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    const projected = projectPoint(bullet.x, bullet.z, 0);
    if (!projected) continue;
    const radius = clamp(8 * projected.scale, 3, 12);
    const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius);
    gradient.addColorStop(0, `hsla(${bullet.hue}, 95%, 75%, 0.95)`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    const projected = projectPoint(enemy.x, enemy.z, 0);
    if (!projected) continue;
    const radius = clamp(enemy.radius * projected.scale, 6, 40);
    ctx.save();
    ctx.translate(projected.x, projected.y);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, "rgba(255, 153, 230, 0.9)");
    gradient.addColorStop(0.6, "rgba(255, 116, 190, 0.7)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTargetIndicators() {
  if (!ctx) return;
  const liveEnemies = state.enemies.filter((enemy) => enemy.alive);
  if (!liveEnemies.length) return;
  const highlighted = [...liveEnemies].sort((a, b) => a.z - b.z).slice(0, Math.min(4, liveEnemies.length));
  const time = state.elapsed;

  for (let i = 0; i < highlighted.length; i += 1) {
    const enemy = highlighted[i];
    const projected = projectPoint(enemy.x, enemy.z, 0);
    if (!projected) continue;
    const radius = clamp(enemy.radius * projected.scale * 1.35, 10, 60);
    const pulse = 0.45 + 0.4 * Math.sin(time * 5 + enemy.z * 0.01);

    ctx.save();
    ctx.translate(projected.x, projected.y);
    ctx.strokeStyle = `rgba(255, 224, 173, ${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 1.4 + pulse * 0.6;
    ctx.setLineDash([radius * 0.5, radius * 0.2]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-radius - 6, 0);
    ctx.lineTo(-radius - 18, 0);
    ctx.moveTo(radius + 6, 0);
    ctx.lineTo(radius + 18, 0);
    ctx.moveTo(0, -radius - 6);
    ctx.lineTo(0, -radius - 18);
    ctx.moveTo(0, radius + 6);
    ctx.lineTo(0, radius + 18);
    ctx.stroke();

    ctx.font = "600 12px Montserrat, sans-serif";
    ctx.fillStyle = "rgba(255, 241, 205, 0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`Target ${i + 1}`, 0, radius + 14);
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.max(0, Math.round(enemy.z - state.player.z))}m`, 0, -radius - 12);
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    const projected = projectPoint(particle.x, particle.z, 0);
    if (!projected) continue;
    const radius = clamp(10 * projected.scale, 2, 10);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (!state.gameOver && !state.paused) return;
  ctx.save();
  ctx.fillStyle = "rgba(4, 6, 18, 0.78)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f6fcff";
  ctx.font = "700 48px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const title = state.gameOver ? "Integrity Lost" : "Paused";
  const subtitle = state.gameOver ? "Press R or Deploy Again to restart" : "Press P or Resume to continue";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "500 20px Montserrat, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
  ctx.restore();
}

function render(time = 0) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(time);
  drawGroundGrid(time);
  drawBullets();
  drawEnemies();
  drawTargetIndicators();
  drawParticles();
  drawPlayer();
  drawOverlay();
}

function handleKeyDown(event) {
  if (event.repeat) return;
  switch (event.key) {
    case "w":
    case "W":
    case "ArrowUp":
      state.keys.forward = true;
      break;
    case "s":
    case "S":
    case "ArrowDown":
      state.keys.back = true;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      state.keys.left = true;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      state.keys.right = true;
      break;
    case " ":
    case "Spacebar":
      event.preventDefault();
      state.input.firing = true;
      break;
    case "p":
    case "P":
      togglePause();
      break;
    case "r":
    case "R":
      resetMission();
      break;
    default:
      break;
  }
}

function handleKeyUp(event) {
  switch (event.key) {
    case "w":
    case "W":
    case "ArrowUp":
      state.keys.forward = false;
      break;
    case "s":
    case "S":
    case "ArrowDown":
      state.keys.back = false;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      state.keys.left = false;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      state.keys.right = false;
      break;
    case " ":
    case "Spacebar":
      state.input.firing = false;
      break;
    default:
      break;
  }
}

function handlePointerDown(event) {
  event.preventDefault();
  state.input.firing = true;
}

function handlePointerUp(event) {
  event.preventDefault();
  state.input.firing = false;
}

function attachEvents() {
  if (controls.reset) controls.reset.addEventListener("click", resetMission);
  if (controls.pause) controls.pause.addEventListener("click", togglePause);
  if (controls.fire) {
    controls.fire.addEventListener("pointerdown", handlePointerDown);
    controls.fire.addEventListener("pointerup", handlePointerUp);
    controls.fire.addEventListener("pointerleave", handlePointerUp);
    controls.fire.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointerleave", handlePointerUp);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => {
    state.input.firing = false;
    state.keys = { forward: false, back: false, left: false, right: false };
    setPaused(true);
  });
}

function init() {
  if (!canvas || !ctx) return;
  attachEvents();
  resetMission();
  requestAnimationFrame(update);
}

init();
