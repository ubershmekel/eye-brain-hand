# Eye 👁 Brain 🧠 Hand ✋

A tiny speed-and-accuracy snapshot game. Three letters appear at the top; tap
them in order on a 6×6 grid of A–Z (plus 0–9), aiming for the small square at
the center of each cell. Three rounds of three taps, then a report:

- **Median tap delay** (plus best/worst)
- **Median distance from cell center** in pixels (plus best/worst)
- **Hit rate** (did you tap the right cell at all)
- A table of all nine taps, and a history of past sessions (stored in
  `localStorage`)

Play it once a year to chart your mental decline, or mid-marathon to watch your
coordination dissolve in real time.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
`.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. In
the repo settings, set **Pages → Source** to **GitHub Actions** once.
