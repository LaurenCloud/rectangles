# Privacy Policy — Rectangles

_Last updated: 2026-05-10_

**Short version:** Rectangles does not collect, transmit, or sell any data. Everything stays in your browser.

## What gets stored

The extension uses `chrome.storage.local` to remember the rectangles you draw on a page so they reappear next time you visit. For each page (keyed by `hostname + pathname + querystring`) it stores:

- Position and size of each rectangle (as fractions of the visible video area)
- Per-edge "ignore" toggles (which sides to sample for color matching)
- Brightness factor

Nothing else is stored.

## What is NOT collected

- No personal information
- No browsing history
- No page contents
- No analytics, telemetry, crash reports, or usage statistics
- No cookies, identifiers, or fingerprints
- No remote requests of any kind — the extension makes zero network calls

## Where data lives

`chrome.storage.local` is a per-browser-profile store on your own machine. It is not synced to Google or anywhere else. Clearing your browser's site data, or uninstalling the extension, removes everything Rectangles has stored.

## Permissions

- **`storage`** — used solely to persist rectangle positions per page, as described above.
- **Host access (`<all_urls>`)** — required because the rectangles can be placed on any site with embedded video (Twitch, YouTube, etc.). The extension only reads pixels from `<video>` elements on the current page, locally, in order to color-match the rectangle. No page contents are exfiltrated.

## Contact

Questions? Open an issue at https://github.com/LaurenCloud/rectangles
