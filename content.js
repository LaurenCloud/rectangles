(() => {
  if (window.__rectanglesLoaded) return;
  window.__rectanglesLoaded = true;

  const EDGE = 8;
  const MIN_SIZE = 5;
  const CLICK_TOLERANCE = 3;

  const CURSOR = {
    nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
    n: 'n-resize', s: 's-resize', w: 'w-resize', e: 'e-resize',
    move: 'move',
  };

  const rects = new Set();
  let drawMode = false;
  let creating = null;     // drawing a fresh rect
  let interacting = null;  // moving/resizing an existing rect

  function host() {
    return document.fullscreenElement || document.body || document.documentElement;
  }

  function isRect(el) {
    return el && el.classList && el.classList.contains('rect-overlay');
  }

  function setDrawMode(on) {
    if (on) {
      // Hard reset: a toolbar click must always land on a clean slate, even
      // if some prior interaction (drag, resize, config panel) leaked state
      // because mouseup was lost to a window blur, iframe focus change, etc.
      cancelCreating();
      interacting = null;
      closeConfig();
    }
    drawMode = on;
    document.documentElement.classList.toggle('rect-drawing', on);
    if (on) toast('Rectangles: click & drag to cover');
  }

  function cancelCreating() {
    if (creating) {
      creating.el.remove();
      creating = null;
    }
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.85); color: #fff;
      font: 14px/1.4 system-ui, sans-serif; padding: 8px 14px;
      border-radius: 6px; z-index: 2147483647; pointer-events: none;
      transition: opacity 0.3s;
    `;
    host().appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; }, 1200);
    setTimeout(() => t.remove(), 1600);
  }

  function makeRect(x, y) {
    const el = document.createElement('div');
    el.className = 'rect-overlay';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = '0px';
    el.style.height = '0px';
    host().appendChild(el);
    return el;
  }

  function zoneFor(el, x, y) {
    const r = el.getBoundingClientRect();
    const lx = x - r.left, ly = y - r.top;
    const e = Math.min(EDGE, r.width / 3, r.height / 3);
    const w = lx < e, ee = lx > r.width - e;
    const n = ly < e, s = ly > r.height - e;
    if (n && w) return 'nw';
    if (n && ee) return 'ne';
    if (s && w) return 'sw';
    if (s && ee) return 'se';
    if (n) return 'n';
    if (s) return 's';
    if (w) return 'w';
    if (ee) return 'e';
    return 'move';
  }

  function applyResize(state, dx, dy) {
    let x = state.origLeft, y = state.origTop;
    let w = state.origWidth, h = state.origHeight;
    const z = state.zone;
    if (z === 'move') {
      x += dx; y += dy;
    } else {
      if (z.includes('w')) { x += dx; w -= dx; }
      if (z.includes('e')) { w += dx; }
      if (z.includes('n')) { y += dy; h -= dy; }
      if (z.includes('s')) { h += dy; }
    }
    if (w < MIN_SIZE) {
      if (z.includes('w')) x = state.origLeft + state.origWidth - MIN_SIZE;
      w = MIN_SIZE;
    }
    if (h < MIN_SIZE) {
      if (z.includes('n')) y = state.origTop + state.origHeight - MIN_SIZE;
      h = MIN_SIZE;
    }
    Object.assign(state.el.style, {
      left: x + 'px', top: y + 'px',
      width: w + 'px', height: h + 'px',
    });
  }

  function swallowNextClick() {
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallow, true), 0);
  }

  // ----- Persistence (per hostname + pathname + search) -----

  let ready = false;
  let saveBrightnessTimer = null;

  function storageKey() {
    return `cb:${location.hostname}${location.pathname}${location.search}`;
  }

  function defaultIgnore() {
    return { top: false, right: false, bottom: false, left: false };
  }

  function saveRects() {
    if (!ready) return;
    const arr = Array.from(rects).map((el) => {
      const out = { ignore: el.__ignore || defaultIgnore() };
      if (el.__rel) {
        out.rel = el.__rel;
      } else {
        out.abs = {
          left: parseFloat(el.style.left) || 0,
          top: parseFloat(el.style.top) || 0,
          width: parseFloat(el.style.width) || 0,
          height: parseFloat(el.style.height) || 0,
        };
      }
      return out;
    });
    chrome.storage.local.set({ [storageKey()]: arr });
  }

  function saveBrightnessDebounced() {
    if (!ready) return;
    clearTimeout(saveBrightnessTimer);
    saveBrightnessTimer = setTimeout(() => {
      chrome.storage.local.set({ 'cb:brightness': brightness });
    }, 250);
  }

  async function loadAndRestore() {
    try {
      const k = storageKey();
      const data = await chrome.storage.local.get([k, 'cb:brightness']);
      if (typeof data['cb:brightness'] === 'number') {
        brightness = data['cb:brightness'];
      }
      const saved = data[k] || [];
      for (const r of saved) {
        const el = makeRect(0, 0);
        el.__ignore = { ...defaultIgnore(), ...(r.ignore || {}) };
        if (r.rel) {
          el.__rel = r.rel;
          el.__pendingLink = true;
        } else if (r.abs) {
          el.style.left = (r.abs.left || 0) + 'px';
          el.style.top = (r.abs.top || 0) + 'px';
          el.style.width = (r.abs.width || 0) + 'px';
          el.style.height = (r.abs.height || 0) + 'px';
        }
        rects.add(el);
      }
      if (saved.length) {
        linkPending();
        for (const el of rects) sampleAndApply(el);
        startSampleLoop();
        startPendingLinkPoller();
      }
    } catch (e) {
      console.warn('[rectangles] restore failed:', e);
    } finally {
      ready = true;
    }
  }

  // ----- Live color sampling -----

  const STRIP_PX = 4;            // canvas-px strip just outside each edge
  const SAMPLE_W = 320;          // downscaled canvas width
  const SAMPLE_INTERVAL_MS = 100;
  let brightness = 0.85;         // sampled rgb is multiplied by this; right-click a rect to adjust

  let sampleCanvas = null;
  let sampleCtx = null;
  let sampleLoopRunning = false;

  function getSampleCanvas(W, H) {
    if (!sampleCanvas) {
      sampleCanvas = document.createElement('canvas');
      sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (sampleCanvas.width !== W || sampleCanvas.height !== H) {
      sampleCanvas.width = W;
      sampleCanvas.height = H;
    }
    return sampleCtx;
  }

  function findBiggestVideo() {
    let biggest = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const vr = v.getBoundingClientRect();
      const a = vr.width * vr.height;
      if (a > area) { area = a; biggest = v; }
    }
    return biggest;
  }

  function findVideoFor(rectEl) {
    const r = rectEl.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const stack = document.elementsFromPoint(cx, cy) || [];
      for (const el of stack) {
        if (el.tagName === 'VIDEO') return el;
      }
    }
    return findBiggestVideo();
  }

  // Returns the actual visible video region inside the element's bounding box,
  // accounting for letterboxing/pillarboxing when object-fit is contain.
  function visibleVideoArea(video) {
    const r = video.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    const fit = (getComputedStyle(video).objectFit || 'fill').trim();
    if (fit !== 'contain' && fit !== 'scale-down') {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    const elAspect = r.width / r.height;
    const vAspect = vw / vh;
    let w, h;
    if (vAspect > elAspect) { w = r.width;  h = r.width / vAspect; }
    else                    { h = r.height; w = r.height * vAspect; }
    return {
      left: r.left + (r.width - w) / 2,
      top:  r.top  + (r.height - h) / 2,
      width: w,
      height: h,
    };
  }

  // ----- Relative positioning (track the underlying video's size) -----

  const watchedVideos = new WeakSet();
  const videoObserver = new ResizeObserver(() => repositionAll());

  function watchVideo(v) {
    if (v && !watchedVideos.has(v)) {
      watchedVideos.add(v);
      videoObserver.observe(v);
      v.addEventListener('loadedmetadata', repositionAll);
      v.addEventListener('resize', repositionAll);
    }
  }

  function recordRel(rectEl) {
    const v = rectEl.__video;
    if (!v) { rectEl.__rel = null; return; }
    const va = visibleVideoArea(v);
    if (!va || !va.width || !va.height) { rectEl.__rel = null; return; }
    const r = rectEl.getBoundingClientRect();
    rectEl.__rel = {
      left:   (r.left - va.left) / va.width,
      top:    (r.top  - va.top)  / va.height,
      width:  r.width  / va.width,
      height: r.height / va.height,
    };
  }

  function applyRel(rectEl) {
    if (!rectEl.__video || !rectEl.__rel) return;
    const va = visibleVideoArea(rectEl.__video);
    if (!va || !va.width || !va.height) return;
    rectEl.style.left   = (va.left + rectEl.__rel.left  * va.width)  + 'px';
    rectEl.style.top    = (va.top  + rectEl.__rel.top   * va.height) + 'px';
    rectEl.style.width  = (rectEl.__rel.width  * va.width)  + 'px';
    rectEl.style.height = (rectEl.__rel.height * va.height) + 'px';
  }

  function lockToVideo(rectEl) {
    rectEl.__video = findVideoFor(rectEl);
    if (rectEl.__video) {
      recordRel(rectEl);
      watchVideo(rectEl.__video);
    }
  }

  function repositionAll() {
    for (const r of rects) applyRel(r);
  }

  function linkPending() {
    const v = findBiggestVideo();
    if (!v) return;
    const vr = v.getBoundingClientRect();
    if (!vr.width || !vr.height) return;
    if (!v.videoWidth || !v.videoHeight) return; // wait for metadata so visibleVideoArea is correct
    let linked = false;
    for (const el of rects) {
      if (el.__pendingLink && el.__rel) {
        el.__video = v;
        el.__pendingLink = false;
        applyRel(el);
        linked = true;
      }
    }
    if (linked) watchVideo(v);
  }

  function startPendingLinkPoller() {
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      let stillPending = false;
      for (const el of rects) if (el.__pendingLink) { stillPending = true; break; }
      if (!stillPending) { clearInterval(interval); return; }
      linkPending();
      if (tries > 100) clearInterval(interval); // ~20s
    }, 200);
  }

  function avgInStrip(data, W, H, x0, y0, x1, y1) {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1));
    y1 = Math.min(H, Math.ceil(y1));
    if (x0 >= x1 || y0 >= y1) return null;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2];
        n++;
      }
    }
    return n ? { r: r / n, g: g / n, b: b / n } : null;
  }

  function sampleColor(video, rectEl) {
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const va = visibleVideoArea(video);
    if (!va || !va.width || !va.height) return null;
    const r = rectEl.getBoundingClientRect();

    const W = SAMPLE_W;
    const H = Math.max(1, Math.round(W * video.videoHeight / video.videoWidth));
    const ctx = getSampleCanvas(W, H);

    try {
      ctx.drawImage(video, 0, 0, W, H);
    } catch (_) {
      return null;
    }

    let img;
    try {
      img = ctx.getImageData(0, 0, W, H);
    } catch (_) {
      return null; // canvas tainted (cross-origin / DRM)
    }
    const data = img.data;

    const sx = W / va.width;
    const sy = H / va.height;
    const left = (r.left - va.left) * sx;
    const right = (r.right - va.left) * sx;
    const top = (r.top - va.top) * sy;
    const bottom = (r.bottom - va.top) * sy;

    const ignore = rectEl.__ignore || {};
    const sides = [];
    if (!ignore.top)    sides.push(avgInStrip(data, W, H, left, top - STRIP_PX, right, top));
    if (!ignore.right)  sides.push(avgInStrip(data, W, H, right, top, right + STRIP_PX, bottom));
    if (!ignore.bottom) sides.push(avgInStrip(data, W, H, left, bottom, right, bottom + STRIP_PX));
    if (!ignore.left)   sides.push(avgInStrip(data, W, H, left - STRIP_PX, top, left, bottom));
    const strips = sides.filter(Boolean);

    if (!strips.length) return null;
    const sum = strips.reduce(
      (a, c) => ({ r: a.r + c.r, g: a.g + c.g, b: a.b + c.b }),
      { r: 0, g: 0, b: 0 }
    );
    const n = strips.length;
    return {
      r: Math.round((sum.r / n) * brightness),
      g: Math.round((sum.g / n) * brightness),
      b: Math.round((sum.b / n) * brightness),
    };
  }

  function sampleAndApply(rectEl) {
    if (!rectEl.__video || !rectEl.__video.isConnected) {
      rectEl.__video = findVideoFor(rectEl);
    }
    const c = sampleColor(rectEl.__video, rectEl);
    if (c) rectEl.style.backgroundColor = `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  function startSampleLoop() {
    if (sampleLoopRunning) return;
    sampleLoopRunning = true;
    let last = 0;
    function tick(t) {
      if (rects.size === 0) { sampleLoopRunning = false; return; }
      if (t - last >= SAMPLE_INTERVAL_MS) {
        last = t;
        for (const rectEl of rects) {
          if (interacting && interacting.el === rectEl) continue;
          sampleAndApply(rectEl);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Hover: update cursor based on zone (only when idle).
  document.addEventListener('mousemove', (e) => {
    if (creating || interacting || drawMode) return;
    if (isRect(e.target)) {
      e.target.style.cursor = CURSOR[zoneFor(e.target, e.clientX, e.clientY)];
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (configPanel) { closeConfig(); return; }
      if (drawMode || creating) {
        cancelCreating();
        setDrawMode(false);
      }
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'rectangles:enter-draw') {
      setDrawMode(true);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (configPanel && configPanel.contains(e.target)) return;
    if (configPanel) closeConfig();
    if (e.button !== 0) return;

    if (drawMode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      creating = {
        startX: e.clientX,
        startY: e.clientY,
        el: makeRect(e.clientX, e.clientY),
      };
      return;
    }

    if (isRect(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const el = e.target;
      const r = el.getBoundingClientRect();
      interacting = {
        el,
        zone: zoneFor(el, e.clientX, e.clientY),
        startX: e.clientX,
        startY: e.clientY,
        origLeft: r.left,
        origTop: r.top,
        origWidth: r.width,
        origHeight: r.height,
        moved: false,
      };
    }
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (creating) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const x = Math.min(creating.startX, e.clientX);
      const y = Math.min(creating.startY, e.clientY);
      const w = Math.abs(e.clientX - creating.startX);
      const h = Math.abs(e.clientY - creating.startY);
      Object.assign(creating.el.style, {
        left: x + 'px', top: y + 'px',
        width: w + 'px', height: h + 'px',
      });
      return;
    }

    if (interacting) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const dx = e.clientX - interacting.startX;
      const dy = e.clientY - interacting.startY;
      if (Math.abs(dx) > CLICK_TOLERANCE || Math.abs(dy) > CLICK_TOLERANCE) {
        interacting.moved = true;
      }
      applyResize(interacting, dx, dy);
    }
  }, true);

  document.addEventListener('mouseup', (e) => {
    if (creating) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const el = creating.el;
      const r = el.getBoundingClientRect();
      if (r.width < MIN_SIZE || r.height < MIN_SIZE) {
        el.remove();
      } else {
        rects.add(el);
        lockToVideo(el);
        sampleAndApply(el);
        startSampleLoop();
        saveRects();
      }
      creating = null;
      setDrawMode(false);
      swallowNextClick();
      return;
    }

    if (interacting) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const wasMoved = interacting.moved;
      const movedEl = interacting.el;
      interacting = null;
      if (wasMoved) {
        lockToVideo(movedEl);
        saveRects();
        swallowNextClick();
      }
    }
  }, true);

  document.addEventListener('dblclick', (e) => {
    if (drawMode) return;
    if (!isRect(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = e.target;
    el.remove();
    rects.delete(el);
    saveRects();
  }, true);

  // ----- Config panel (right-click a rect) -----

  let configPanel = null;

  function openConfig(x, y, rectEl) {
    closeConfig();
    const panel = document.createElement('div');
    panel.className = 'rect-config';
    panel.innerHTML = `
      <label>Brightness: <span class="rect-val"></span></label>
      <input type="range" min="0" max="100" step="1">
      <div class="rect-edges-header">Sample edges</div>
      <div class="rect-edges">
        <span></span>
        <button data-edge="top" title="Toggle top-edge sampling">↑</button>
        <span></span>
        <button data-edge="left" title="Toggle left-edge sampling">←</button>
        <span></span>
        <button data-edge="right" title="Toggle right-edge sampling">→</button>
        <span></span>
        <button data-edge="bottom" title="Toggle bottom-edge sampling">↓</button>
        <span></span>
      </div>
      <button class="rect-remove" title="Delete this rectangle" aria-label="Remove">
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5h10"/>
          <path d="M5 5l1 8a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-8"/>
          <path d="M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1"/>
        </svg>
      </button>
    `;

    const slider = panel.querySelector('input');
    const val = panel.querySelector('.rect-val');
    const pct = Math.round(brightness * 100);
    slider.value = String(pct);
    val.textContent = pct + '%';
    slider.addEventListener('input', () => {
      brightness = Number(slider.value) / 100;
      val.textContent = slider.value + '%';
      for (const r of rects) sampleAndApply(r);
      saveBrightnessDebounced();
    });

    panel.querySelector('.rect-remove').addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      rectEl.remove();
      rects.delete(rectEl);
      saveRects();
      closeConfig();
    });

    rectEl.__ignore = rectEl.__ignore || { top: false, right: false, bottom: false, left: false };
    const ignore = rectEl.__ignore;
    for (const btn of panel.querySelectorAll('.rect-edges button')) {
      const edge = btn.dataset.edge;
      btn.classList.toggle('off', !!ignore[edge]);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ignore[edge] = !ignore[edge];
        btn.classList.toggle('off', ignore[edge]);
        sampleAndApply(rectEl);
        saveRects();
      });
    }

    host().appendChild(panel);
    const pr = panel.getBoundingClientRect();
    const px = Math.min(x, window.innerWidth - pr.width - 8);
    const py = Math.min(y, window.innerHeight - pr.height - 8);
    panel.style.left = Math.max(8, px) + 'px';
    panel.style.top = Math.max(8, py) + 'px';
    configPanel = panel;
  }

  function closeConfig() {
    if (configPanel) {
      configPanel.remove();
      configPanel = null;
    }
  }

  document.addEventListener('contextmenu', (e) => {
    if (drawMode) return;
    if (!isRect(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openConfig(e.clientX, e.clientY, e.target);
  }, true);

  document.addEventListener('fullscreenchange', () => {
    const h = host();
    rects.forEach((r) => h.appendChild(r));
    setTimeout(repositionAll, 0);
  });

  window.addEventListener('resize', repositionAll);

  loadAndRestore();
})();
