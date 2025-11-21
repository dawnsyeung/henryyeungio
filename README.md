# Pop, Rock & Classical Jukebox

Simple static web experience for sampling curated pop, rock, and classical tracks. Built with vanilla HTML/CSS/JS, no build step required.

## Getting Started

1. Serve the root directory with any static server (or just open `index.html` in a browser).
   ```bash
   # option A: use python
   python -m http.server 4173

   # option B: open file directly (double-click index.html)
   ```
2. Navigate to the served URL (default `http://localhost:4173`) or the opened file.
3. Use the pill filters to switch between all, pop, rock, and classical tracks. Each card includes a short description plus an audio preview sourced from SoundHelix examples.

## Customizing

- Add more songs by editing `songs` in `app.js`. Genres automatically gain filters when you add matching buttons in `index.html`.
- Adjust the visual theme via CSS variables in `styles.css`.
