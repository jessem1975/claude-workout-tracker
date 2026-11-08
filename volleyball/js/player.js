// A small wrapper so the app can drive either a local video file or a
// YouTube video through the same interface.
const VideoPlayer = (() => {
  let ytReady = null;

  function loadYouTubeApi() {
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytReady = null; reject(new Error('Could not load YouTube — are you offline?')); };
      document.head.appendChild(s);
    });
    return ytReady;
  }

  function parseYouTubeId(url) {
    const m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
  }

  function fromFile(container, file) {
    container.innerHTML = '';
    const v = document.createElement('video');
    const src = URL.createObjectURL(file);
    v.src = src;
    v.controls = true;
    v.playsInline = true;
    v.preload = 'auto';
    container.appendChild(v);
    return {
      kind: 'file',
      time: () => v.currentTime,
      seek: (t) => { v.currentTime = Math.max(0, t); },
      play: () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); },
      pause: () => v.pause(),
      paused: () => v.paused,
      setRate: (r) => { v.playbackRate = r; },
      destroy: () => { v.pause(); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(src); container.innerHTML = ''; }
    };
  }

  async function fromYouTube(container, videoId) {
    const YT = await loadYouTubeApi();
    container.innerHTML = '<div></div>';
    return new Promise((resolve) => {
      const p = new YT.Player(container.firstChild, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => resolve(api) }
      });
      const api = {
        kind: 'youtube',
        time: () => p.getCurrentTime() || 0,
        seek: (t) => p.seekTo(Math.max(0, t), true),
        play: () => p.playVideo(),
        pause: () => p.pauseVideo(),
        paused: () => ![1, 3].includes(p.getPlayerState()),
        setRate: (r) => p.setPlaybackRate(r),
        destroy: () => { try { p.destroy(); } catch (e) {} container.innerHTML = ''; }
      };
    });
  }

  return { fromFile, fromYouTube, parseYouTubeId };
})();
