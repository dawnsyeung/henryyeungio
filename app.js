const canvas = document.getElementById("tree-canvas");
const ctx = canvas.getContext("2d");

const ornamentCountEl = document.getElementById("ornament-count");
const scoreEl = document.getElementById("score-value");
const selectedLabelEl = document.getElementById("selected-label");
const twinkleRange = document.getElementById("twinkle-range");
const palette = document.getElementById("palette");
const paletteButtons = Array.from(document.querySelectorAll(".palette-btn"));
const snowToggleBtn = document.getElementById("snow-toggle");
const sparkleBtn = document.getElementById("sparkle-btn");
const undoBtn = document.getElementById("undo-btn");
const resetBtn = document.getElementById("reset-btn");

const ornamentCatalog = {
  classic: {
    label: "Glass Ornament",
    color: "#ff5c8d",
    accent: "#ffdfe9",
    score: 6,
    size: 16,
    shape: "round",
  },
  frost: {
    label: "Frosted Flake",
    color: "#d9f3ff",
    accent: "#ffffff",
    score: 7,
    size: 14,
    shape: "flake",
  },
  bell: {
    label: "Golden Bell",
    color: "#f5c75c",
    accent: "#fff0c7",
    score: 9,
    size: 18,
    shape: "bell",
  },
  candy: {
    label: "Candy Drop",
    color: "#ffad5c",
    accent: "#ffe7c9",
    score: 8,
    size: 15,
    shape: "drop",
  },
  star: {
    label: "Spark Star",
    color: "#fff59d",
    accent: "#ffffff",
    score: 10,
    size: 18,
    shape: "star",
  },
};

const treeGeometry = {
  apex: { x: canvas.width / 2, y: 80 },
  leftBase: { x: canvas.width / 2 - 240, y: canvas.height - 90 },
  rightBase: { x: canvas.width / 2 + 240, y: canvas.height - 90 },
  trunkHeight: 70,
};

const state = {
  ornaments: [],
  twinkle: Number(twinkleRange.value) / 100,
  snowEnabled: true,
  selectedType: "classic",
  snowflakes: createSnowflakes(140),
  lights: createLightGarlands(),
  lastFrame: 0,
};

palette.addEventListener("click", (event) => {
  const button = event.target.closest(".palette-btn");
  if (!button) return;
  const type = button.dataset.type;
  if (!ornamentCatalog[type]) return;
  setSelectedType(type);
});

canvas.addEventListener("click", (event) => {
  const point = getCanvasCoordinates(event);
  if (!pointInsideTree(point.x, point.y)) return;
  addOrnament(point.x, point.y, state.selectedType);
});

twinkleRange.addEventListener("input", (event) => {
  state.twinkle = Number(event.target.value) / 100;
});

snowToggleBtn.addEventListener("click", () => {
  state.snowEnabled = !state.snowEnabled;
  snowToggleBtn.textContent = state.snowEnabled ? "Pause Snowfall" : "Resume Snowfall";
});

sparkleBtn.addEventListener("click", () => {
  scatterSparkle();
});

undoBtn.addEventListener("click", () => {
  state.ornaments.pop();
  updateStats();
});

resetBtn.addEventListener("click", () => {
  state.ornaments = [];
  state.twinkle = Number(twinkleRange.value) / 100;
  state.snowflakes = createSnowflakes(140);
  setSelectedType("classic");
  updateStats();
});

function setSelectedType(type) {
  state.selectedType = type;
  paletteButtons.forEach((btn) => {
    if (btn.dataset.type === type) {
      btn.classList.add("is-selected");
    } else {
      btn.classList.remove("is-selected");
    }
  });
  selectedLabelEl.textContent = ornamentCatalog[type].label;
}

function addOrnament(x, y, type) {
  state.ornaments.push({
    x,
    y,
    type,
    rotation: Math.random() * Math.PI * 2,
    swayOffset: Math.random() * Math.PI * 2,
  });
  updateStats();
}

function updateStats() {
  ornamentCountEl.textContent = state.ornaments.length.toString();
  scoreEl.textContent = calculateScore().toString();
}

function calculateScore() {
  if (state.ornaments.length === 0) return 0;
  const base = state.ornaments.reduce((sum, ornament) => sum + (ornamentCatalog[ornament.type]?.score ?? 4), 0);
  const uniqueTypes = new Set(state.ornaments.map((ornament) => ornament.type)).size;
  const left = state.ornaments.filter((ornament) => ornament.x < canvas.width / 2).length;
  const right = state.ornaments.length - left;
  const balanceBonus = Math.max(0, 12 - Math.abs(left - right) * 3);
  const fullnessBonus = Math.min(18, state.ornaments.length * 1.2);
  const varietyBonus = uniqueTypes * 5;
  return Math.round(base + varietyBonus + balanceBonus + fullnessBonus);
}

function getCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function pointInsideTree(px, py) {
  return pointInTriangle(px, py, treeGeometry.apex, treeGeometry.leftBase, treeGeometry.rightBase);
}

function pointInTriangle(px, py, a, b, c) {
  const area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  const s = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / area;
  const t = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / area;
  const u = 1 - s - t;
  return s >= 0 && t >= 0 && u >= 0;
}

function scatterSparkle() {
  const drops = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < drops; i += 1) {
    const point = randomPointInsideTree();
    const types = Object.keys(ornamentCatalog);
    const type = types[Math.floor(Math.random() * types.length)];
    addOrnament(point.x, point.y, type);
  }
}

function randomPointInsideTree() {
  let r1 = Math.random();
  let r2 = Math.random();
  if (r1 + r2 > 1) {
    r1 = 1 - r1;
    r2 = 1 - r2;
  }
  const ax = treeGeometry.apex.x;
  const ay = treeGeometry.apex.y;
  const bx = treeGeometry.leftBase.x;
  const by = treeGeometry.leftBase.y;
  const cx = treeGeometry.rightBase.x;
  const cy = treeGeometry.rightBase.y;
  const px = ax + r1 * (bx - ax) + r2 * (cx - ax);
  const py = ay + r1 * (by - ay) + r2 * (cy - ay);
  return { x: px, y: py - 20 };
}

function createSnowflakes(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 1 + Math.random() * 2.2,
    speed: 30 + Math.random() * 40,
    drift: Math.random() * 0.4 - 0.2,
  }));
}

function updateSnow(dt) {
  if (!state.snowEnabled) return;
  state.snowflakes.forEach((flake) => {
    flake.y += flake.speed * dt;
    flake.x += flake.drift * flake.speed * 0.2;
    if (flake.y > canvas.height + 10) {
      flake.y = -10;
      flake.x = Math.random() * canvas.width;
    }
    if (flake.x < -10) flake.x = canvas.width + 10;
    if (flake.x > canvas.width + 10) flake.x = -10;
  });
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
