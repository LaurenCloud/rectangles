// Three slightly overlapping slate-gray rectangles, drawn into a bitmap
// because Chromium MV3 toolbar icons must be raster (no SVG).
function buildIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 16; // design grid is 16×16
  const r = 1.2 * s;
  const shapes = [
    { x: 1,   y: 2, w: 7, h: 6, fill: '#475569' },
    { x: 4.5, y: 5, w: 7, h: 6, fill: '#94a3b8' },
    { x: 8,   y: 8, w: 7, h: 6, fill: '#cbd5e1' },
  ];
  for (const sh of shapes) {
    ctx.fillStyle = sh.fill;
    ctx.beginPath();
    ctx.roundRect(sh.x * s, sh.y * s, sh.w * s, sh.h * s, r);
    ctx.fill();
  }
  return ctx.getImageData(0, 0, size, size);
}

function setExtensionIcon() {
  try {
    chrome.action.setIcon({
      imageData: {
        16: buildIcon(16),
        32: buildIcon(32),
        48: buildIcon(48),
        128: buildIcon(128),
      },
    });
  } catch (e) {
    console.warn('[rectangles] setIcon failed:', e);
  }
}

setExtensionIcon();
chrome.runtime.onInstalled.addListener(setExtensionIcon);
chrome.runtime.onStartup.addListener(setExtensionIcon);

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'rectangles:enter-draw' });
  } catch (_) {
    // Content script not loaded in this tab (e.g. chrome:// pages). Ignore.
  }
});
