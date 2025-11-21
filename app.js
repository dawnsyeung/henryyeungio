import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { PointerLockControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js";

const root = document.getElementById("game-root");
const livesEl = document.getElementById("lives");
const killsEl = document.getElementById("kills");
const gunEl = document.getElementById("gun");
const finalKillsEl = document.getElementById("final-kills");
const overlayEl = document.getElementById("game-overlay");
const resetBtn = document.getElementById("reset-btn");

const guns = [
  { name: "Starter Pistol", fireRate: 280, damage: 1, range: 45, color: "#fefefe" },
  { name: "Auto SMG", fireRate: 120, damage: 0.55, range: 38, color: "#8af0ff" },
  { name: "Slug Cannon", fireRate: 580, damage: 2.2, range: 60, color: "#ffbb6e" },
  { name: "Tri-Beam Laser", fireRate: 260, damage: 0.9, range: 70, color: "#a18bff" },
  { name: "Pulse Shotgun", fireRate: 420, damage: 0.65, range: 30, pellets: 5, color: "#ff6db9" },
];

const config = {
  playerSpeed: 7,
  eyeHeight: 1.6,
  playerRadius: 0.7,
};

const state = {
  lives: 10,
  kills: 0,
  gunIndex: 0,
  spawnTimer: 0,
  spawnInterval: 1.4,
  lastShot: 0,
  isRunning: true,
  pointerDown: false,
  enemies: [],
  tracers: [],
  particles: [],
};

const movement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040c);
scene.fog = new THREE.Fog(0x05040c, 25, 80);

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 120);
camera.position.set(0, config.eyeHeight, 0);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const raycaster = new THREE.Raycaster();
raycaster.far = 60;

const tempVec = new THREE.Vector3();

const muzzleFlash = new THREE.PointLight(0xffddb0, 0, 3, 2);
muzzleFlash.position.set(0.2, -0.15, -0.7);
camera.add(muzzleFlash);

const gunGroup = buildGunModel();
camera.add(gunGroup);

setupEnvironment();
resizeRenderer();
const resizeObserver = new ResizeObserver(() => resizeRenderer());
resizeObserver.observe(root);
window.addEventListener("resize", resizeRenderer);

resetBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  resetGame();
});

root.addEventListener("click", () => {
  if (!controls.isLocked && state.isRunning) {
    controls.lock();
  }
});

controls.addEventListener("lock", () => {
  document.body.classList.add("pointer-locked");
});

controls.addEventListener("unlock", () => {
  document.body.classList.remove("pointer-locked");
  state.pointerDown = false;
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (!controls.isLocked) return;
  state.pointerDown = true;
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0) return;
  state.pointerDown = false;
});

window.addEventListener("keydown", (event) => {
  if (["Space"].includes(event.code)) event.preventDefault();
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      movement.forward = true;
      break;
    case "KeyS":
    case "ArrowDown":
      movement.backward = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      movement.left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      movement.right = true;
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      movement.forward = false;
      break;
    case "KeyS":
    case "ArrowDown":
      movement.backward = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      movement.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      movement.right = false;
      break;
    default:
      break;
  }
});

function buildGunModel() {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x5566ff,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x111233,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.9), baseMaterial);
  body.position.set(0.3, -0.2, -0.8);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.15), baseMaterial);
  grip.position.set(0.12, -0.42, -0.55);
  grip.rotation.z = Math.PI * 0.08;

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.6,
    emissive: 0x0,
  });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 12), accentMaterial);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.24, -0.18, -1.05);

  group.add(body, grip, barrel);
  group.userData = { body, grip, accentMaterial, baseMaterial };
  return group;
}

function setupEnvironment() {
  const hemisphere = new THREE.HemisphereLight(0x5f7cff, 0x060309, 0.8);
  scene.add(hemisphere);

  const dirLight = new THREE.DirectionalLight(0xff7da0, 0.35);
  dirLight.position.set(-6, 12, 8);
  scene.add(dirLight);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshStandardMaterial({
      color: 0x050712,
      metalness: 0.1,
      roughness: 0.9,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(160, 60, 0x2f4cff, 0x0f1938);
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = root;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function currentGun() {
  return guns[state.gunIndex];
}

function updateHud() {
  livesEl.textContent = state.lives.toString();
  killsEl.textContent = state.kills.toString();
  gunEl.textContent = currentGun().name;
}

function resetGame() {
  state.lives = 10;
  state.kills = 0;
  state.gunIndex = 0;
  state.spawnTimer = 0;
  state.spawnInterval = 1.4;
  state.lastShot = 0;
  state.isRunning = true;
  state.pointerDown = false;
  clearActors(state.enemies);
  clearActors(state.tracers);
  clearActors(state.particles);
  state.enemies = [];
  state.tracers = [];
  state.particles = [];
  controls.getObject().position.set(0, config.eyeHeight, 0);
  controls.getObject().rotation.y = 0;
  hideOverlay();
  updateHud();
  updateGunSkin(currentGun().color);
}

function clearActors(list) {
  list.forEach((actor) => {
    if (actor.mesh) {
      scene.remove(actor.mesh);
    }
  });
}

function updateGunSkin(colorHex) {
  gunGroup.userData.baseMaterial.color.set(colorHex);
  gunGroup.userData.baseMaterial.emissive.set(colorHex).multiplyScalar(0.1);
  gunGroup.userData.accentMaterial.color.set(colorHex);
}

function handleMovement(dt) {
  if (!controls.isLocked) return;
  if (!state.isRunning) return;
  const moveDistance = config.playerSpeed * dt;
  if (movement.forward) controls.moveForward(moveDistance);
  if (movement.backward) controls.moveForward(-moveDistance);
  if (movement.left) controls.moveRight(-moveDistance);
  if (movement.right) controls.moveRight(moveDistance);
  controls.getObject().position.y = config.eyeHeight;
}

function tryShoot(now) {
  if (!state.isRunning || !state.pointerDown || !controls.isLocked) return;
  const gun = currentGun();
  if (now - state.lastShot < gun.fireRate) return;

  const pellets = gun.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    fireRay(now, gun, i);
  }
  state.lastShot = now;
  animateGunRecoil();
}

function fireRay(now, gun, pelletIndex) {
  const origin = controls.getObject().position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  if (pelletIndex > 0) {
    dir.x += (Math.random() - 0.5) * 0.04 * pelletIndex;
    dir.y += (Math.random() - 0.5) * 0.02 * pelletIndex;
    dir.z += (Math.random() - 0.5) * 0.04 * pelletIndex;
    dir.normalize();
  }

  raycaster.set(origin, dir);
  raycaster.far = gun.range;

  const intersections = raycaster.intersectObjects(state.enemies.map((enemy) => enemy.mesh), false);
  if (intersections.length) {
    const hit = intersections[0];
    const enemy = state.enemies.find((candidate) => candidate.mesh === hit.object);
    if (enemy) {
      enemy.hp -= gun.damage;
      spawnHitParticles(hit.point, gun.color);
      if (enemy.hp <= 0) {
        removeEnemy(enemy);
        handleEnemyDown();
      }
    }
  }

  spawnTracer(origin, dir, gun.color, gun.range);
  muzzleFlash.intensity = 1.3;
  muzzleFlash.decay = 2;
}

function spawnTracer(origin, dir, color, range) {
  const tracerLength = Math.min(range * 0.7, 25);
  const tracerGeo = new THREE.CylinderGeometry(0.02, 0.02, tracerLength, 6);
  const tracerMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
  const tracer = new THREE.Mesh(tracerGeo, tracerMat);
  const midPoint = origin.clone().add(dir.clone().multiplyScalar(tracerLength / 2 + 0.2));
  tracer.position.copy(midPoint);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(tracer);
  state.tracers.push({
    mesh: tracer,
    life: 0,
    maxLife: 0.2,
  });
}

function spawnHitParticles(position, color) {
  for (let i = 0; i < 12; i += 1) {
    const geo = new THREE.SphereGeometry(0.05, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 3,
      (Math.random() - 0.5) * 4,
    );
    scene.add(mesh);
    state.particles.push({
      mesh,
      velocity,
      life: 0,
      maxLife: 0.4,
    });
  }
}

function updateTracers(dt) {
  state.tracers = state.tracers.filter((tracer) => {
    tracer.life += dt;
    if (tracer.mesh.material) {
      tracer.mesh.material.opacity = 1 - tracer.life / tracer.maxLife;
    }
    if (tracer.life >= tracer.maxLife) {
      scene.remove(tracer.mesh);
      return false;
    }
    return true;
  });
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.life += dt;
    const alpha = 1 - particle.life / particle.maxLife;
    particle.mesh.material.opacity = Math.max(alpha, 0);
    if (particle.life >= particle.maxLife) {
      scene.remove(particle.mesh);
      return false;
    }
    return true;
  });
}

function spawnEnemy() {
  const minRadius = 18;
  const maxRadius = 32;
  const angle = Math.random() * Math.PI * 2;
  const distance = minRadius + Math.random() * (maxRadius - minRadius);
  const position = new THREE.Vector3(
    Math.cos(angle) * distance,
    1.4,
    Math.sin(angle) * distance,
  );

  const geometry = new THREE.SphereGeometry(0.7 + Math.random() * 0.3, 24, 24);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff4f7d,
    emissive: 0x4a0c1f,
    metalness: 0.1,
    roughness: 0.6,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  scene.add(mesh);

  const enemy = {
    mesh,
    speed: 1.4 + Math.random() * 0.6 + Math.min(state.kills * 0.04, 1.8),
    hp: 1 + Math.floor(state.kills / 5),
    radius: 0.7,
  };
  state.enemies.push(enemy);
}

function updateEnemies(dt) {
  const playerPosition = controls.getObject().position;

  state.enemies.forEach((enemy) => {
    const direction = tempVec.copy(playerPosition).sub(enemy.mesh.position);
    const distance = direction.length();
    direction.normalize();
    enemy.mesh.position.addScaledVector(direction, enemy.speed * dt);

    if (distance < enemy.radius + config.playerRadius) {
      removeEnemy(enemy);
      applyDamage();
    }
  });

  state.enemies = state.enemies.filter((enemy) => enemy.mesh.parent === scene);
}

function removeEnemy(enemy) {
  scene.remove(enemy.mesh);
  enemy.mesh.geometry.dispose?.();
  enemy.mesh.material.dispose?.();
  state.enemies = state.enemies.filter((candidate) => candidate !== enemy);
}

function handleEnemyDown() {
  state.kills += 1;
  cycleGun();
  maybeTightenSpawn();
  updateHud();
}

function applyDamage() {
  if (!state.isRunning) return;
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    endRun();
  }
  updateHud();
}

function endRun() {
  state.isRunning = false;
  finalKillsEl.textContent = state.kills.toString();
  overlayEl.classList.remove("hidden");
  controls.unlock();
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function cycleGun() {
  state.gunIndex = (state.gunIndex + 1) % guns.length;
  updateGunSkin(currentGun().color);
}

function maybeTightenSpawn() {
  const target = Math.max(0.45, 1.4 - state.kills * 0.02);
  state.spawnInterval = target;
}

function handleSpawning(dt) {
  if (!state.isRunning) return;
  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnInterval) {
    spawnEnemy();
    state.spawnTimer = 0;
  }
}

function animateGunRecoil() {
  gunGroup.rotation.x = -0.1;
}

function updateGunAnimation(dt) {
  gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, 0, dt * 8);
  muzzleFlash.intensity = THREE.MathUtils.lerp(muzzleFlash.intensity, 0, dt * 12);
}

let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  handleMovement(dt);
  handleSpawning(dt);
  if (state.isRunning) {
    updateEnemies(dt);
  }
  updateTracers(dt);
  updateParticles(dt);
  tryShoot(now);
  updateGunAnimation(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

resetGame();
updateHud();
requestAnimationFrame(loop);
