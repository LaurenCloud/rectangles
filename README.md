# Rectangles

A browser extension (Chromium / Helium / Chrome / Edge / Brave) that lets you cover any region of a webpage with a rectangle that **live-samples the underlying video pixels** so it blends in with what's behind it.

Originally built to hide embedded chat overlays that some Twitch streamers composite into their stream output — the kind of thing you can't toggle off because it's part of the broadcast itself.

<!-- screenshots go here -->

## Features

- Click the toolbar icon, then click-and-drag to place a rectangle
- Rectangles continuously sample the underlying video frame (~10Hz) and match its color, smoothly transitioning between scene changes
- **Drag** any rectangle to move it; drag from edges/corners to resize
- **Double-click** (or use the trash button in the right-click menu) to remove
- **Right-click** any rectangle for a small config panel:
  - Brightness slider (defaults to 85%)
  - Toggle which edges (top / right / bottom / left) get sampled — useful when one side of your rectangle butts against something irrelevant like a player bezel or a UI bar
- Per-page persistence: positions, sizes, per-edge ignore state, and brightness are remembered per `hostname + pathname` via `chrome.storage.local`
- **Aspect-aware**: rectangles are stored as fractions of the *visible video area*, not the bounding box. They follow the chat overlay through fullscreen toggles, theater mode, window resizes, and player letterboxing

## Install (unpacked)

Until this is published to a store:

1. Clone this repo: `git clone https://github.com/LaurenCloud/rectangles.git`
2. Visit `chrome://extensions` (or your browser's equivalent)
3. Enable Developer mode
4. **Load unpacked** → pick the cloned directory
5. Pin the icon to the toolbar

## Usage

| Action | How |
|---|---|
| Enter draw mode | Click the toolbar icon |
| Place a rectangle | Click-and-drag |
| Move | Drag the rectangle |
| Resize | Drag from an edge or corner |
| Remove | Double-click, or right-click → trash icon |
| Configure | Right-click |
| Cancel draw mode | `Esc` |

## How the color tracking works

When you place a rectangle, the extension finds the underlying `<video>` element behind it. Every ~100ms it draws the current video frame into a small offscreen canvas at the video's natural aspect ratio, reads a thin strip of pixels just outside each side of the rectangle, averages them per-side, then averages those into one color. The rectangle's `background-color` is set to that average × the brightness factor, with a 150ms CSS transition so it fades smoothly between scene changes instead of strobing.

To handle players that letterbox (Twitch is a common one), the screen-to-video coordinate mapping uses the *visible* video area inside the element bounds — computed from `video.videoWidth` / `videoHeight` and the element's current `object-fit` — not the bounding rect. This is also what lets the rectangle stay anchored to the actual chat overlay when the player resizes.

If a canvas read fails (e.g. DRM-protected content taints the canvas), the rectangle falls back to solid black.

## Files

- `manifest.json` — MV3 manifest
- `background.js` — service worker; renders the toolbar icon into a bitmap (Chromium MV3 won't accept SVG icons) and forwards click events to the content script
- `content.js` — all interaction, sampling, and persistence logic
- `content.css` — overlay and config-panel styles
