/*
 * SCATERNET — sound. The web now plays terrible ska.
 * Exposes globalThis.ScaternetAudio =
 *   { start, stop, handleMedia, setVolume, setMute, setLayerOverVideos, playClick }.
 *
 *  - A ska+scat+sax MUSIC LOOP starts on the user's first gesture (browsers block
 *    autoplay-with-sound until then) and loops forever. Top frame only, so pages
 *    full of ad-iframes don't spawn 20 overlapping loops.
 *  - Every mouse click fires a one-shot from a weighted pool (~70% scat syllable,
 *    ~30% fart — widest fart spectrum we could bundle). Fresh <audio> each time so
 *    rapid clicks overlap into chaos. 90ms floor stops one physical click double-firing.
 *  - Random fart interjections drop onto the loop every ~8–15s for texture.
 *  - VIDEOS: we do NOT mute them. A ska track is layered ON TOP of the original
 *    audio while it plays, and the page music keeps going = intended 3-way cacophony.
 *  - If a bundled clip can't play, a Web-Audio SYNTH fallback keeps sound alive.
 *  - All bundled clips are chrome-extension:// origin (no network, CSP-safe).
 */
(function () {
  "use strict";

  const isTop = (function () {
    try { return window.top === window; } catch (_e) { return true; }
  })();

  const assets = globalThis.ScaternetAudioAssets || { music: [], video: [], scats: [], farts: [] };

  let running = false;
  let muted = false;
  let volume = 0.7;
  let layerOverVideos = true;
  let unlocked = false;
  let musicEls = []; // background loop stems, layered (ska bed + scat vocal + sax)
  const scatStems = []; // the vocal-scat stems (get the big swell)
  let swellTimer = null;
  let swellStep = 0;
  let fartTimer = null;

  // Farts should hit as hard as the sax — punchy, near the top of the mix.
  function fartVol() { return Math.max(0, Math.min(1, volume * 1.8)); }
  let lastClickAt = 0;
  const videoTracks = new WeakMap(); // video -> layered <audio>
  const wiredMedia = new WeakSet();

  // ---- Web Audio (fallback synth) ----
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
  function urlsFor(sub, list) {
    return (list || []).map((f) => extURL(sub, f));
  }
  const musicURLs = urlsFor("music", assets.music);
  const videoURLs = urlsFor("video", assets.video.length ? assets.video : assets.music);
  const scatURLs = urlsFor("scats", assets.scats);
  const fartURLs = urlsFor("farts", assets.farts);

  // Warm the cache so the first sound is instant.
  function warm(urls) {
    for (const u of urls) {
      try { const a = new Audio(); a.preload = "auto"; a.src = u; } catch (_e) { /* no Audio */ }
    }
  }

  function pick(arr) { return arr.length ? arr[(Math.random() * arr.length) | 0] : null; }

  // ---- one-shots (clicks + fart interjections) ----
  function playOneShot(url, vol) {
    if (typeof Audio === "undefined" || !url) return false;
    try {
      const a = new Audio(url);
      a.volume = Math.max(0, Math.min(1, vol));
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => synthScat());
      return true;
    } catch (_e) { return false; }
  }

  // A short cartoon scat blip: a couple of quick pitched bleeps. Fallback only.
  function synthScat() {
    const ac = getCtx();
    if (!ac || ac.state !== "running") return;
    const t = ac.currentTime;
    const n = 2 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const osc = ac.createOscillator();
      osc.type = "square";
      const f = 220 + Math.random() * 500;
      osc.frequency.setValueAtTime(f, t + i * 0.09);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.18 * volume + 0.001, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.08);
      osc.connect(g).connect(ac.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.09);
    }
  }

  function playClick() {
    if (!running || muted) return;
    const now = Date.now();
    if (now - lastClickAt < 90) return; // de-dupe a single physical click
    lastClickAt = now;
    // ~70% scat, ~30% fart. Farts hit much harder (same as the sax).
    const useFart = Math.random() < 0.3 && fartURLs.length > 0;
    const url = useFart ? pick(fartURLs) : (pick(scatURLs) || pick(fartURLs));
    if (!url) { synthScat(); return; }
    playOneShot(url, useFart ? fartVol() : volume);
  }

  function onPointerDown() { playClick(); }

  // ---- background music loop (top frame only) ----
  // Layers EVERY stem in assets/audio/music/ at once (ska bed + scat vocal + sax)
  // = the intended "ska backing + scats + sax solo on top" cacophony. If none can
  // play, the Web-Audio synth skank keeps a bed going.
  function startMusic() {
    if (!isTop || muted) return;
    if (musicURLs.length === 0) { startSynthSka(); scheduleFarts(); return; }
    let anyStarted = false;
    for (const url of musicURLs) {
      try {
        const el = new Audio(url);
        el.loop = true;
        const isVocal = /scatvox/i.test(url); // the scat-singing stems
        el.volume = isVocal ? volume * 0.06 : Math.max(0, Math.min(1, volume));
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
        musicEls.push(el);
        if (isVocal) scatStems.push(el);
        anyStarted = true;
      } catch (_e) { /* skip this stem */ }
    }
    if (!anyStarted) startSynthSka();
    if (scatStems.length) startScatSwell();
    scheduleFarts();
  }

  // The scat vocals blast WAY up (out of the mix, near-saturated) for a moment,
  // then drop right down so the ska song breathes — on a repeating cycle.
  function startScatSwell() {
    if (swellTimer) return;
    swellStep = 0;
    const CYCLE = 72; // ticks (~7.2s) per swell
    swellTimer = setInterval(() => {
      if (!running || muted || scatStems.length === 0) return;
      const phase = (swellStep % CYCLE) / CYCLE; // 0..1
      let env;
      if (phase < 0.1) env = phase / 0.1;              // fast blast up
      else if (phase < 0.2) env = 1;                    // hold — way too loud
      else if (phase < 0.36) env = 1 - (phase - 0.2) / 0.16; // fall back down
      else env = 0;                                     // stay low, song audible
      const peak = Math.min(1, volume * 2.2); // slam to the ceiling
      const low = volume * 0.05;
      const v = Math.max(0, Math.min(1, low + (peak - low) * env));
      for (const el of scatStems) { try { el.volume = v; } catch (_e) {} }
      swellStep++;
    }, 100);
  }
  function stopScatSwell() {
    if (swellTimer) { clearInterval(swellTimer); swellTimer = null; }
    scatStems.length = 0;
  }

  function stopMusic() {
    for (const el of musicEls) { try { el.pause(); } catch (_e) {} }
    musicEls = [];
    stopScatSwell();
    stopSynthSka();
    if (fartTimer) { clearTimeout(fartTimer); fartTimer = null; }
  }

  function scheduleFarts() {
    if (!isTop) return;
    if (fartTimer) clearTimeout(fartTimer);
    const delay = 8000 + Math.random() * 7000;
    fartTimer = setTimeout(() => {
      if (running && !muted && fartURLs.length) playOneShot(pick(fartURLs), fartVol());
      scheduleFarts();
    }, delay);
  }

  // Fallback looping "ska" if no music clip can play: offbeat square-wave chords.
  function startSynthSka() {
    if (!isTop || synthSkaTimer || muted) return;
    const ac = getCtx();
    if (!ac) return;
    const chords = [[262, 330, 392], [294, 370, 440], [349, 440, 523], [233, 294, 349]];
    let step = 0;
    synthSkaTimer = setInterval(() => {
      if (!running || muted) return;
      const ac2 = getCtx();
      if (!ac2 || ac2.state !== "running") return;
      // Skank on the offbeat: play a short stab.
      if (step % 2 === 1) {
        const t = ac2.currentTime;
        const chord = chords[(step >> 1) % chords.length];
        for (const f of chord) {
          const o = ac2.createOscillator();
          o.type = "square";
          o.frequency.value = f;
          const g = ac2.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05 * volume + 0.001, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          o.connect(g).connect(ac2.destination);
          o.start(t); o.stop(t + 0.18);
        }
      }
      step++;
    }, 250);
  }
  function stopSynthSka() {
    if (synthSkaTimer) { clearInterval(synthSkaTimer); synthSkaTimer = null; }
  }

  // ---- unlock on first gesture ----
  function unlock() {
    if (unlocked || !running) return;
    unlocked = true;
    getCtx();
    startMusic();
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  }

  // ---- videos: layer, never mute ----
  function startVideoTrack(video) {
    if (!layerOverVideos || muted || videoTracks.has(video)) return;
    const url = pick(videoURLs);
    if (!url) return;
    try {
      const a = new Audio(url);
      a.loop = true;
      a.volume = Math.max(0, Math.min(1, volume));
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      videoTracks.set(video, a);
    } catch (_e) { /* ignore */ }
  }
  function stopVideoTrack(video) {
    const a = videoTracks.get(video);
    if (a) { try { a.pause(); } catch (_e) {} videoTracks.delete(video); }
  }

  function onMediaPlay(e) {
    if (running && e.target.tagName === "VIDEO") startVideoTrack(e.target);
  }
  function onMediaStop(e) { stopVideoTrack(e.target); }

  function wireMedia(el) {
    if (!el || el.tagName !== "VIDEO" || wiredMedia.has(el)) return;
    wiredMedia.add(el);
    el.addEventListener("play", onMediaPlay);
    el.addEventListener("pause", onMediaStop);
    el.addEventListener("ended", onMediaStop);
    // If it's already playing when we arrive, start immediately.
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
    warm(musicURLs); warm(scatURLs); warm(fartURLs); warm(videoURLs);
    scanMedia();
    document.addEventListener("pointerdown", onPointerDown, true);
    // First gesture unlocks + starts the music loop.
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }

  function stop() {
    running = false;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    stopMusic();
    document.querySelectorAll("video").forEach((v) => {
      stopVideoTrack(v);
      v.removeEventListener("play", onMediaPlay);
      v.removeEventListener("pause", onMediaStop);
      v.removeEventListener("ended", onMediaStop);
    });
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    // Scat stems are driven by the swell loop — leave them alone here.
    for (const el of musicEls) if (scatStems.indexOf(el) === -1) el.volume = volume;
    document.querySelectorAll("video").forEach((vid) => {
      const a = videoTracks.get(vid);
      if (a) a.volume = volume;
    });
  }

  function setMute(m) {
    muted = !!m;
    if (muted) {
      stopMusic();
      document.querySelectorAll("video").forEach(stopVideoTrack);
    } else if (running && unlocked) {
      startMusic();
    }
  }

  function setLayerOverVideos(v) {
    layerOverVideos = !!v;
    if (!layerOverVideos) document.querySelectorAll("video").forEach(stopVideoTrack);
  }

  globalThis.ScaternetAudio = {
    start, stop, handleMedia, setVolume, setMute, setLayerOverVideos, playClick,
  };
})();
