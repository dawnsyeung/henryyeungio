import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { PointerLockControls } from "https://unpkg.com/three@0.158.0/examples/jsm/controls/PointerLockControls.js";

const canvas = document.getElementById("track-canvas");

if (!canvas) {
  throw new Error("Missing canvas element #track-canvas.");
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x132542);
scene.fog = new THREE.Fog(0x132542, 80, 220);

const camera = new THREE.PerspectiveCamera(65, canvas.clientWidth / canvas.clientHeight, 0.1, 400);
camera.position.set(0, 1.62, 32);

const controls3d = new PointerLockControls(camera, canvas);
scene.add(controls3d.getObject());

const clock = new THREE.Clock();

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

const controlsUi = {
  reset: document.getElementById("reset-btn"),
  pause: document.getElementById("pause-btn"),
  fire: document.getElementById("fire-btn"),
};

const config = {
  eyeHeight: 1.62,
  playerSpeed: 14,
  sprintSpeed: 22,
  fireCooldown: 0.2,
  maxHealth: 120,
  weaponRange: 120,
  enemyBulletSpeed: 24,
  enemyDamage: 16,
  enemyBaseHp: 3,
  enemySpreadX: 34,
  enemySpreadZ: 55,
  worldBounds: { x: 48, zMin: -70, zMax: 65 },
  waveDelay: 1.5,
  tracerLife: 0.12,
  playerStart: new THREE.Vector3(0, 1.62, 32),
};

const state = {
  running: false,
  paused: true,
  health: config.maxHealth,
  score: 0,
  wave: 0,
  elapsed: 0,
  weaponCooldown: 0,
  muzzleTimer: 0,
  spawnTimer: config.waveDelay,
  enemies: [],
  enemyBullets: [],
  tracers: [],
  particles: [],
  input: { firing: false },
  bobTime: 0,
  recoil: 0,
};

const keys = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false,
  ShiftLeft: false,
  ShiftRight: false,
};

const raycaster = new THREE.Raycaster();
const forwardDir = new THREE.Vector3();
const sideDir = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const playerPosition = new THREE.Vector3();
const directionVector = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const weaponTarget = new THREE.Vector3();

const sharedGeometry = {
  bullet: new THREE.SphereGeometry(0.08, 8, 8),
  particle: new THREE.SphereGeometry(0.12, 6, 6),
};

setupLights();
buildArena();

const playerWeapon = createPlayerWeapon();
const weaponBasePosition = new THREE.Vector3(0.38, -0.32, -0.75);
playerWeapon.root.position.copy(weaponBasePosition);
camera.add(playerWeapon.root);

const crosshair = createCrosshair();
camera.add(crosshair);
crosshair.position.set(0, 0, -1.2);

attachEvents();
resizeRenderer(true);
resetEncounter();
renderer.setAnimationLoop(loop);

function loop() {
  resizeRenderer();
  const dt = clock.getDelta();
  const active = state.running && !state.paused;

  if (active) {
    state.elapsed += dt;
    updateMovement(dt);
    updateEnemies(dt);
    updateEnemyBullets(dt);
    updateTracers(dt);
    updateParticles(dt);
    scheduleNextWave(dt);
    updateHUD();
  }

  updateWeapon(dt);
  updateWeaponPose(dt);
  renderer.render(scene, camera);
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0x4cc0ff, 0x04060a, 0.85);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(-16, 26, 16);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 10;
  dir.shadow.camera.far = 120;
  scene.add(dir);

  const rim = new THREE.PointLight(0x267dff, 0.6, 80, 2);
  rim.position.set(0, 10, -40);
  scene.add(rim);
}

function buildArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 220),
    new THREE.MeshStandardMaterial({ color: 0x050b13, metalness: 0.1, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 220),
    new THREE.MeshBasicMaterial({ color: 0x2ab7ff, transparent: true, opacity: 0.28 })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.01;
  scene.add(strip);

  const grid = new THREE.GridHelper(180, 36, 0x0d6aff, 0x094368);
  grid.position.y = 0.02;
  grid.material.depthWrite = false;
  if (Array.isArray(grid.material)) {
    grid.material.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.25;
    });
  } else {
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
  }
  scene.add(grid);

  const coverMaterial = new THREE.MeshStandardMaterial({ color: 0x141d2c, metalness: 0.35, roughness: 0.6 });
  const coverPositions = [
    [-28, -20],
    [-28, 10],
    [-8, -5],
    [8, -15],
    [28, -35],
    [28, 5],
    [-32, 35],
    [20, 32],
  ];
  coverPositions.forEach(([x, z]) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 10), coverMaterial.clone());
    block.position.set(x, 2, z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  });

  const barrier = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 35),
    new THREE.MeshBasicMaterial({ color: 0x142649, transparent: true, opacity: 0.3 })
  );
  barrier.position.set(0, 9, -70);
  scene.add(barrier);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(60, 0.2, 16, 80),
    new THREE.MeshBasicMaterial({ color: 0x47f8ff, transparent: true, opacity: 0.4 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.z = -80;
  scene.add(halo);
}

function createPlayerWeapon() {
  const root = new THREE.Group();
  root.position.set(0.38, -0.32, -0.75);

  const alloy = new THREE.MeshStandardMaterial({ color: 0x151c2c, metalness: 0.8, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x42f2ff,
    emissive: 0x2fb7ff,
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 0.28), alloy);
  body.position.set(0.25, -0.15, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.3), alloy);
  grip.position.set(-0.15, -0.35, 0);
  grip.rotation.z = -0.3;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.22), accent.clone());
  mag.position.set(0.05, -0.45, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 16), accent);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.6, -0.05, 0);
  const muzzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.4, 16),
    new THREE.MeshBasicMaterial({ color: 0xffdc9c, transparent: true, opacity: 0 })
  );
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(1.05, -0.05, 0);

  root.add(body, grip, mag, barrel, muzzle);
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  muzzle.visible = false;

  return { root, muzzle };
}

function createCrosshair() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -0.05,
    0,
    -1,
    -0.015,
    0,
    -1,
    0.015,
    0,
    -1,
    0.05,
    0,
    -1,
    0,
    -0.05,
    -1,
    0,
    -0.015,
    -1,
    0,
    0.015,
    -1,
    0,
    0.05,
    -1,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x9bf0ff, transparent: true, opacity: 0.8 });
  return new THREE.LineSegments(geometry, material);
}

function attachEvents() {
  window.addEventListener("resize", () => resizeRenderer(true));
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => {
    state.input.firing = false;
    Object.keys(keys).forEach((code) => {
      keys[code] = false;
    });
    if (controls3d.isLocked) {
      controls3d.unlock();
    }
  });

  canvas.addEventListener("mousedown", handlePointerDown);
  canvas.addEventListener("mouseup", handlePointerUp);
  canvas.addEventListener("pointerleave", () => {
    state.input.firing = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  if (controlsUi.reset) {
    controlsUi.reset.addEventListener("click", () => {
      resetEncounter();
    });
  }

  if (controlsUi.pause) {
    controlsUi.pause.addEventListener("click", () => {
      if (controls3d.isLocked) {
        controls3d.unlock();
      } else {
        controls3d.lock();
      }
    });
  }

  if (controlsUi.fire) {
    controlsUi.fire.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!controls3d.isLocked) {
        controls3d.lock();
      }
      state.input.firing = true;
    });
    controlsUi.fire.addEventListener("pointerup", () => {
      state.input.firing = false;
    });
    controlsUi.fire.addEventListener("pointerleave", () => {
      state.input.firing = false;
    });
  }

  controls3d.addEventListener("lock", () => {
    if (state.health <= 0) {
      state.paused = true;
      state.running = false;
      updateWeaponIndicators();
      setPauseButtonLabel();
      controls3d.unlock();
      return;
    }
    state.paused = false;
    state.running = true;
    setPauseButtonLabel();
    updateWeaponIndicators();
  });

  controls3d.addEventListener("unlock", () => {
    state.paused = true;
    state.input.firing = false;
    setPauseButtonLabel();
    updateWeaponIndicators();
  });
}

function handlePointerDown(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  if (!controls3d.isLocked) {
    controls3d.lock();
  } else {
    state.input.firing = true;
  }
}

function handlePointerUp(event) {
  if (event.button !== 0) return;
  state.input.firing = false;
}

function handleKeyDown(event) {
  if (event.code in keys) {
    keys[event.code] = true;
  }

  switch (event.code) {
    case "Space":
      event.preventDefault();
      if (controls3d.isLocked) {
        state.input.firing = true;
      }
      break;
    case "KeyR":
      resetEncounter();
      break;
    case "KeyP":
      event.preventDefault();
      if (controls3d.isLocked) {
        controls3d.unlock();
      } else {
        controls3d.lock();
      }
      break;
    default:
      break;
  }
}

function handleKeyUp(event) {
  if (event.code in keys) {
    keys[event.code] = false;
  }

  if (event.code === "Space") {
    state.input.firing = false;
  }
}

function resetEncounter() {
  state.health = config.maxHealth;
  state.score = 0;
  state.wave = 0;
  state.elapsed = 0;
  state.weaponCooldown = 0;
  state.muzzleTimer = 0;
  state.spawnTimer = config.waveDelay;
  state.bobTime = 0;
  state.recoil = 0;
  state.input.firing = false;
  clearActors(state.enemyBullets, (bullet) => scene.remove(bullet.mesh));
  clearActors(state.tracers, (tracer) => scene.remove(tracer.line));
  clearActors(state.particles, (particle) => scene.remove(particle.mesh));
  clearActors(state.enemies, (enemy) => scene.remove(enemy.group));
  state.enemyBullets = [];
  state.tracers = [];
  state.particles = [];
  state.enemies = [];
  controls3d.getObject().position.copy(config.playerStart);
  state.running = true;
  state.paused = !controls3d.isLocked;
  updateHUD();
  updateWeaponIndicators();
  setPauseButtonLabel();
  spawnWave();
}

function spawnWave() {
  state.wave += 1;
  const count = Math.min(4 + state.wave, 14);
  for (let i = 0; i < count; i += 1) {
    spawnEnemy();
  }
  updateHUD();
}

function spawnEnemy() {
  const trooper = createTrooperMesh();
  const spawnZ = randRange(-35, 10);
  const spawnX = randRange(-config.enemySpreadX, config.enemySpreadX);
  trooper.group.position.set(spawnX, 0, spawnZ);
  scene.add(trooper.group);
  state.enemies.push({
    group: trooper.group,
    hitMesh: trooper.hitMesh,
    hp: config.enemyBaseHp + Math.floor(state.wave / 2),
    speed: randRange(4.5, 6.5) + state.wave * 0.15,
    fireTimer: randRange(1.4, 2.8),
    strafeAmp: randRange(0.6, 2),
    strafeFreq: randRange(1.5, 2.8),
    sway: Math.random() * Math.PI * 2,
  });
}

function createTrooperMesh() {
  const palette = [
    { suit: 0x2f7cff, accent: 0xff8ef3 },
    { suit: 0x5f5dff, accent: 0x8ff7ff },
    { suit: 0x36c1b8, accent: 0xffa36c },
  ];
  const colors = palette[Math.floor(Math.random() * palette.length)];
  const group = new THREE.Group();

  const armorMaterial = new THREE.MeshStandardMaterial({
    color: colors.suit,
    metalness: 0.45,
    roughness: 0.4,
    emissive: colors.accent,
    emissiveIntensity: 0.12,
  });

  const limbMaterial = new THREE.MeshStandardMaterial({ color: colors.suit, metalness: 0.25, roughness: 0.6 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0f17, metalness: 0.7, roughness: 0.35 });

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), limbMaterial);
  hips.position.y = 0.5;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.45), armorMaterial);
  torso.position.y = 1.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 18), new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.4 }));
  head.position.y = 2.1;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: colors.accent, emissive: colors.accent, emissiveIntensity: 0.9 })
  );
  visor.position.set(0, 2.1, 0.25);

  const armRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), limbMaterial);
  armRight.position.set(0.45, 1.4, 0.05);
  const armLeft = armRight.clone();
  armLeft.position.x = -0.45;

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.2), darkMaterial);
  gun.position.set(0.4, 1.2, 0);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.05, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x16181f, emissive: 0x4cc0ff, emissiveIntensity: 0.5 })
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.88, 1.2, 0);

  const hitMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.1, 6, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  hitMesh.position.y = 1.2;

  group.add(hips, torso, head, visor, armLeft, armRight, gun, barrel, hitMesh);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return { group, hitMesh };
}

function updateMovement(dt) {
  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (!forward && !strafe) {
    clampPlayerPosition();
    return;
  }

  forwardDir.set(0, 0, -1);
  forwardDir.applyQuaternion(camera.quaternion);
  forwardDir.y = 0;
  forwardDir.normalize();

  sideDir.crossVectors(forwardDir, up).normalize();

  const moveDirection = new THREE.Vector3();
  if (forward) {
    moveDirection.add(forwardDir.clone().multiplyScalar(forward));
  }
  if (strafe) {
    moveDirection.add(sideDir.clone().multiplyScalar(strafe));
  }

  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
    const sprinting = keys.ShiftLeft || keys.ShiftRight;
    const speed = sprinting ? config.sprintSpeed : config.playerSpeed;
    controls3d.getObject().position.addScaledVector(moveDirection, speed * dt);
  }
  clampPlayerPosition();
}

function clampPlayerPosition() {
  const pos = controls3d.getObject().position;
  pos.x = clamp(pos.x, -config.worldBounds.x, config.worldBounds.x);
  pos.z = clamp(pos.z, config.worldBounds.zMin, config.worldBounds.zMax);
  pos.y = config.eyeHeight;
}

function updateWeapon(dt) {
  const wasCooling = state.weaponCooldown > 0;
  state.weaponCooldown = Math.max(0, state.weaponCooldown - dt);
  if (wasCooling && state.weaponCooldown === 0) {
    updateWeaponIndicators();
  }

  state.muzzleTimer = Math.max(0, state.muzzleTimer - dt);
  playerWeapon.muzzle.visible = state.muzzleTimer > 0;
  if (playerWeapon.muzzle.visible) {
    playerWeapon.muzzle.material.opacity = Math.max(0, state.muzzleTimer / 0.08);
  }

  if (!state.running || state.paused) return;

  if (state.input.firing && state.weaponCooldown === 0 && controls3d.isLocked) {
    firePlayerWeapon();
    state.weaponCooldown = config.fireCooldown;
    updateWeaponIndicators();
  }
}

function updateWeaponPose(dt) {
  const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
  state.bobTime += dt * (moving ? 8 : 2);
  const bobAmount = moving ? 0.015 : 0.005;
  const swayX = moving ? Math.sin(state.bobTime) * 0.01 : 0;
  const swayY = Math.sin(state.bobTime * 2) * bobAmount;

  state.recoil = Math.max(0, state.recoil - dt * 4);
  weaponTarget.set(
    weaponBasePosition.x + swayX,
    weaponBasePosition.y + swayY,
    weaponBasePosition.z - state.recoil
  );
  playerWeapon.root.position.lerp(weaponTarget, 0.15);
}

function firePlayerWeapon() {
  const origin = getPlayerPosition();
  directionVector.set(0, 0, -1);
  camera.getWorldDirection(directionVector);

  raycaster.set(origin.clone(), directionVector);
  raycaster.far = config.weaponRange;

  const hitMeshes = state.enemies.map((enemy) => enemy.hitMesh);
  const intersections = raycaster.intersectObjects(hitMeshes, false);
  let hitInfo = null;

  if (intersections.length > 0) {
    const closest = intersections[0];
    const enemy = state.enemies.find((entry) => entry.hitMesh === closest.object);
    if (enemy) {
      hitInfo = { enemy, point: closest.point, distance: closest.distance };
    }
  }

  spawnTracer(origin.clone(), directionVector.clone(), hitInfo?.distance ?? config.weaponRange);

  if (hitInfo) {
    const headshot = hitInfo.point.y > hitInfo.enemy.group.position.y + 1.35;
    applyEnemyDamage(hitInfo.enemy, headshot ? 2 : 1, hitInfo.point);
  } else {
    spawnImpact(origin.clone().add(directionVector.clone().multiplyScalar(config.weaponRange)));
  }

  kickWeapon();
}

function kickWeapon() {
  state.recoil = 0.12;
  state.muzzleTimer = 0.08;
  playerWeapon.muzzle.visible = true;
  playerWeapon.muzzle.material.opacity = 1;
}

function applyEnemyDamage(enemy, amount, impactPoint) {
  enemy.hp -= amount;
  spawnHitBurst(impactPoint);

  if (enemy.hp <= 0) {
    const index = state.enemies.indexOf(enemy);
    if (index !== -1) {
      removeEnemyAtIndex(index, true);
    }
  }
}

function removeEnemyAtIndex(index, reward = true) {
  const enemy = state.enemies[index];
  if (!enemy) return;

  if (reward) {
    state.score += 180 + Math.round(state.wave * 35);
    spawnHitBurst(enemy.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xfff2b0);
  }

  scene.remove(enemy.group);
  state.enemies.splice(index, 1);
}

function updateEnemies(dt) {
  const playerPos = getPlayerPosition(playerPosition);

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    const pos = enemy.group.position;
    const toPlayer = playerPos.clone().sub(pos);
    const flat = new THREE.Vector3(toPlayer.x, 0, toPlayer.z);
    const distance = flat.length();

    if (distance > 0.1) {
      flat.normalize();
      const step = enemy.speed * dt;
      pos.add(flat.multiplyScalar(Math.min(step, distance)));
    }

    pos.x += Math.sin(state.elapsed * enemy.strafeFreq + enemy.sway) * enemy.strafeAmp * dt;
    pos.x = clamp(pos.x, -config.enemySpreadX, config.enemySpreadX);
    enemy.group.lookAt(playerPos.x, pos.y + 1.3, playerPos.z);

    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0) {
      fireEnemyBullet(enemy, playerPos);
      enemy.fireTimer = randRange(1.4, 3) / Math.max(1, state.wave * 0.15);
    }

    if (distance < 1.4) {
      damagePlayer(config.enemyDamage * 1.2);
      removeEnemyAtIndex(i, false);
    }
  }
}

function fireEnemyBullet(enemy, playerPos) {
  const origin = enemy.group.position.clone();
  origin.y += 1.25;
  const jitter = new THREE.Vector3(randRange(-0.6, 0.6), randRange(-0.2, 0.35), randRange(-0.6, 0.6));
  const target = playerPos.clone().add(jitter);
  const dir = target.sub(origin).normalize();
  const mesh = new THREE.Mesh(
    sharedGeometry.bullet,
    new THREE.MeshBasicMaterial({ color: 0xff7a7a, transparent: true, opacity: 0.9 })
  );
  mesh.position.copy(origin);
  scene.add(mesh);

  state.enemyBullets.push({
    mesh,
    velocity: dir.multiplyScalar(config.enemyBulletSpeed),
    life: 5,
  });
}

function updateEnemyBullets(dt) {
  const targetPos = getPlayerPosition(playerPosition);
  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.life -= dt;
    bullet.mesh.position.addScaledVector(bullet.velocity, dt);

    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      return false;
    }

    if (bullet.mesh.position.distanceTo(targetPos) < 0.9) {
      damagePlayer(config.enemyDamage);
      spawnHitBurst(bullet.mesh.position, 0xff6b6b);
      scene.remove(bullet.mesh);
      return false;
    }
    return true;
  });
}

function spawnTracer(origin, direction, distance) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    origin,
    origin.clone().add(direction.clone().multiplyScalar(distance)),
  ]);
  const material = new THREE.LineBasicMaterial({ color: 0x7df7ff, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  state.tracers.push({ line, life: config.tracerLife, maxLife: config.tracerLife });
}

function updateTracers(dt) {
  state.tracers = state.tracers.filter((tracer) => {
    tracer.life -= dt;
    if (tracer.life <= 0) {
      scene.remove(tracer.line);
      return false;
    }
    const opacity = tracer.life / tracer.maxLife;
    tracer.line.material.opacity = opacity;
    return true;
  });
}

function spawnHitBurst(point, color = 0xff8efa) {
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(
      sharedGeometry.particle,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(point);
    scene.add(mesh);
    state.particles.push({
      mesh,
      velocity: new THREE.Vector3(randRange(-2, 2), randRange(-0.5, 2.4), randRange(-2, 2)),
      life: 0.35,
      maxLife: 0.35,
    });
  }
  trimParticles();
}

function spawnImpact(point, color = 0x6cf4ff) {
  const mesh = new THREE.Mesh(
    sharedGeometry.particle,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  mesh.position.copy(point);
  scene.add(mesh);
  state.particles.push({
    mesh,
    velocity: new THREE.Vector3(randRange(-1, 1), randRange(0.2, 1.2), randRange(-1, 1)),
    life: 0.25,
    maxLife: 0.25,
  });
  trimParticles();
}

function trimParticles() {
  while (state.particles.length > 120) {
    const particle = state.particles.shift();
    if (particle) {
      scene.remove(particle.mesh);
    }
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      return false;
    }
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
    return true;
  });
}

function scheduleNextWave(dt) {
  if (state.enemies.length === 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = config.waveDelay;
      spawnWave();
    }
  } else {
    state.spawnTimer = config.waveDelay;
  }
}

function damagePlayer(amount) {
  state.health = clamp(state.health - amount, 0, config.maxHealth);
  spawnImpact(getPlayerPosition(playerPosition).clone(), 0xff6b6b);
  updateHUD();
  if (state.health <= 0) {
    handlePlayerDown();
  }
}

function handlePlayerDown() {
  state.health = 0;
  state.running = false;
  state.paused = true;
  state.input.firing = false;
  if (controls3d.isLocked) {
    controls3d.unlock();
  }
  updateWeaponIndicators();
  setPauseButtonLabel();
}

function updateHUD() {
  const timeLabel = formatTime(state.elapsed);
  if (ui.missionTime) ui.missionTime.textContent = timeLabel;
  if (ui.cornerTimer) ui.cornerTimer.textContent = timeLabel;
  if (ui.score) ui.score.textContent = state.score.toLocaleString();
  if (ui.wave) ui.wave.textContent = Math.max(1, state.wave).toString();
  if (ui.integrity) ui.integrity.textContent = `${Math.round((state.health / config.maxHealth) * 100)}%`;
  if (ui.threat) ui.threat.textContent = threatLabel();
}

function updateWeaponIndicators() {
  const ready = state.weaponCooldown === 0 && !state.paused && state.running && controls3d.isLocked;
  const label = !state.running ? "Standby" : state.paused ? "Paused" : ready ? "Ready" : "Cooling";
  if (ui.weaponStatus) ui.weaponStatus.textContent = label;
  if (ui.weaponBtnState) ui.weaponBtnState.textContent = label;
  if (controlsUi.fire) {
    controlsUi.fire.dataset.state = ready ? "ready" : "cooldown";
    controlsUi.fire.disabled = state.health <= 0;
  }
}

function threatLabel() {
  const active = state.enemies.length;
  if (active === 0) return "Calm";
  if (active < 3) return "Probe";
  if (active < 6) return "Crossfire";
  if (active < 9) return "Hurricane";
  return "Terminal";
}

function setPauseButtonLabel() {
  if (controlsUi.pause) {
    controlsUi.pause.textContent = state.paused ? "Resume" : "Pause";
  }
}

function resizeRenderer(force = false) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = force || canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function getPlayerPosition(out = new THREE.Vector3()) {
  out.copy(controls3d.getObject().position);
  out.y = config.eyeHeight;
  return out;
}

function clearActors(collection, cleanup) {
  for (const actor of collection) {
    cleanup(actor);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
