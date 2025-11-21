# Gun Swap Arena

A tiny top-down browser shooter built with vanilla HTML, CSS, and JavaScript. Survive waves of enemies with 10 lives — every kill instantly swaps your gun to a new archetype with different fire rates, spreads, and damage.

## Getting Started

1. Serve the directory or open `index.html` directly in your browser.
   ```bash
   # optional local server
   python -m http.server 4173
   ```
2. Move with WASD or the arrow keys.
3. Aim with the mouse and hold the left button to fire.
4. Colliding with an enemy costs one life. When you hit zero, the run ends — use the restart button to jump back in.

## Gameplay Details

- You always begin with 10 lives and the Starter Pistol.
- Enemy spawns accelerate as your kill count rises.
- Gun order cycles with each kill, so plan around fast SMG bursts, high-damage slugs, shotguns, and more.
- The HUD at the top keeps track of remaining lives, total kills, and your currently equipped weapon.

## Customizing

- Edit the `guns` array in `app.js` to tweak fire rates, damage, spread, color, or pellet count.
- Adjust spawn pacing via `maybeTightenSpawn` and the `spawnEnemy` helper.
- Update the neon-inspired theme by tweaking CSS variables in `styles.css`.
