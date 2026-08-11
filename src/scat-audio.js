/*
 * SCATERNET — sound (v3, per Tristan's plan).
 * Exposes globalThis.ScaternetAudio =
 *   { start, stop, handleMedia, setVolume, setMute, setLayerOverVideos, playClick }.
 *
 * The mix (sparse on purpose — one thing at a time, not a wall):
 *  - BED: the ska/reggae tracks played back-to-back as a shuffled playlist (one
 *    at a time, next on 'ended', loops forever). Long and varied, not layered.
 *  - SCAT VOCAL: Tristan's own scat recording, looping ON TOP, with a volume
 *    SWELL — sits low so the song breathes, then BLASTS to the ceiling (max, so it
 *    distorts) for a moment. Cycle timing is randomised each time.
 *  - FARTS: dropped in randomly on top at random intervals, plus one on every click.
 *  - VIDEOS: a ska track is layered over each video (original NOT muted).
 *  - Everything starts on the first user gesture (browser autoplay rule). Music +
 *    scat + random farts are top-frame only so ad-iframes don't multiply them.
 *  - Bundled chrome-extension:// audio, no network, CSP-safe. Web-Audio synth
 *    fallbacks keep sound alive if a clip can't play.
 */
(function () {
  "use strict";

  const isTop = (function () {
    try { return window.top === window; } catch (_e) { return true; }
  })();

  const assets = globalThis.ScaternetAudioAssets || { ska: [], scat: [], farts: [] };

  let running = false;
  let muted = false;
  let volume = 0.7;
  let layerOverVideos = true;
  let unlocked = false;

  let bedEl = null;        // the ska playlist element (top frame)
  let bedQueue = [];       // shuffled ska urls
  let scatEl = null;       // Tristan's scat vocal (top frame), swelled
  let swellTimer = null;
  let fartTimer = null;
  let lastClickAt = 0;
  const videoTracks = new WeakMap();
  const wiredMedia = new WeakSet();

  // ---- Web Audio (fallback synth only) ----
  let ctx = null;
  let synthSkaTimer = null;
  function getCtx() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (_e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function extURL(sub, file) {
    try { return chrome.runtime.getURL("assets/audio/" + sub + "/" + file); }
    catch (_e) { return "assets/audio/" + sub + "/" + file; }
  }
  const skaURLs = (assets.ska || []).map((f) => extURL("ska", f));
  const scatURLs = (assets.scat || []).map((f) => extURL("scat", f));
  const fartURLs = (assets.farts || []).map((f) => extURL("farts", f));

  function pick(a) { return a.length ? a[(Math.random() * a.length) | 0] : null; }
  function shuffle(a) {
    const s = a.slice();
    for (let i = s.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  function warm(urls) {
    for (const u of urls) { try { const a = new Audio(); a.preload = "auto"; a.src = u; } catch (_e) {} }
  }

  function clampVol(v) { return Math.max(0, Math.min(1, v)); }
  function fartVol() { return clampVol(volume * 1.6); } // farts punch like the rest

  // ---- one-shot farts (clicks + random interjections) ----
  function playOneShot(url, vol) {
    if (typeof Audio === "undefined" || !url) return false;
    try {
      const a = new Audio(url);
      a.volume = clampVol(vol);
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => synthFart());
      return true;
    } catch (_e) { return false; }
  }
  function synthFart() {
    const ac = getCtx();
    if (!ac || ac.state !== "running") return;
    const t = ac.currentTime, dur = 0.35 + Math.random() * 0.3;
    const src = ac.createBufferSource();
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 120 + Math.random() * 120; bp.Q.value = 6;
    const trem = ac.createGain(); // flutter
    const lfo = ac.createOscillator(); lfo.frequency.value = 18 + Math.random() * 22;
    const lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(trem.gain);
    const g = ac.createGain(); g.gain.setValueAtTime(0.5 * volume, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(trem).connect(g).connect(ac.destination);
    lfo.start(t); src.start(t); src.stop(t + dur); lfo.stop(t + dur);
  }

  function playClick() {
    if (!running || muted) return;
    const now = Date.now();
    if (now - lastClickAt < 90) return;
    lastClickAt = now;
    const url = pick(fartURLs);
    if (url) playOneShot(url, fartVol()); else synthFart();
  }
  function onPointerDown() { playClick(); }

  function scheduleFarts() {
    if (!isTop) return;
    if (fartTimer) clearTimeout(fartTimer);
    const delay = 1500 + Math.random() * 5000; // random interjections
    fartTimer = setTimeout(() => {
      if (running && !muted && fartURLs.length) playOneShot(pick(fartURLs), fartVol());
      scheduleFarts();
    }, delay);
  }

  // ---- ska BED playlist (top frame): one track at a time, sequential, looping ----
  function nextBedURL() {
    if (skaURLs.length === 0) return null;
    if (bedQueue.length === 0) bedQueue = shuffle(skaURLs);
    return bedQueue.shift();
  }
  function playNextBed() {
    if (!running || muted) return;
    const url = nextBedURL();
    if (!url) { startSynthSka(); return; }
    try {
      if (!bedEl) {
        bedEl = new Audio();
        bedEl.addEventListener("ended", playNextBed);
        bedEl.addEventListener("error", playNextBed);
      }
      bedEl.src = url;
      bedEl.loop = false;
      bedEl.volume = clampVol(volume);
      const p = bedEl.play();
      if (p && typeof p.catch === "function") p.catch(() => startSynthSka());
    } catch (_e) { startSynthSka(); }
  }
  function stopBed() {
    if (bedEl) {
      bedEl.removeEventListener("ended", playNextBed);
      bedEl.removeEventListener("error", playNextBed);
      try { bedEl.pause(); } catch (_e) {}
      bedEl = null;
    }
    bedQueue = [];
    stopSynthSka();
  }

  // ---- scat vocal (Tristan) with the SWELL ----
  function startScat() {
    if (!isTop || scatURLs.length === 0) return;
    try {
      scatEl = new Audio(pick(scatURLs));
      scatEl.loop = true;
      scatEl.volume = Math.min(0.85, volume * 0.5);
      const p = scatEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_e) { scatEl = null; return; }
    startSwell();
  }
  function newCycle() {
    const lowT = 40 + ((Math.random() * 90) | 0);   // 4–13s baseline (random)
    const upT = 4;                                    // ~0.4s ramp up
    const holdT = 15 + ((Math.random() * 30) | 0);   // 1.5–4.5s BLAST (random)
    const downT = 8;                                  // ~0.8s ramp down
    return { lowT, upT, holdT, downT, total: lowT + upT + holdT + downT };
  }
  function startSwell() {
    if (swellTimer || !scatEl) return;
    let cyc = newCycle(), step = 0;
    swellTimer = setInterval(() => {
      if (!running || muted || !scatEl) return;
      let env;
      if (step < cyc.lowT) env = 0;
      else if (step < cyc.lowT + cyc.upT) env = (step - cyc.lowT) / cyc.upT;
      else if (step < cyc.lowT + cyc.upT + cyc.holdT) env = 1;
      else if (step < cyc.total) env = 1 - (step - cyc.lowT - cyc.upT - cyc.holdT) / cyc.downT;
      else { cyc = newCycle(); step = 0; env = 0; }
      const peak = 1.0;                       // slam to the ceiling (distorts)
      const low = Math.min(0.85, volume * 0.5);
      try { scatEl.volume = clampVol(low + (peak - low) * env); } catch (_e) {}
      step++;
    }, 100);
  }
  function stopScat() {
    if (swellTimer) { clearInterval(swellTimer); swellTimer = null; }
    if (scatEl) { try { scatEl.pause(); } catch (_e) {} scatEl = null; }
  }

  // ---- synth ska fallback (only if no ska clip plays) ----
  function startSynthSka() {
    if (!isTop || synthSkaTimer || muted) return;
    const ac = getCtx(); if (!ac) return;
    const chords = [[262, 330, 392], [294, 370, 440], [349, 440, 523], [233, 294, 349]];
    let step = 0;
    synthSkaTimer = setInterval(() => {
      if (!running || muted) return;
      const ac2 = getCtx(); if (!ac2 || ac2.state !== "running") return;
      if (step % 2 === 1) {
        const t = ac2.currentTime, chord = chords[(step >> 1) % chords.length];
        for (const f of chord) {
          const o = ac2.createOscillator(); o.type = "square"; o.frequency.value = f;
          const g = ac2.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05 * volume + 0.001, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          o.connect(g).connect(ac2.destination); o.start(t); o.stop(t + 0.18);
        }
      }
      step++;
    }, 250);
  }
  function stopSynthSka() { if (synthSkaTimer) { clearInterval(synthSkaTimer); synthSkaTimer = null; } }

  // ---- unlock on first gesture ----
  function unlock() {
    if (unlocked || !running) return;
    unlocked = true;
    getCtx();
    playNextBed();
    startScat();
    scheduleFarts();
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  }

  // ---- videos: layer a ska track over them, never mute ----
  function startVideoTrack(video) {
    if (!layerOverVideos || muted || videoTracks.has(video)) return;
    const url = pick(skaURLs); if (!url) return;
    try {
      const a = new Audio(url); a.loop = true; a.volume = clampVol(volume);
      const p = a.play(); if (p && typeof p.catch === "function") p.catch(() => {});
      videoTracks.set(video, a);
    } catch (_e) {}
  }
  function stopVideoTrack(video) {
    const a = videoTracks.get(video);
    if (a) { try { a.pause(); } catch (_e) {} videoTracks.delete(video); }
  }
  function onMediaPlay(e) { if (running && e.target.tagName === "VIDEO") startVideoTrack(e.target); }
  function onMediaStop(e) { stopVideoTrack(e.target); }
  function wireMedia(el) {
    if (!el || el.tagName !== "VIDEO" || wiredMedia.has(el)) return;
    wiredMedia.add(el);
    el.addEventListener("play", onMediaPlay);
    el.addEventListener("pause", onMediaStop);
    el.addEventListener("ended", onMediaStop);
    if (!el.paused && !el.ended) startVideoTrack(el);
  }
  function handleMedia(el) { if (running) wireMedia(el); }
  function scanMedia() { document.querySelectorAll("video").forEach(wireMedia); }

  // ---- public API ----
  function start(opts) {
    running = true;
    unlocked = false;
    if (opts) {
      if (typeof opts.volume === "number") volume = opts.volume;
      if (typeof opts.muteAudio === "boolean") muted = opts.muteAudio;
      if (typeof opts.layerOverVideos === "boolean") layerOverVideos = opts.layerOverVideos;
    }
    warm(skaURLs); warm(scatURLs); warm(fartURLs);
    scanMedia();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }
  function stop() {
    running = false;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    stopBed(); stopScat();
    if (fartTimer) { clearTimeout(fartTimer); fartTimer = null; }
    document.querySelectorAll("video").forEach((v) => {
      stopVideoTrack(v);
      v.removeEventListener("play", onMediaPlay);
      v.removeEventListener("pause", onMediaStop);
      v.removeEventListener("ended", onMediaStop);
    });
  }
  function setVolume(v) {
    volume = clampVol(v);
    if (bedEl) bedEl.volume = volume; // scat is driven by the swell; leave it
    document.querySelectorAll("video").forEach((vid) => { const a = videoTracks.get(vid); if (a) a.volume = volume; });
  }
  function setMute(m) {
    muted = !!m;
    if (muted) { stopBed(); stopScat(); document.querySelectorAll("video").forEach(stopVideoTrack); }
    else if (running && unlocked) { playNextBed(); startScat(); }
  }
  function setLayerOverVideos(v) {
    layerOverVideos = !!v;
    if (!layerOverVideos) document.querySelectorAll("video").forEach(stopVideoTrack);
  }

  globalThis.ScaternetAudio = {
    start, stop, handleMedia, setVolume, setMute, setLayerOverVideos, playClick,
  };
})();
