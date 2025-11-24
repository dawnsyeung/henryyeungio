# Evergreen Glow

An interactive Christmas tree decorating game built with vanilla HTML, CSS, and JavaScript. Scatter ornaments, dial in the twinkle, flip the snowfall on or off, and chase your best festive score.

## Getting Started

1. Serve the directory or open `index.html` directly in your browser.
   ```bash
   python -m http.server 4173
   ```
2. The runner auto-moves. Focus on jump timing: press Space, W, or the Up Arrow.
3. Queue jumps before you leave an edge — buffered jumps trigger on the next frame you can jump.
4. Falling beneath the islands ends the run. Click restart or tap R to reset instantly.
2. Click anywhere on the tree to place the currently selected ornament.
3. Use the palette on the right to swap ornament styles, adjust the light twinkle slider, pause snowfall, or trigger a Surprise Sparkle.
4. Use **Undo Ornament** to step back or **Reset Tree** to clear everything.

## Features

- Starts are gentle: long platforms with short gaps. Distance increases speed and gap sizes.
- Landings refresh your jump window. Leaving a block grants ~0.12s of coyote time for forgiving inputs.
- The HUD tracks current distance, best run, and momentum (blocks per second).

## Customizing

- Tweak gravity, jump force, and speed ramps inside `config` in `app.js`.
- Adjust platform frequency/height via `ensurePlatforms` and `createPlatform`.
- Theme the UI and islands by editing CSS variables and canvas drawing colors in `styles.css` / `app.js`.
