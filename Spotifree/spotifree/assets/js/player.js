/* ==========================================================================
   player.js — YouTube IFrame playback engine
   • Two hidden IFrame players so crossfade is possible (both can be volume-ramped)
   • Queue + shuffle order + repeat modes
   • Media Session (lock-screen / notification controls) + sleep timer
   ========================================================================== */

import { clamp, shuffleArr, debounce } from './util.js';
import { kvGet, kvSet, logPlay, db } from './db.js';

/* ------------------------------------------------------------ emitter */
const listeners = new Map();
function on(evt, fn) {
  (listeners.get(evt) || listeners.set(evt, new Set()).get(evt)).add(fn);
  return () => listeners.get(evt)?.delete(fn);
}
function emit(evt, payload) {
  for (const fn of listeners.get(evt) || []) {
    try { fn(payload); } catch (e) { console.error(e); }
  }
}
export { on, emit };

/* --------------------------------------------------------------- state */
export const Player = {
  queue: [],        // [{videoId,title,channel,thumbnail,duration}]
  order: [],        // indices into queue
  pos: -1,          // index into order
  shuffle: false,
  repeat: 'off',    // off | all | one
  volume: 80,
  muted: false,
  playing: false,
  loading: false,
  context: '',      // label shown in the full player ("Now playing from …")
  contextId: null,  // playlist id this queue came from (for Auto-play similar)
  crossfade: 0,     // seconds, 0 = off
  sleepMs: 0,
  sleepEndsAt: 0,
  sleepMode: null,  // 'timer' | 'song'
  autoplaySimilar: false,
  _similarLoading: false,
};

const YT_ERRORS = {
  2: 'Invalid video id',
  5: 'Playback error (HTML5)',
  100: 'Video not found or private',
  101: 'Owner disabled embedded playback',
  150: 'Owner disabled embedded playback',
};

/* --------------------------------------------------------- YT plumbing */
let ytReady = false;
const players = [null, null];
const ready = [false, false];
let active = 0;
let pending = null;           // videoId to start once a player exists
let fadeTimer = null;
let rafId = 0;
let lastTick = 0;
let sleepTimerId = 0;

export function initYouTube() {
  window.onYouTubeIframeAPIReady = () => boot();
  if (window.YT?.Player) boot();
  // the script tag is in index.html; if it failed to load (offline) we simply
  // stay unbooted and show a friendly message.
  setTimeout(() => { if (!ytReady) emit('ytfail'); }, 9000);
}

function boot() {
  if (ytReady) return;
  if (!window.YT?.Player) { window.onYouTubeIframeAPIReady = () => boot(); return; }
  ytReady = true;
  try {
    players[0] = new YT.Player('ytP0', {
      host: 'https://www.youtube-nocookie.com',
      playerVars: { playsinline: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, origin: location.origin },
      events: { onReady: () => onPlayerReady(0), onStateChange: (e) => onState(e, 0), onError: (e) => onError(e, 0) },
    });
  } catch (e) { ytReady = false; console.error('YT init failed', e); }
}

function ensureSecond() {
  if (players[1] || !ytReady || !window.YT?.Player) return;
  try {
    players[1] = new YT.Player('ytP1', {
      host: 'https://www.youtube-nocookie.com',
      playerVars: { playsinline: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, origin: location.origin },
      events: { onReady: () => onPlayerReady(1), onStateChange: (e) => onState(e, 1), onError: (e) => onError(e, 1) },
    });
  } catch {}
}

function onPlayerReady(i) {
  ready[i] = true;
  try { players[i].setVolume(Player.muted ? 0 : Player.volume); } catch {}
  if (i === 0 && pending) {
    const id = pending; pending = null;
    start(id);
  }
  emit('ready');
}

const P = () => players[active];
const isLive = () => ready[active] && players[active] && typeof players[active].getPlayerState === 'function';

/* --------------------------------------------------------- state events */
function onState(e, i) {
  if (i !== active) return;
  const s = e.data;
  if (s === YT.PlayerState.PLAYING) {
    Player.playing = true; Player.loading = false;
    startTicker();
    emit('play');
    updateMediaSession();
    logCurrent();
  } else if (s === YT.PlayerState.PAUSED) {
    Player.playing = false;
    stopTicker();
    emit('pause');
    updateMediaSession();
  } else if (s === YT.PlayerState.BUFFERING) {
    Player.loading = true; emit('buffering');
  } else if (s === YT.PlayerState.ENDED) {
    Player.playing = false;
    stopTicker();
    handleEnded();
  } else if (s === YT.PlayerState.CUED) {
    Player.loading = false; emit('cued');
  }
  emit('change');
}

function onError(e, i) {
  const msg = YT_ERRORS[e.data] || `Playback error ${e.data}`;
  emit('error', { code: e.data, msg });
  // auto-skip so a dead video doesn't stop the party
  setTimeout(() => { if (!Player.playing) next({ auto: true }); }, 1400);
}

function handleEnded() {
  if (Player.sleepMode === 'song') {
    clearSleep();
    emit('slept');
    return;
  }
  if (Player.repeat === 'one') { seek(0); play(); return; }
  next({ auto: true });
}

/* ------------------------------------------------------------- ticker */
function startTicker() {
  if (rafId) return;
  lastTick = 0;
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    if (!isLive()) return;
    const now = performance.now();
    if (now - lastTick < 250) return;
    lastTick = now;
    emit('time', { current: currentTime(), duration: duration() });
  };
  rafId = requestAnimationFrame(loop);
}
function stopTicker() { cancelAnimationFrame(rafId); rafId = 0; }

export const currentTime = () => { try { return isLive() ? P().getCurrentTime() || 0 : 0; } catch { return 0; } };
export const duration = () => {
  try {
    if (!isLive()) return Player.current?.duration || 0;
    const d = P().getDuration();
    return d && isFinite(d) ? d : (Player.current?.duration || 0);
  } catch { return Player.current?.duration || 0; }
};

/* --------------------------------------------------------- queue helpers */
export const currentSong = () => Player.queue[Player.order[Player.pos]] || null;
Player.current = null;

function rebuildOrder(startAt = 0) {
  const n = Player.queue.length;
  const idx = [...Array(n).keys()];
  if (Player.shuffle) {
    const head = idx[startAt];
    const rest = shuffleArr(idx.filter((i) => i !== head));
    Player.order = [head, ...rest];
    Player.pos = 0;
  } else {
    Player.order = idx;
    Player.pos = clamp(startAt, 0, Math.max(0, n - 1));
  }
}

const persist = debounce(() => {
  kvSet('queue', {
    queue: Player.queue.map((s) => ({ videoId: s.videoId, title: s.title, channel: s.channel, thumbnail: s.thumbnail, duration: s.duration })),
    order: Player.order, pos: Player.pos, shuffle: Player.shuffle,
    repeat: Player.repeat, context: Player.context, contextId: Player.contextId,
  });
}, 600);

export async function restore() {
  const saved = await kvGet('queue');
  if (!saved?.queue?.length) return false;
  Player.queue = saved.queue;
  Player.order = saved.order?.length === saved.queue.length ? saved.order : [...Array(saved.queue.length).keys()];
  Player.pos = clamp(saved.pos ?? 0, 0, Player.order.length - 1);
  Player.shuffle = !!saved.shuffle;
  Player.repeat = saved.repeat || 'off';
  Player.context = saved.context || '';
  Player.contextId = saved.contextId || null;
  Player.current = currentSong();
  emit('change'); emit('queue');
  return true;
}

/* ------------------------------------------------------------ controls */
export function setQueue(songs, startIndex = 0, { context = '', contextId = null, autoplay = true } = {}) {
  Player.queue = songs.filter(Boolean).slice();
  Player.context = context;
  Player.contextId = contextId;
  rebuildOrder(startIndex);
  Player.current = currentSong();
  emit('queue'); emit('change'); persist();
  if (autoplay) start(Player.current?.videoId);
  else if (ytReady) { try { P().cueVideoById(Player.current?.videoId); } catch {} emit('change'); }
}

export function playSong(song, { context = '', contextId = null } = {}) {
  if (!song) return;
  setQueue([song], 0, { context, contextId });
}

export function addToQueue(songs, { next = false } = {}) {
  const list = songs.filter(Boolean);
  if (!list.length) return;
  const had = Player.queue.length === 0;
  const at = Player.order[Player.pos] ?? 0;
  for (const s of list) {
    if (next) Player.queue.splice(at + 1, 0, s);
    else Player.queue.push(s);
  }
  rebuildOrder(had ? 0 : at);
  emit('queue'); persist();
  if (had) { Player.current = currentSong(); emit('change'); }
}

export function removeFromQueue(orderIndex) {
  const qi = Player.order[orderIndex];
  if (qi == null) return;
  const isCurrent = orderIndex === Player.pos;
  const curQi = Player.order[Player.pos];
  Player.queue.splice(qi, 1);
  if (!Player.queue.length) { clearAll(); return; }
  let newCur = curQi;
  if (qi < curQi) newCur = curQi - 1;
  else if (isCurrent) newCur = Math.min(curQi, Player.queue.length - 1);
  rebuildOrder(Math.max(0, newCur));
  emit('queue');
  if (isCurrent) { Player.current = currentSong(); start(Player.current.videoId); }
  emit('change'); persist();
}

export function clearQueue() {
  Player.queue = Player.queue.slice(0, Player.pos + 1);
  rebuildOrder(Player.pos);
  emit('queue'); emit('change'); persist();
}

function clearAll() {
  try { stop(); } catch {}
  Player.queue = []; Player.order = []; Player.pos = -1; Player.current = null;
  emit('queue'); emit('change'); persist();
}

export function start(videoId) {
  if (!videoId) return;
  Player.current = currentSong();
  if (!ytReady || !ready[active]) {
    pending = videoId;
    boot();
    emit('change');
    return;
  }
  Player.loading = true;
  emit('change');
  try {
    ensureSecond();
    P().loadVideoById(videoId);
    P().setVolume(Player.muted ? 0 : Player.volume);
    if (Player.muted) { try { P().mute(); } catch {} }
    P().playVideo();
  } catch (e) {
    Player.loading = false; emit('change');
    console.error(e);
  }
}

export function play() {
  if (!isLive()) { start(Player.current?.videoId); return; }
  try { if (Player.muted) P().unMute?.(); P().playVideo(); } catch {}
}
export function pause() { try { P().pauseVideo(); } catch {} }
export function stop() { try { P().stopVideo(); } catch {} Player.playing = false; }
export function toggle() { Player.playing ? pause() : play(); }
export function seek(sec) { try { P().seekTo(Math.max(0, sec), true); emit('time', { current: sec, duration: duration() }); } catch {} }

export function next({ auto = false } = {}) {
  const n = Player.order.length;
  if (!n) return;
  if (Player.pos < n - 1) {
    Player.pos++;
  } else if (Player.repeat === 'all' || (auto && Player.repeat === 'off' && Player.autoplaySimilar)) {
    if (Player.repeat === 'all' && !Player.autoplaySimilar) Player.pos = 0;
    else Player.pos = 0;
  } else {
    if (Player.repeat === 'all') Player.pos = 0;
    else { pause(); seek(0); Player.pos = n - 1; emit('change'); return; }
  }
  Player.current = currentSong();
  maybeFetchSimilar();
  if (Player.crossfade > 0) crossfadeTo(Player.current.videoId, Player.crossfade);
  else start(Player.current.videoId);
  emit('change'); persist();
}

export function previous() {
  if (currentTime() > 3.5) { seek(0); return; }
  if (Player.pos > 0) Player.pos--;
  else if (Player.repeat === 'all') Player.pos = Player.order.length - 1;
  else { seek(0); return; }
  Player.current = currentSong();
  start(Player.current.videoId);
  emit('change'); persist();
}

export function setShuffle(v) {
  Player.shuffle = v;
  rebuildOrder(Player.order[Player.pos] ?? 0);
  emit('change'); persist();
}
export function setRepeat(mode) { Player.repeat = mode; emit('change'); persist(); }

export function setVolume(v) {
  Player.volume = clamp(Math.round(v), 0, 100);
  Player.muted = Player.volume === 0;
  try {
    if (isLive()) {
      P().setVolume(Player.volume);
      Player.muted ? P().mute() : P().unMute();
    }
  } catch {}
  emit('volume'); emit('change');
}
export function toggleMute() {
  Player.muted = !Player.muted;
  try {
    if (isLive()) {
      Player.muted ? P().mute() : (P().unMute(), P().setVolume(Player.volume || 80));
    }
  } catch {}
  emit('volume'); emit('change');
}

/* ------------------------------------------------------------ crossfade */
function crossfadeTo(videoId, seconds) {
  const from = active, to = 1 - active;
  if (!ready[to]) { start(videoId); return; }
  clearInterval(fadeTimer);
  try {
    players[to].setVolume(0);
    players[to].loadVideoById(videoId);
    players[to].playVideo();
  } catch { start(videoId); return; }
  active = to;
  Player.current = currentSong();
  const steps = Math.max(6, Math.round(seconds * 8));
  const ms = (seconds * 1000) / steps;
  let i = 0;
  const target = Player.muted ? 0 : Player.volume;
  fadeTimer = setInterval(() => {
    i++;
    const r = clamp(i / steps, 0, 1);
    try {
      players[to].setVolume(Math.round(target * r));
      players[from].setVolume(Math.round(target * (1 - r)));
    } catch {}
    if (i >= steps) {
      clearInterval(fadeTimer); fadeTimer = null;
      try { players[from].pauseVideo(); } catch {}
      try { players[to].setVolume(target); } catch {}
      emit('crossfaded');
    }
  }, ms);
}

/* -------------------------------------------------- auto-play similar  */
function maybeFetchSimilar() {
  if (!Player.autoplaySimilar) return;
  const remaining = Player.order.length - Player.pos;
  if (remaining > 2 || Player._similarLoading || !Player.current) return;
  Player._similarLoading = true;
  import('./api.js').then(async ({ related }) => {
    try {
      const list = await related(Player.current.videoId, Player.current.title);
      const have = new Set(Player.queue.map((s) => s.videoId));
      const fresh = list.filter((s) => !have.has(s.videoId)).slice(0, 6);
      if (fresh.length) {
        Player.queue.push(...fresh);
        rebuildOrder(Player.shuffle ? Player.order[Player.pos] : Player.order[Player.pos]);
        emit('queue'); persist();
      }
    } catch {} finally { Player._similarLoading = false; }
  });
}

/* ---------------------------------------------------------- sleep timer */
export function setSleep(ms, mode = 'timer') {
  clearSleep();
  if (!ms && mode !== 'song') return;
  Player.sleepMode = mode;
  Player.sleepMs = ms;
  Player.sleepEndsAt = Date.now() + ms;
  if (mode === 'timer') {
    sleepTimerId = setTimeout(() => {
      pause();
      Player.sleepMode = null; Player.sleepMs = 0; Player.sleepEndsAt = 0;
      emit('slept'); emit('sleep');
    }, ms);
  }
  emit('sleep');
}
export function clearSleep() {
  clearTimeout(sleepTimerId); sleepTimerId = 0;
  Player.sleepMode = null; Player.sleepMs = 0; Player.sleepEndsAt = 0;
  emit('sleep');
}

/* ------------------------------------------------------- media session */
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const s = Player.current;
  if (!s) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.title || 'Unknown',
      artist: s.channel || '',
      album: Player.context || 'SpotiFree',
      artwork: [
        { src: (s.thumbnail || '').replace('mqdefault', 'maxresdefault'), sizes: '1280x720', type: 'image/jpeg' },
        { src: (s.thumbnail || '').replace('mqdefault', 'hqdefault'), sizes: '480x360', type: 'image/jpeg' },
      ].filter((a) => a.src),
    });
    navigator.mediaSession.playbackState = Player.playing ? 'playing' : 'paused';
  } catch {}
}

(function bindMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const acts = [
    ['play', () => play()], ['pause', () => pause()],
    ['previoustrack', () => previous()], ['nexttrack', () => next()],
    ['stop', () => pause()],
    ['seekto', (d) => d.seekTime != null && seek(d.seekTime)],
    ['seekbackward', () => seek(currentTime() - 10)],
    ['seekforward', () => seek(currentTime() + 10)],
  ];
  for (const [a, h] of acts) { try { navigator.mediaSession.setActionHandler(a, h); } catch {} }
})();

/* keep the lock-screen progress bar honest */
let lastPos = 0;
on('time', ({ current, duration: d }) => {
  const s = Player.current;
  if (!s) return;
  if (current - lastPos > 3) logCurrent();   // credit a play every few seconds
  lastPos = current;
  if ('mediaSession' in navigator && isFinite(d) && d > 0) {
    try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(current, d), playbackRate: 1 }); } catch {}
  }
});

let loggedFor = null;
function logCurrent() {
  const id = Player.current?.videoId;
  if (!id || loggedFor === id) return;
  loggedFor = id;
  logPlay(id);
  import('./db.js').then(({ putSong }) => putSong({ ...Player.current, lastPlayed: Date.now() }));
}
on('change', () => { if (Player.current?.videoId !== loggedFor) lastPos = 0; });

/* --------------------------------------------------------------- misc */
export const isReady = () => ytReady && ready[active];
export const canPlay = () => ytReady;
export function applySettings(s) {
  Player.volume = s.volume ?? 80;
  Player.crossfade = s.crossfade ? Number(s.crossfade) : 0;
  Player.autoplaySimilar = !!s.autoplaySimilar;
  try { if (isLive()) P().setVolume(Player.muted ? 0 : Player.volume); } catch {}
}

/** Ask the browser to keep the tab alive while audio plays (Android/Chrome). */
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
on('play', () => keepAwake(true));
on('pause', () => { if (Player.sleepMode) return; });

export default Player;
