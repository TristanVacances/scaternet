/*
 * SCATERNET — popup controller. Master ON/OFF + volume + mute + layer-over-videos.
 * Writes chrome.storage; content scripts and the service worker react on their own.
 */
(function () {
  "use strict";
  const State = globalThis.ScaternetState;
  const btn = document.getElementById("toggle");
  const volume = document.getElementById("volume");
  const mute = document.getElementById("mute");
  const video = document.getElementById("video");
  const muteRow = document.getElementById("muteRow");
  const videoRow = document.getElementById("videoRow");
  const volRow = document.getElementById("volRow");

  function render(st) {
    if (st.enabled) {
      btn.textContent = "Turn OFF";
      btn.className = "toggle on";
    } else {
      btn.textContent = "Turn ON — skat";
      btn.className = "toggle off";
    }
    volume.value = Math.round((typeof st.volume === "number" ? st.volume : 0.7) * 100);
    mute.checked = !!st.muteAudio;
    video.checked = st.layerOverVideos !== false;
    const off = !st.enabled;
    muteRow.classList.toggle("disabled", off);
    videoRow.classList.toggle("disabled", off);
    volRow.classList.toggle("disabled", off);
  }

  btn.addEventListener("click", async () => {
    const st = await State.get();
    await State.set({ enabled: !st.enabled });
    render(await State.get());
  });

  volume.addEventListener("input", async () => {
    await State.set({ volume: Math.max(0, Math.min(1, volume.value / 100)) });
  });

  mute.addEventListener("change", async () => {
    await State.set({ muteAudio: mute.checked });
  });

  video.addEventListener("change", async () => {
    await State.set({ layerOverVideos: video.checked });
  });

  State.get().then(render);
})();
