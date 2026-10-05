# Timer / Stopwatch

A single-page app with two modes — a lap-tracking stopwatch and a countdown
timer with a circular progress ring. No frameworks, no build step, no API.

## File structure

```
timer-stopwatch/
├── index.html          # markup for both the stopwatch and timer panels
├── css/
│   └── styles.css        # dark theme, lime accent, circular progress ring
├── js/
│   └── app.js              # timing logic for both modes + keyboard shortcuts
├── assets/
│   └── favicon.svg
└── README.md
```

## How it's built

- **Stopwatch** uses `requestAnimationFrame` rather than `setInterval`, so
  the display stays smooth and accurate even if the tab is briefly busy.
  Elapsed time is tracked as a running total (`swElapsedMs`) plus the time
  since the last `Start`/`Resume`, so pausing and resuming never drifts.
- **Timer** counts down from a fixed end timestamp (`timerEndTimestamp`)
  rather than decrementing a counter each tick — this means it stays
  accurate even if the browser throttles background tabs, instead of
  running slow.
- **The ring** is one SVG `<circle>` whose `stroke-dashoffset` is updated
  each frame based on the remaining/total ratio — no canvas needed. It
  turns from lime to coral automatically in the final 15% of the duration.
- **On completion**: a short beep (generated with the Web Audio API — no
  audio file needed), a pulse animation on the ring, and a vibration on
  supporting mobile devices.
- **Keyboard shortcuts**: Space starts/pauses whichever mode is active,
  `L` logs a lap (stopwatch only), `R` resets. These are ignored while
  typing in the minutes/seconds inputs.

## Running it

Just open `index.html` directly in a browser — no server needed, since
unlike the weather app and blog, this has no `fetch()` calls to local
files or external APIs at all.

## Deploying it

Fully static, no API key, no functions — the simplest of the three
projects to deploy. Drag the folder onto Netlify, or use the same
`netlify init` / `netlify deploy --prod` flow as the blog.

## Ideas to extend it

- Save the stopwatch's lap history or the timer's last-used duration to
  `localStorage` so it survives a refresh.
- A "Pomodoro" preset mode that automatically alternates focus/break timers.
- Update the browser tab title with the live countdown, so you can see
  remaining time without the tab in focus.
- Multiple named timers running at once.