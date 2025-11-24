# Blockstep Parkour

A lightweight browser parkour challenge inspired by Minecraft jump maps. Auto-sprint across floating voxels, queue jumps early, and chase your farthest distance without slipping into the void.

## Getting Started

1. Serve the directory or open `index.html` directly in your browser.
   ```bash
   # optional local server
   python -m http.server 4173
   ```
2. The runner auto-moves. Focus on jump timing: press Space, W, or the Up Arrow.
3. Queue jumps before you leave an edge — buffered jumps trigger on the next frame you can jump.
4. Falling beneath the islands ends the run. Click restart or tap R to reset instantly.

## Gameplay Details

- Starts are gentle: long platforms with short gaps. Distance increases speed and gap sizes.
- Landings refresh your jump window. Leaving a block grants ~0.12s of coyote time for forgiving inputs.
- The HUD tracks current distance, best run, and momentum (blocks per second).

## Customizing

- Tweak gravity, jump force, and speed ramps inside `config` in `app.js`.
- Adjust platform frequency/height via `ensurePlatforms` and `createPlatform`.
- Theme the UI and islands by editing CSS variables and canvas drawing colors in `styles.css` / `app.js`.
