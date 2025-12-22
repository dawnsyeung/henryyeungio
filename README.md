# Stickman Battle — Canvas Fighter

Stickman Battle is a self-contained 2D fighting game built on a single `<canvas>` with no external dependencies. Two players share one keyboard and battle with punches, kicks, jumps, and blocks until someone’s HP hits zero (or the timer runs out).

## Getting Started

1. Serve the root directory (or open `index.html` directly in any modern browser).
   ```bash
   python -m http.server 4173
   ```
2. Hit **Play** (or tap the canvas) to start the match.
3. Use the controls below, **P** to pause/resume, and **R** to restart instantly.

## Controls

- **Player 1**
  - Move: **A / D**
  - Jump: **W**
  - Punch: **F**
  - Kick: **G**
  - Block: **S**
- **Player 2**
  - Move: **← / →**
  - Jump: **↑**
  - Punch: **/**
  - Kick: **.**
  - Block: **↓**

## Gameplay

- **Win condition:** Reduce your opponent to **0 HP**, or have more HP when the **timer** reaches 0.
- **Blocking:** Reduces incoming damage, but you can still get pushed around.
- **Hitboxes:** Punch/kick only connect during the “active” frames (you’ll see a faint hitbox flash).

## Tuning & Customization

- All gameplay knobs (gravity, movement, attack damage/knockback, round timer) live in the `config` object near the top of `app.js`.
- UI copy/layout is in `index.html`.
- Styling is in `styles.css`.
