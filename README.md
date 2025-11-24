# Evergreen Glow

An interactive Christmas tree decorating game built with vanilla HTML, CSS, and JavaScript. Scatter ornaments, dial in the twinkle, flip the snowfall on or off, and chase your best festive score.

## Getting Started

1. Serve the directory or open `index.html` directly in your browser.
   ```bash
   python -m http.server 4173
   ```
2. Click anywhere on the tree to place the currently selected ornament.
3. Use the palette on the right to swap ornament styles, adjust the light twinkle slider, pause snowfall, or trigger a Surprise Sparkle.
4. Use **Undo Ornament** to step back or **Reset Tree** to clear everything.

## Features

- **Five ornament archetypes** (glass, frosted, bell, candy, star) each with unique artwork and scoring values.
- **Festive score tracker** that rewards variety, balance, and fullness.
- **Animated scene** complete with twinkling garlands, snowfall, and a glowing tree topper.
- **Accessibility-friendly controls** — everything runs client-side with no dependencies.

## Customizing

- Adjust ornament colors, sizes, or scores inside the `ornamentCatalog` in `app.js`.
- Tweak tree colors, typography, or layout in `styles.css`.
- Modify the scoring logic inside `calculateScore` to match your own vibe-based grading rubric.
