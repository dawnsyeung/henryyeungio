# Starwatch Expedition — Top-Down Adventure

Starwatch Expedition is a self-contained browser adventure that plays out from a tactical bird's-eye view. Glide a scout through mossy ruins, collect radiant skyshards, dodge clockwork sentries, and sprint to the evac flare once every artifact is secured. The entire experience runs on a single `<canvas>` with no external dependencies.

## Getting Started

1. Serve the root directory (or open `index.html` directly in any modern browser).
   ```bash
   python -m http.server 4173
   ```
2. Hit **Play** (or tap the canvas) to deploy the scout.
3. Use **WASD / Arrow Keys** to move, **Shift** to sprint, **Space** (or a pointer tap) to emit an echo pulse that stuns sentries, **P** to pause, and **R** to immediately redeploy.

## Gameplay Loop

- **Collect Artifacts:** Nine floating skyshards spawn across the ruins. Your score tracks how many have been secured this run, and the best score persists via `localStorage`.
- **Avoid Sentries:** Patrol units swap to a chase state whenever you drift inside their detection circles. Sprint to break line of sight or trigger an echo pulse to slow them down.
- **Evac Flare:** After you secure every shard, a glowing evac zone activates somewhere on the map. Reach it without losing your last heart to finish the mission.
- **HUD Feedback:** Live stats cover artifacts collected, best run, threat level, pulse cooldown, and the current objective so you always know what to do next.

## Tuning & Customization

- All knobs—including movement speeds, stamina behavior, sentinel density, and the extraction radius—live in the `config` object near the top of `app.js`.
- Level geometry (ruins, patrol paths, artifact distribution) resides inside `app.js`, while UI copy/layout is defined in `index.html`.
- Styling, neon glows, and responsive tweaks are contained in `styles.css`.
