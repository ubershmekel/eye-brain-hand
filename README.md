# Eye 👁 Brain 🧠 Hand ✋

A tiny speed-and-accuracy snapshot game for cognitive measurement. Three letters
appear at the top; tap them in order on a 5×5 grid of A–Y (sorry, Z), aiming for
the crosshair-marked center of each cell. The grid is shuffled once per play — a
600 ms scramble animation signals that the clock is about to start — and stays
fixed across the three rounds of three taps. Then a report:

- **Average tap delay** across all nine taps (plus best/worst)
- **Median distance from cell center** in pixels (plus best/worst)
- **Hit rate** (did you tap the right cell at all)
- A table of all nine taps, and a history of past sessions (stored in
  `localStorage`)

Play it once a year to chart your mental decline, or mid-marathon to watch your
coordination dissolve in real time.

The delay score deliberately uses the arithmetic average, not the median. Each
round's first delay includes the time spent locating its three target letters;
the next two taps can then be nearly instantaneous. With nine taps total, those
six fast taps would dominate the median and hide most of the visual-search time.
The average keeps all three first-tap delays in the score.

## Play

https://ubershmekel.github.io/eye-brain-hand/

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
