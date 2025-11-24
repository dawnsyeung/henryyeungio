# Blockstep Parkour

An endless, canvas-rendered parkour runner. Sprint across floating voxels, queue jumps before you leave a block, and keep your speed meter climbing to survive longer gaps.

## Getting Started

1. Serve the directory or open `index.html` in your browser.
   ```bash
   python -m http.server 4173
   ```
2. The runner auto-moves. Press **Space**, **W**, **Up Arrow**, or tap the canvas to jump.
3. Hold the jump key to buffer the next jump — it fires on the first frame you can leave the ground.
4. Press **R** or the Reset Run button to restart instantly. Use **P**/Pause to freeze the action.

## Features

- Procedurally generated platforms with subtle height variance and escalating gaps.
- Momentum meter that translates directly into larger jumps and spacing.
- Coyote time (~0.12s) and jump buffering for responsive inputs, plus dust FX on landings.
- Local best distance stored automatically so you can chase PBs between sessions.
- Checkpoint flags drop every ~250m; each banked flag grants a single rewind to that spot before the run truly ends.

## Customizing

- Tune gravity, jump force, speed ramp, or particle behavior in `config` within `app.js`.
- Adjust checkpoint spacing, toast durations, or respawn flash timing via the same config block.
- Adjust generation rules inside `ensurePlatforms` if you want taller peaks or wider gaps.
- Style the HUD and track colors by editing CSS variables in `styles.css` or the `draw*` helpers in `app.js`.
