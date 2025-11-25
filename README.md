# Helix Ember: First-Person Breach

Helix Ember is a browser-based 3D breach scenario powered by Three.js. You drop into a first-person camera, wield a rifle, and stare down squads of armed humans that sweep toward your position. Tight pointer-lock controls, wave escalation, and a neon arena keep every run tense.

## Getting Started

1. Serve the root directory (or open `index.html` directly in a modern browser).
   ```bash
   python -m http.server 4173
   ```
2. Click the canvas or press the **Prime** button to lock the cursor and arm the rifle.
3. Use **WASD** to move, **mouse** to aim, **Shift** to sprint, and **Left Click / Space** to fire.
4. **R** instantly redeploys, while **P** (or the Pause button) unlocks the visor and pauses the sim.

## Features

- Three.js-powered arena with volumetric fog, neon strips, and animated cover blocks.
- Pointer-lock first-person camera plus a reactive weapon model with recoil, muzzle flashes, and tracers.
- Enemy humans built from modular meshes, each carrying rifles that fire back with projectile logic.
- Wave escalations, pressure meter, and HUD panels for armor, time, eliminations, and weapon state.
- Particle bursts, hit sparks, and crosshair feedback to highlight every successful shot.

## Customizing

- All tuning knobs (speeds, health, spawn cadence, weapon cooldowns, arena bounds) live in the `config` block at the top of `app.js`.
- Enemy visuals and weapon styling can be tweaked inside `createTrooperMesh` and `createPlayerWeapon`.
- UI copy and layout remain in `index.html`, while panel/glow styling is handled in `styles.css`.
