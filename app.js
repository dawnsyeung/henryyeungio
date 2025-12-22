const canvas = document.getElementById("expedition-canvas");
const ctx = canvas?.getContext("2d");

if (!canvas || !ctx) {
  throw new Error("Missing canvas element #expedition-canvas.");
}

const ui = {
  p1: document.getElementById("p1-health-value"),
  p2: document.getElementById("p2-health-value"),
  round: document.getElementById("round-value"),
  timer: document.getElementById("timer-value"),
  coins: document.getElementById("coins-value"),
  status: document.getElementById("status-text"),
  meterTrack: document.getElementById("meter-track"),
  meterFill: document.getElementById("meter-fill"),
  meterText: document.getElementById("meter-text"),
};

const controls = {
  play: document.getElementById("play-btn"),
  pause: document.getElementById("pause-btn"),
  reset: document.getElementById("reset-btn"),
};

const config = {
  world: {
    padding: 40,
    gravity: 2600,
    floorHeight: 90,
    wallFriction: 0.98,
    airDrag: 0.995,
  },
  round: {
    timeSeconds: 60,
    betweenRoundsDelay: 1.2,
  },
  fighter: {
    maxHealth: 100,
    radius: 16,
    bodyHeight: 86,
    moveSpeed: 420,
    jumpVelocity: 980,
    groundFriction: 0.82,
    blockDamageMultiplier: 0.35,
    invulnOnHit: 0.22,
  },
  attacks: {
    punch: {
      windup: 0.08,
      active: 0.10,
      recovery: 0.18,
      damage: 8,
      hitstun: 0.18,
      knockbackX: 520,
      knockbackY: 160,
      range: 56,
      height: 42,
    },
    kick: {
      windup: 0.12,
      active: 0.12,
      recovery: 0.26,
      damage: 14,
      hitstun: 0.24,
      knockbackX: 780,
      knockbackY: 240,
      range: 74,
      height: 46,
    },
  },
  meter: {
    gainOnHit: 0.12,
    gainOnDamageTaken: 0.08,
  },
  visuals: {
    bgTop: "#070a17",
    bgBottom: "#050710",
    floor: "rgba(255,255,255,0.06)",
    floorLine: "rgba(94,245,255,0.22)",
    p1: "#66faff",
    p2: "#ff7ae6",
    text: "rgba(255,255,255,0.9)",
    muted: "rgba(255,255,255,0.68)",
  },
};

const input = {
  p1: { left: false, right: false, jump: false, punch: false, kick: false, block: false },
  p2: { left: false, right: false, jump: false, punch: false, kick: false, block: false },
};

const COIN_STORAGE_KEY = "stickmanBattle.coins";
const WIN_COIN_REWARD = 50;

function loadCoins() {
  try {
    const raw = localStorage.getItem(COIN_STORAGE_KEY);
    const parsed = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveCoins(coins) {
  try {
    localStorage.setItem(COIN_STORAGE_KEY, String(Math.max(0, Math.floor(coins))));
  } catch {
    // ignore (storage may be blocked)
  }
}

function addCoins(amount) {
  state.coins = Math.max(0, Math.floor(state.coins + amount));
  saveCoins(state.coins);
  updateUI();
}

const state = {
  phase: "idle", // idle | playing | over
  paused: true,
  round: 1,
  timeLeft: config.round.timeSeconds,
  winnerText: "",
  coins: loadCoins(),
  lastTime: performance.now(),
  betweenRounds: 0,
  meter: 0, // 0..1 (shared "special meter" just for UI flair)
};

const arena = {
  floorY: canvas.height - config.world.floorHeight,
  leftX: config.world.padding,
  rightX: canvas.width - config.world.padding,
};

const p1 = createFighter({
  id: "p1",
  color: config.visuals.p1,
  x: canvas.width * 0.32,
  y: arena.floorY,
  facing: 1,
  controls: input.p1,
});

const p2 = createFighter({
  id: "p2",
  color: config.visuals.p2,
  x: canvas.width * 0.68,
  y: arena.floorY,
  facing: -1,
  controls: input.p2,
});

init();

function init() {
  attachEvents();
  resetToIdle();
  requestAnimationFrame(loop);
}

function attachEvents() {
  controls.play?.addEventListener("click", () => {
    if (state.phase === "playing" && state.paused) resume();
    else start();
  });

  controls.pause?.addEventListener("click", () => {
    if (state.phase !== "playing") return;
    state.paused ? resume() : pause();
  });

  controls.reset?.addEventListener("click", () => {
    resetToIdle();
  });

  canvas.addEventListener("pointerdown", () => {
    if (state.phase === "playing" && state.paused) resume();
    else if (state.phase !== "playing") start();
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    // Global
    if (event.code === "KeyP") {
      event.preventDefault();
      if (state.phase === "playing") state.paused ? resume() : pause();
      return;
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      start();
      return;
    }

    // P1: A/D move, W jump, F punch, G kick, S block
    if (event.code === "KeyA") input.p1.left = true;
    if (event.code === "KeyD") input.p1.right = true;
    if (event.code === "KeyW") input.p1.jump = true;
    if (event.code === "KeyF") input.p1.punch = true;
    if (event.code === "KeyG") input.p1.kick = true;
    if (event.code === "KeyS") input.p1.block = true;

    // P2: Arrows move/jump, / punch, . kick, Down block
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      input.p2.left = true;
    }
    if (event.code === "ArrowRight") {
      event.preventDefault();
      input.p2.right = true;
    }
    if (event.code === "ArrowUp") {
      event.preventDefault();
      input.p2.jump = true;
    }
    if (event.code === "Slash") input.p2.punch = true;
    if (event.code === "Period") input.p2.kick = true;
    if (event.code === "ArrowDown") {
      event.preventDefault();
      input.p2.block = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyA") input.p1.left = false;
    if (event.code === "KeyD") input.p1.right = false;
    if (event.code === "KeyW") input.p1.jump = false;
    if (event.code === "KeyF") input.p1.punch = false;
    if (event.code === "KeyG") input.p1.kick = false;
    if (event.code === "KeyS") input.p1.block = false;

    if (event.code === "ArrowLeft") input.p2.left = false;
    if (event.code === "ArrowRight") input.p2.right = false;
    if (event.code === "ArrowUp") input.p2.jump = false;
    if (event.code === "Slash") input.p2.punch = false;
    if (event.code === "Period") input.p2.kick = false;
    if (event.code === "ArrowDown") input.p2.block = false;
  });

  window.addEventListener("blur", () => {
    if (state.phase === "playing" && !state.paused) {
      pause();
      setStatus("Paused — focus lost.");
    }
  });
}

function loop(timestamp = 0) {
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.04) || 0;
  state.lastTime = timestamp;

  if (state.phase === "playing" && !state.paused) {
    update(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (state.betweenRounds > 0) {
    state.betweenRounds = Math.max(0, state.betweenRounds - dt);
    // Freeze fighters between rounds so no one gets "free" hits before the next start.
    p1.vx = 0;
    p1.vy = 0;
    p2.vx = 0;
    p2.vy = 0;
    updateUI();
    return;
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);

  // Face each other
  p1.facing = p2.x >= p1.x ? 1 : -1;
  p2.facing = p1.x >= p2.x ? 1 : -1;

  updateFighter(p1, p2, dt);
  updateFighter(p2, p1, dt);

  resolveAttack(p1, p2);
  resolveAttack(p2, p1);

  state.meter = clamp01(state.meter - dt * 0.06);
  updateUI();

  if (p1.health <= 0 || p2.health <= 0 || state.timeLeft <= 0) {
    endRound();
  }
}

function updateFighter(me, other, dt) {
  if (me.dead) return;

  if (me.invuln > 0) me.invuln = Math.max(0, me.invuln - dt);
  if (me.hitstun > 0) me.hitstun = Math.max(0, me.hitstun - dt);

  // Attack timer
  if (me.attack.timer > 0) {
    me.attack.timer = Math.max(0, me.attack.timer - dt);
    const def = me.attack.def;
    if (!def) {
      me.attack.phase = "none";
    } else {
      const total = def.windup + def.active + def.recovery;
      const elapsed = total - me.attack.timer;
      if (elapsed < def.windup) me.attack.phase = "windup";
      else if (elapsed < def.windup + def.active) me.attack.phase = "active";
      else me.attack.phase = "recovery";
    }
    if (me.attack.timer <= 0) {
      me.attack.def = null;
      me.attack.phase = "none";
      me.attack.hasHit = false;
    }
  }

  const onGround = me.y >= arena.floorY;
  if (onGround) {
    me.y = arena.floorY;
    if (me.vy > 0) me.vy = 0;
    me.jumpsLeft = 1;
  }

  const wantsBlock = !!me.controls.block && me.hitstun <= 0;
  me.blocking = wantsBlock && me.attack.phase === "none";

  const canAct = me.hitstun <= 0 && me.attack.phase === "none";

  // Start attack (edge-triggered)
  if (canAct && !me.blocking) {
    if (me.controls.punch && !me.prevControls.punch) {
      beginAttack(me, "punch");
    } else if (me.controls.kick && !me.prevControls.kick) {
      beginAttack(me, "kick");
    }
  }

  // Movement
  let move = 0;
  if (canAct && !me.blocking) {
    if (me.controls.left) move -= 1;
    if (me.controls.right) move += 1;
  }

  const targetVx = move * config.fighter.moveSpeed;
  const accel = onGround ? 0.34 : 0.18;
  me.vx = lerp(me.vx, targetVx, accel);

  // Jump (edge-triggered)
  if (canAct && me.controls.jump && !me.prevControls.jump && me.jumpsLeft > 0) {
    me.vy = -config.fighter.jumpVelocity;
    me.jumpsLeft -= 1;
  }

  // Physics
  me.vy += config.world.gravity * dt;
  me.x += me.vx * dt;
  me.y += me.vy * dt;

  // World bounds
  const minX = arena.leftX + config.fighter.radius;
  const maxX = arena.rightX - config.fighter.radius;
  if (me.x < minX) {
    me.x = minX;
    me.vx *= -0.15;
  } else if (me.x > maxX) {
    me.x = maxX;
    me.vx *= -0.15;
  }

  if (me.y > arena.floorY) {
    me.y = arena.floorY;
    me.vy = 0;
  }

  if (onGround) {
    me.vx *= config.fighter.groundFriction;
  } else {
    me.vx *= config.world.airDrag;
  }

  // Light "push" so they don't overlap too deeply
  const dx = other.x - me.x;
  const minDist = config.fighter.radius * 2 + 10;
  if (Math.abs(dx) < minDist && Math.abs(other.y - me.y) < config.fighter.bodyHeight * 0.6) {
    const push = (minDist - Math.abs(dx)) * 0.5;
    me.x -= Math.sign(dx || 1) * push;
  }

  me.prevControls = { ...me.controls };
}

function beginAttack(fighter, type) {
  const def = config.attacks[type];
  fighter.attack.def = def;
  fighter.attack.type = type;
  fighter.attack.phase = "windup";
  fighter.attack.hasHit = false;
  fighter.attack.timer = def.windup + def.active + def.recovery;
}

function resolveAttack(attacker, defender) {
  if (attacker.dead || defender.dead) return;
  if (attacker.attack.phase !== "active") return;
  if (attacker.attack.hasHit) return;
  if (defender.invuln > 0) return;

  const hitbox = getHitbox(attacker);
  const hurtbox = getHurtbox(defender);
  if (!rectsOverlap(hitbox, hurtbox)) return;

  const def = attacker.attack.def;
  if (!def) return;

  attacker.attack.hasHit = true;

  // Block only works when the attacker is in front of the defender (i.e. in the defender's facing direction).
  const blocked = defender.blocking && Math.sign(attacker.x - defender.x) === defender.facing;
  const damage = blocked ? Math.ceil(def.damage * config.fighter.blockDamageMultiplier) : def.damage;

  defender.health = Math.max(0, defender.health - damage);
  defender.hitstun = def.hitstun * (blocked ? 0.65 : 1);
  defender.invuln = config.fighter.invulnOnHit;

  // Knockback
  const dir = attacker.facing;
  defender.vx = dir * def.knockbackX * (blocked ? 0.55 : 1);
  defender.vy = -def.knockbackY * (blocked ? 0.55 : 1);

  // Meter (UI only)
  state.meter = clamp01(state.meter + config.meter.gainOnHit);
}

function endRound() {
  if (state.phase !== "playing") return;

  const p1Alive = p1.health > 0;
  const p2Alive = p2.health > 0;

  let winner = "draw"; // draw | p1 | p2
  if (p1Alive && !p2Alive) winner = "p1";
  else if (!p1Alive && p2Alive) winner = "p2";
  else if (p1.health === p2.health) winner = "draw";
  else winner = p1.health > p2.health ? "p1" : "p2";

  if (winner === "p1") state.winnerText = "Player 1 wins!";
  else if (winner === "p2") state.winnerText = "Player 2 wins!";
  else state.winnerText = "Draw!";

  if (winner === "p1") {
    addCoins(WIN_COIN_REWARD);
    setStatus(
      `${state.winnerText} +${WIN_COIN_REWARD} coins (Total: ${state.coins}). Next round starting...`,
    );
  } else {
    setStatus(`${state.winnerText} Next round starting...`);
  }

  // Infinite mode: immediately queue up the next round.
  state.round += 1;
  state.timeLeft = config.round.timeSeconds;
  state.betweenRounds = config.round.betweenRoundsDelay;
  state.winnerText = "";
  state.meter = 0;

  resetFighter(p1, canvas.width * 0.32, 1);
  resetFighter(p2, canvas.width * 0.68, -1);

  updateControls();
  updateUI();
}

function start() {
  state.phase = "playing";
  state.paused = false;
  state.timeLeft = config.round.timeSeconds;
  state.winnerText = "";
  state.betweenRounds = 0;
  state.meter = 0;
  state.round = 1;

  resetFighter(p1, canvas.width * 0.32, 1);
  resetFighter(p2, canvas.width * 0.68, -1);

  setStatus("Fight!");
  updateControls();
  updateUI();
}

function resetToIdle() {
  state.phase = "idle";
  state.paused = true;
  state.round = 1;
  state.timeLeft = config.round.timeSeconds;
  state.winnerText = "";
  state.betweenRounds = 0;
  state.meter = 0;

  resetFighter(p1, canvas.width * 0.32, 1);
  resetFighter(p2, canvas.width * 0.68, -1);

  setStatus("Tap Play to begin.");
  updateControls();
  updateUI();
}

function pause() {
  if (state.phase !== "playing") return;
  state.paused = true;
  setStatus("Paused — press Play or P.");
  updateControls();
}

function resume() {
  if (state.phase !== "playing") return;
  state.paused = false;
  setStatus("Fight!");
  updateControls();
}

function updateControls() {
  if (controls.pause) {
    controls.pause.disabled = state.phase !== "playing";
    controls.pause.textContent = state.paused ? "Resume" : "Pause";
  }
  if (controls.play) {
    let label = "Play";
    if (state.phase === "playing") label = state.paused ? "Resume" : "Restart";
    if (state.phase === "over") label = "Play Again";
    controls.play.textContent = label;
  }
}

function updateUI() {
  if (ui.p1) ui.p1.textContent = String(Math.max(0, Math.floor(p1.health)));
  if (ui.p2) ui.p2.textContent = String(Math.max(0, Math.floor(p2.health)));
  if (ui.round) ui.round.textContent = String(state.round);
  if (ui.timer) ui.timer.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
  if (ui.coins) ui.coins.textContent = String(state.coins);

  if (ui.meterFill && ui.meterTrack && ui.meterText) {
    const percent = Math.round(clamp01(state.meter) * 100);
    ui.meterFill.style.width = `${percent}%`;
    ui.meterTrack.setAttribute("aria-valuenow", String(percent));
    ui.meterText.textContent = `${percent}%`;
  }
}

function setStatus(message) {
  if (ui.status) ui.status.textContent = message;
}

function draw() {
  drawBackground();
  drawFloor();
  drawHUDOverlay();
  drawFighter(p1);
  drawFighter(p2);
  drawCenterPrompt();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, config.visuals.bgTop);
  g.addColorStop(1, config.visuals.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // subtle grid
  ctx.save();
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
  ctx.restore();
}

function drawFloor() {
  ctx.save();
  ctx.fillStyle = config.visuals.floor;
  ctx.fillRect(0, arena.floorY, canvas.width, canvas.height - arena.floorY);
  ctx.strokeStyle = config.visuals.floorLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, arena.floorY);
  ctx.lineTo(canvas.width, arena.floorY);
  ctx.stroke();
  ctx.restore();
}

function drawHUDOverlay() {
  // Health bars (simple, on-canvas)
  const pad = 26;
  const barW = canvas.width * 0.36;
  const barH = 14;
  const top = 22;

  drawBar(pad, top, barW, barH, p1.health / config.fighter.maxHealth, config.visuals.p1, "P1");
  drawBar(canvas.width - pad - barW, top, barW, barH, p2.health / config.fighter.maxHealth, config.visuals.p2, "P2");

  // Timer
  ctx.save();
  ctx.fillStyle = config.visuals.text;
  ctx.font = "700 22px Montserrat, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.max(0, Math.ceil(state.timeLeft))), canvas.width / 2, top + 12);
  ctx.restore();
}

function drawBar(x, y, w, h, ratio, color, label) {
  const clamped = clamp01(ratio);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(x, y, w, h, 999);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  roundRect(x, y, w * clamped, h, 999);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.globalAlpha = 1;
  ctx.font = "600 12px Montserrat, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y + h + 14);
  ctx.restore();
}

function drawFighter(f) {
  const t = performance.now() / 1000;
  const onGround = f.y >= arena.floorY - 0.5;
  const speed = Math.abs(f.vx);
  const bob = onGround ? Math.sin(t * (1.8 + speed * 0.004)) * 2.2 : 0;

  // Pose weights
  const attacking = f.attack.phase !== "none";
  const blocking = f.blocking;
  const stunned = f.hitstun > 0;
  const alpha = f.invuln > 0 ? 0.65 : 1;

  const head = { x: f.x, y: f.y - config.fighter.bodyHeight + bob };
  const neck = { x: f.x, y: f.y - 58 + bob };
  const hip = { x: f.x, y: f.y - 20 + bob };

  const step = onGround ? Math.sin(t * (2.8 + speed * 0.006)) * 8 * (speed > 20 ? 1 : 0) : 0;
  const legA = { x: hip.x - 10, y: hip.y + 8 };
  const legB = { x: hip.x + 10, y: hip.y + 8 };
  const footA = { x: f.x - 12 + step * 0.6, y: f.y };
  const footB = { x: f.x + 12 - step * 0.6, y: f.y };

  const facing = f.facing;
  const armRoot = { x: f.x, y: f.y - 52 + bob };
  const armOut = blocking
    ? { x: armRoot.x + facing * 16, y: armRoot.y + 4 }
    : attacking
      ? { x: armRoot.x + facing * 44, y: armRoot.y + (f.attack.type === "kick" ? 10 : -4) }
      : { x: armRoot.x + facing * 26, y: armRoot.y + Math.sin(t * 3) * 3 };

  const backArmOut = { x: armRoot.x - facing * 18, y: armRoot.y + 6 + Math.cos(t * 2.7) * 3 };

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Glow
  ctx.shadowBlur = 18;
  ctx.shadowColor = f.color;

  // Body
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 6;
  line(head.x, head.y + 18, neck.x, neck.y);
  line(neck.x, neck.y, hip.x, hip.y);

  // Arms
  ctx.lineWidth = 5.5;
  if (stunned) {
    line(armRoot.x, armRoot.y, armRoot.x + facing * 10, armRoot.y + 22);
    line(armRoot.x, armRoot.y, armRoot.x - facing * 10, armRoot.y + 22);
  } else {
    line(armRoot.x, armRoot.y, armOut.x, armOut.y);
    line(armRoot.x, armRoot.y, backArmOut.x, backArmOut.y);
  }

  // Legs
  ctx.lineWidth = 6;
  line(hip.x, hip.y, legA.x, legA.y);
  line(hip.x, hip.y, legB.x, legB.y);
  ctx.lineWidth = 5.5;
  line(legA.x, legA.y, footA.x, footA.y);
  line(legB.x, legB.y, footB.x, footB.y);

  // Head
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.shadowBlur = 22;
  ctx.shadowColor = f.color;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Attack effect
  if (f.attack.phase === "active") {
    const hb = getHitbox(f);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = f.color;
    ctx.shadowBlur = 0;
    roundRect(hb.x, hb.y, hb.w, hb.h, 10);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawCenterPrompt() {
  if (state.phase === "idle") return;
  if (state.phase !== "over") return;

  ctx.save();
  ctx.fillStyle = "rgba(2, 8, 16, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 38px Montserrat, system-ui, sans-serif";
  ctx.fillText(state.winnerText || "Round over", canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = config.visuals.muted;
  ctx.font = "600 16px Montserrat, system-ui, sans-serif";
  ctx.fillText("Press Play (or R) to restart", canvas.width / 2, canvas.height / 2 + 26);
  ctx.restore();
}

function createFighter({ id, color, x, y, facing, controls }) {
  return {
    id,
    color,
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    health: config.fighter.maxHealth,
    dead: false,
    hitstun: 0,
    invuln: 0,
    blocking: false,
    jumpsLeft: 1,
    controls,
    prevControls: { ...controls },
    attack: {
      type: "",
      def: null,
      timer: 0,
      phase: "none", // none | windup | active | recovery
      hasHit: false,
    },
  };
}

function resetFighter(f, x, facing) {
  f.x = x;
  f.y = arena.floorY;
  f.vx = 0;
  f.vy = 0;
  f.facing = facing;
  f.health = config.fighter.maxHealth;
  f.dead = false;
  f.hitstun = 0;
  f.invuln = 0;
  f.blocking = false;
  f.jumpsLeft = 1;
  f.attack.type = "";
  f.attack.def = null;
  f.attack.timer = 0;
  f.attack.phase = "none";
  f.attack.hasHit = false;
  f.prevControls = { ...f.controls };
}

function getHurtbox(f) {
  const w = 42;
  const h = config.fighter.bodyHeight;
  return {
    x: f.x - w / 2,
    y: f.y - h,
    w,
    h,
  };
}

function getHitbox(f) {
  const def = f.attack.def || config.attacks.punch;
  const w = def.range;
  const h = def.height;
  const cx = f.x + f.facing * (config.fighter.radius + w * 0.55);
  const cy = f.y - 54;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

