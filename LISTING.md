# Chrome Web Store Listing — Rectangles

Source-of-truth copy for the CWS submission. Each section maps to a field in the dev console listing form.

---

## Store listing tab

### Name

> Rectangles

### Short description

> Cover any region of a webpage with a rectangle that live-samples the underlying video so it blends in.

### Detailed description

> Click the toolbar icon, then click-and-drag to place a rectangle over any region of a webpage. The rectangle continuously samples the pixels around it (about 10 times per second) and matches its color to the underlying video, so it blends in with what's behind it instead of being a flat opaque box.
>
> Originally built to hide chat overlays that some Twitch streamers composite directly into the stream output — the kind of overlay you can't toggle off in the player because it's part of the broadcast itself. Works the same on any site with embedded video.
>
> FEATURES
>
> • Click-and-drag to place rectangles. Drag to move; drag edges or corners to resize.
> • Color-matches the underlying video in real time, with a 150 ms transition between scene changes so the rectangle fades smoothly instead of strobing.
> • Aspect-aware: rectangles are stored as fractions of the visible video area, so they follow the chat overlay through fullscreen toggles, theater mode, window resizes, and player letterboxing.
> • Right-click any rectangle for a config panel — brightness slider (defaults to 85%), per-edge sampling toggles for when one side butts against something irrelevant like a player bezel.
> • Per-page persistence (keyed by hostname + path + querystring) via chrome.storage.local. Nothing leaves your browser.
> • Double-click or right-click → trash to remove.
>
> USAGE
>
> • Enter draw mode: click the toolbar icon
> • Place a rectangle: click-and-drag
> • Move: drag the rectangle
> • Resize: drag from an edge or corner
> • Remove: double-click, or right-click → trash icon
> • Configure: right-click
> • Cancel draw mode: Esc
>
> SOURCE
>
> Open source on GitHub: https://github.com/LaurenCloud/rectangles

### Category

Productivity

### Language

English (United States)

### Graphic assets

| Field | File |
|---|---|
| Store icon (128×128) | `icons/icon-128.png` |
| Screenshot 1 (1280×800) | `icons/screenshot-1.png` |
| Screenshot 2 (1280×800) | `icons/screenshot-2.png` |
| Small promo tile (440×280) | `icons/promo-440x280.png` |
| Marquee promo tile (1400×560) | _skip — optional_ |

---

## Privacy practices tab

### Single purpose

> Cover regions of a webpage with rectangles that color-match the video behind them.

### Permission justifications

**`storage`**

> Persists each rectangle's position, size, brightness, and per-edge sampling settings via chrome.storage.local so they reappear on subsequent visits to the same page. No data leaves the browser.

**Host permission `<all_urls>`**

> Rectangles can be placed on any site that embeds video. The extension samples pixels from `<video>` elements on the current page locally to color-match the rectangle to the video underneath. Required because users place rectangles on arbitrary sites (Twitch, YouTube, Vimeo, etc.); no page contents are read or transmitted.

### Data usage

Leave **all categories unchecked** — the extension collects nothing.

| Category | Collected? |
|---|---|
| Personally identifiable info | No |
| Health info | No |
| Financial & payment info | No |
| Authentication info | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

### Certifications

Check all three:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL

> https://github.com/LaurenCloud/rectangles/blob/main/PRIVACY.md

---

## Distribution tab

- **Visibility**: Public
- **Distribution regions**: All regions
- **Pricing**: Free

---

## Package

Upload `rectangles-0.3.1.zip` (built from this repo's root, contains `manifest.json`, `background.js`, `content.js`, `content.css`, and the four icon PNGs).
