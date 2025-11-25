# Molten Stick Sprint

Molten Stick Sprint is a canvas-rendered parkour challenge where a squad of neon stick figures races across basalt pads hanging over a glowing lava trench. Procedural trees breeze by in the background while a built-in stopwatch tracks how long you’ve survived the heat.

## Getting Started

1. Serve the root directory (or just open `index.html` in a browser).
   ```bash
   python -m http.server 4173
   ```
2. The runner automatically surges forward. Press **Space**, **W**, **Up Arrow**, **Down Arrow**, or tap the canvas to jump.
3. Hold the jump input to buffer the next leap — it fires on the first possible frame after touching ground.
4. Tap **R** or hit **Reset Run** to restart. **P** (or the Pause button) freezes the action without clearing the stopwatch.
5. Double-tap (touch) or press **Shift** / **D** mid-air to unleash a dash burst that stretches over wider gaps; landing reloads the dash charge.

## Features

- Lava river with animated waves, ember sprites, and parallax tree lines to set the canyon vibe.
- Stick-figure rendering system (player + ghost runners) that animates arms, legs, and glowing trails.
- Stopwatch HUD alongside distance, best run, heat flow (speed), and checkpoint banking.
- Mid-air dash system with particle bursts, gravity dampening, and a HUD charge indicator for clutch saves.
- Jump buffering, coyote time, dust FX, and trail particles for responsive inputs and feedback.
- Persistent best distance, checkpoints every ~250 meters, and optional respawn delays.

## Customizing

- Game feel lives in the `config` block inside `app.js` — tweak gravity, lava height, tree layers, checkpoint spacing, and more.
- Platform generation rules are in `ensurePlatforms`. Adjust gaps, heights, or noise for harder/easier runs.
- Visual styling (panels, typography, buttons) hangs out in `styles.css`, while canvas colors are controlled in the `draw*` helpers in `app.js`.
