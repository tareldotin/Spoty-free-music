/* ==========================================================================
   app.js — bootstrap, routing, chrome wiring, gestures, PWA
   ========================================================================== */

import * as S from './store.js';
import * as P from './player.js';
import { db, open as openDB } from './db.js';
import * as UI from './ui.js';
import { t, setLang, applyI18n, getLang } from './i18n.js';
import { $, $$, el, icon, debounce, fmtTime, thumb } from './util.js';

const PL = P.Player;

/* --------------------------------------------------------------- boot */
/** Hide the splash and reveal the app. Always called, even if boot throws. */
function reveal() {
  const app = document.getElementById('app');
  const splash = document.getElementById('splash');
  if (app) app.hidden = false;
  if (!splash) return;
  requestAnimationFrame(() => {
    splash.classList.add('gone');
    setTimeout(() => { splash.hidden = true; }, 520);
  });
}

/** Show a visible error instead of a black screen. */
function fatal(err) {
  console.error('[SpotiFree] boot failed:', err);
  reveal();
  const view = document.getElementById('view');
  if (view) {
    view.innerHTML = '';
    const box = el('div.empty', {},
      el('h3', {}, 'Something went wrong starting SpotiFree'),
      el('p', { style: { fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-3)', wordBreak: 'break-word' } },
        String(err?.message || err)),
      el('button.btn.primary', { onclick: () => location.reload() }, 'Reload'));
    view.append(box);
  }
}

window.addEventListener('error', (e) => {
  if (document.getElementById('app')?.hidden) fatal(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (document.getElementById('app')?.hidden) fatal(e.reason);
});

(async function boot() {
  try {
    try { await openDB(); }
    catch (e) { console.warn('IndexedDB unavailable — running in memory-only mode', e); }

    try { await S.refresh(); }
    catch (e) { console.warn('library refresh failed', e); }

    UI.applyTheme();
    setLang(S.settings.lang || getLang());
    applyI18n();

    P.applySettings(S.settings);
    PL.autoplaySimilar = !!S.settings.autoplaySimilar;
    PL.volume = S.settings.volume ?? 80;

    await P.restore();
    P.initYouTube();

    UI.setNavigator(go);
    wireChrome();
    wirePlayer();

    const start = location.hash ? hashToRoute(location.hash) : { name: 'home' };
    await UI.render(start);

    registerSW();
    wireInstall();
    wireNetwork();
    wirePullToRefresh();

    window.addEventListener('hashchange', () => UI.render(hashToRoute(location.hash)));
  } catch (err) {
    fatal(err);
    return;
  }
  reveal();
})();

function hashToRoute(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  if (!h) return { name: 'home' };
  const [name, id] = h.split('/');
  if (['home', 'search', 'library', 'settings'].includes(name)) return { name };
  if (name === 'playlist' && id) return { name: 'playlist', id };
  if (name === 'auto' && id) return { name: 'auto', id };
  return { name: 'home' };
}
function routeToHash(r) {
  if (r.name === 'playlist' || r.name === 'auto') return `#/${r.name}/${r.id}`;
  return `#/${r.name}`;
}

function go(route) {
  $('#btnBack').hidden = !(route.name === 'playlist' || route.name === 'auto');
  if (location.hash !== routeToHash(route)) location.hash = routeToHash(route);
  else UI.render(route);
  $('#scroller').scrollTo({ top: 0 });
  if (window.innerWidth <= 1000) closeOverlays();
}
function closeOverlays() {
  $('#queuePanel').hidden = true;
  $('#fullPlayer').hidden = true;
  $('#scrim').hidden = true;
  $('#sheet').hidden = true;
}

/* ------------------------------------------------------------- chrome */
function wireChrome() {
  for (const b of $$('[data-nav]')) {
    b.addEventListener('click', () => go({ name: b.dataset.nav }));
  }
  $('#navImport').addEventListener('click', (e) => { e.stopPropagation(); UI.showImportModal(); });
  $('#btnNewPlaylist').addEventListener('click', async () => {
    const pl = await S.createPlaylist('My playlist');
    UI.toast(t('created'));
    UI.renderSidebar();
    go({ name: 'playlist', id: pl.id });
  });

  $('#btnBack').addEventListener('click', () => history.back());
  $('#scrim').addEventListener('click', () => {
    $('#sheet').hidden = true; $('#queuePanel').hidden = true; $('#scrim').hidden = true;
  });
  $('#sheetClose').addEventListener('click', () => UI.closeSheet());
  $('#qClose').addEventListener('click', () => { $('#queuePanel').hidden = true; $('#scrim').hidden = true; });

  // topbar shadow on scroll
  const scroller = $('#scroller');
  scroller.addEventListener('scroll', debounce(() => {
    $('#topbar').classList.toggle('solid', scroller.scrollTop > 8);
  }, 60), { passive: true });

  // remember clipboard-ish: paste a youtube link anywhere
  document.addEventListener('paste', (e) => {
    const txt = (e.clipboardData?.getData('text') || '').trim();
    if (/youtube\.com|youtu\.be/i.test(txt) && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
      UI.showImportModal(txt);
    }
  });
}

/* ------------------------------------------------------------- player */
let seeking = false;

function wirePlayer() {
  const mini = $('#mini');

  const togglePlay = () => P.toggle();
  $('#miniPlay').addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  $('#fpPlay').addEventListener('click', togglePlay);
  $('#miniNext').addEventListener('click', (e) => { e.stopPropagation(); P.next(); });
  $('#fpNext').addEventListener('click', () => P.next());
  $('#miniPrev').addEventListener('click', (e) => { e.stopPropagation(); P.previous(); });
  $('#fpPrev').addEventListener('click', () => P.previous());

  $('#miniArt').addEventListener('click', openFull);
  $('#miniMeta').addEventListener('click', openFull);
  $('#fpClose').addEventListener('click', closeFull);
  $('#fpMini').addEventListener('click', closeFull);

  $('#miniLike').addEventListener('click', (e) => { e.stopPropagation(); toggleLikeCurrent(); });
  $('#fpLike').addEventListener('click', () => toggleLikeCurrent());
  $('#fpDislike').addEventListener('click', async () => {
    if (!PL.current) return;
    await S.toggleDislike(PL.current.videoId);
    const on = S.state.disliked.has(PL.current.videoId);
    $('#fpDislike').classList.toggle('on', on);
    UI.toast(on ? 'Noted — will be skipped' : 'Undone');
    if (on) P.next();
  });

  $('#fpAdd').addEventListener('click', () => {
    if (PL.current) UI.addToPlaylistSheet([PL.current]);
  });

  $('#fpShuffle').addEventListener('click', () => {
    P.setShuffle(!PL.shuffle);
    UI.toast(PL.shuffle ? t('shuffleOn') : t('shuffleOff'));
  });
  $('#fpRepeat').addEventListener('click', () => {
    const order = ['off', 'all', 'one'];
    const nextMode = order[(order.indexOf(PL.repeat) + 1) % 3];
    P.setRepeat(nextMode);
    UI.toast(t(nextMode === 'off' ? 'repeatOff' : nextMode === 'all' ? 'repeatAll' : 'repeatOne'));
  });

  $('#fpQueue').addEventListener('click', () => {
    const q = $('#queuePanel');
    q.hidden = !q.hidden;
    $('#scrim').hidden = q.hidden;
    if (!q.hidden) UI.renderQueue();
  });

  $('#fpTimer').addEventListener('click', () => {
    const opts = [[15, t('min15')], [30, t('min30')], [45, t('min45')], [60, t('hour1')]];
    UI.openSheet(t('sleepTimer'), el('div', {},
      ...opts.map(([m, label]) => el('button.opt', {
        onclick: () => { UI.closeSheet(); P.setSleep(m * 60000); UI.toast(`Sleep timer: ${label}`); },
      }, icon('timer'), label)),
      el('button.opt', { onclick: () => { UI.closeSheet(); P.setSleep(0, 'song'); UI.toast('Sleep timer: ' + t('endOfSong')); } }, icon('disc'), t('endOfSong')),
      el('div.sep'),
      el('button.opt.opt-danger', { onclick: () => { UI.closeSheet(); P.clearSleep(); UI.toast('Sleep timer off'); } }, icon('x'), t('off'))));
  });

  /* volume */
  const vol = $('#fpVol');
  vol.value = PL.volume;
  updateVolFill();
  vol.addEventListener('input', () => { P.setVolume(Number(vol.value)); updateVolFill(); });
  $('#fpMute').addEventListener('click', () => { P.toggleMute(); updateVolFill(); });

  /* seek */
  const seek = $('#fpSeek');
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('change', () => {
    const d = P.duration() || 0;
    P.seek((Number(seek.value) / 1000) * d);
    seeking = false;
  });
  seek.addEventListener('input', () => {
    const d = P.duration() || 0;
    $('#fpCur').textContent = fmtTime((Number(seek.value) / 1000) * d);
  });

  /* swipe gestures on the artwork */
  wireSwipe($('#fpArtWrap'));

  /* keyboard */
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (typing) return;
    if (e.code === 'Space') { e.preventDefault(); P.toggle(); }
    else if (e.code === 'ArrowRight' && e.shiftKey) P.next();
    else if (e.code === 'ArrowLeft' && e.shiftKey) P.previous();
    else if (e.code === 'ArrowUp') { e.preventDefault(); P.setVolume(Math.min(100, PL.volume + 5)); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); P.setVolume(Math.max(0, PL.volume - 5)); }
    else if (e.code === 'Escape') closeOverlays();
  });

  /* ---- player events ---- */
  P.on('change', syncPlayerChrome);
  P.on('play', syncPlayerChrome);
  P.on('pause', syncPlayerChrome);
  P.on('queue', () => { if (!$('#queuePanel').hidden) UI.renderQueue(); });
  P.on('error', ({ msg }) => {
    UI.toast(msg || t('playbackError'), { type: 'err', ms: 3200 });
  });
  P.on('slept', () => UI.toast('Sleep timer ended — paused'));
  P.on('ytfail', () => {
    if (PL.current) UI.toast('YouTube player could not load — check your connection', { type: 'err', ms: 4000 });
  });

  let last = 0;
  P.on('time', ({ current, duration }) => {
    const d = duration || 0;
    if (!seeking) {
      const pct = d ? (current / d) * 1000 : 0;
      seek.value = String(Math.round(pct));
      if (Math.abs(current - last) > 0.4) { $('#fpCur').textContent = fmtTime(current); last = current; }
    }
    $('#fpDur').textContent = fmtTime(d);
    $('#miniBar').style.width = (d ? (current / d) * 100 : 0) + '%';
  });

  syncPlayerChrome();
}

function updateVolFill() {
  const v = PL.muted ? 0 : PL.volume;
  $('#fpVol').value = String(v);
  $('#fpVol').style.setProperty('--pct', v + '%');
  const btn = $('#fpMute');
  btn.innerHTML = '';
  btn.append(icon(v === 0 ? 'mute' : 'volume'));
}

async function toggleLikeCurrent() {
  if (!PL.current) return;
  const on = await S.toggleLike(PL.current.videoId);
  UI.syncPlayerLike();
  UI.toast(on ? 'Added to Liked songs' : 'Removed from Liked songs');
}

export function openFull() {
  if (!PL.current) return;
  $('#fullPlayer').hidden = false;
  document.body.style.overflow = 'hidden';
  syncPlayerChrome();
  if (!$('#queuePanel').hidden) UI.renderQueue();
}
export function closeFull() {
  $('#fullPlayer').hidden = true;
  $('#queuePanel').hidden = true;
  $('#scrim').hidden = true;
  document.body.style.overflow = '';
}

/* ------------------------------------------------- player chrome sync */
function syncPlayerChrome() {
  const s = PL.current;
  const mini = $('#mini');
  mini.hidden = !s;
  if (!s) { document.title = 'SpotiFree'; return; }

  const art = thumb(s.videoId, S.settings.dataSaver ? 'def' : 'hq');
  if ($('#miniImg').getAttribute('src') !== art) $('#miniImg').setAttribute('src', art);
  if ($('#fpArt').getAttribute('src') !== art) $('#fpArt').setAttribute('src', art);
  $('#fpBg').style.backgroundImage = `url("${art}")`;

  $('#miniTitle').textContent = s.title || '';
  $('#miniSub').textContent = s.channel || '';
  $('#fpSong').textContent = s.title || '';
  $('#fpChannel').textContent = s.channel || '';
  $('#fpTitle').textContent = PL.context || t('nowPlaying');
  $('#fpFrom').textContent = PL.context || t('nowPlaying');

  document.title = `${s.title} · ${s.channel || 'SpotiFree'}`;

  const playing = PL.playing;
  mini.classList.toggle('playing', playing);
  for (const [id, name] of [['#miniPlay', 'play'], ['#fpPlay', 'play']]) {
    const b = $(id);
    b.innerHTML = '';
    b.append(icon(playing ? 'pause' : 'play'));
  }

  $('#fpShuffle').classList.toggle('on', PL.shuffle);
  const rep = $('#fpRepeat');
  rep.classList.toggle('on', PL.repeat !== 'off');
  rep.innerHTML = '';
  rep.append(icon(PL.repeat === 'one' ? 'repeat1' : 'repeat'));

  const liked = S.state.liked.has(s.videoId);
  $('#miniLike').classList.toggle('liked', liked);
  $('#fpLike').classList.toggle('liked', liked);
  $('#miniLike').innerHTML = ''; $('#miniLike').append(icon(liked ? 'heart-fill' : 'heart'));
  $('#fpLike').innerHTML = ''; $('#fpLike').append(icon(liked ? 'heart-fill' : 'heart'));
  $('#fpDislike').classList.toggle('on', S.state.disliked.has(s.videoId));

  updateVolFill();
  UI.updatePlayingRows?.();

  if (S.settings.notifications && 'Notification' in window && Notification.permission === 'granted' && playing) {
    try {
      new Notification(s.title || 'Now playing', {
        body: s.channel || '', icon: art, tag: 'spotifree-now-playing', silent: true,
      });
    } catch {}
  }
}

/* ---------------------------------------------------------- gestures */
function wireSwipe(node) {
  if (!node) return;
  let x0 = null, y0 = null, t0 = 0;
  node.addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    const dt = Date.now() - t0;
    x0 = y0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 70 || dt > 700) return;
    if (dx < 0) P.next(); else P.previous();
    const art = $('#fpArt');
    art.classList.add('bump');
    setTimeout(() => art.classList.remove('bump'), 220);
  }, { passive: true });
}

/* -------------------------------------------------- pull to refresh */
function wirePullToRefresh() {
  const scroller = $('#scroller');
  const ptr = $('#ptr');
  let startY = 0, pulling = false;

  scroller.addEventListener('touchstart', (e) => {
    if (scroller.scrollTop <= 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && scroller.scrollTop <= 0) {
      const amt = Math.min(dy * 0.5, 70);
      ptr.style.transform = `translateY(${amt}px)`;
      $('#view').style.transform = `translateY(${amt}px)`;
      if (amt > 45) ptr.classList.add('spin');
    }
  }, { passive: true });

  scroller.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    const spun = ptr.classList.contains('spin');
    ptr.classList.remove('spin');
    ptr.style.transform = '';
    $('#view').style.transform = '';
    if (spun) {
      await S.refresh();
      UI.renderSidebar();
      await UI.render();
      UI.toast('Refreshed');
    }
  });
}

/* --------------------------------------------------------------- PWA */
let deferredPrompt = null;
function wireInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = el('button.icon-btn', { title: t('install'), onclick: promptInstall }, icon('install'));
    $('#tbActions').append(btn);
  });
  window.addEventListener('spotifree:install', promptInstall);
  window.addEventListener('appinstalled', () => { deferredPrompt = null; UI.toast('SpotiFree installed'); });
}
async function promptInstall() {
  if (!deferredPrompt) {
    return UI.toast(
      /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? 'Tap Share → “Add to Home Screen”'
        : 'Use your browser menu → “Install app” / “Add to Home Screen”',
      { ms: 4200 });
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') UI.toast('Installing…');
  deferredPrompt = null;
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return; // file:// has no SW
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          UI.toast('New version ready — reload to update', { ms: 5000 });
        }
      });
    });
  } catch (e) { console.warn('SW registration failed', e); }
}

/* ------------------------------------------------------------- network */
function wireNetwork() {
  const bar = el('div.offline-bar', {}, icon('offline'), t('offlineMsg'));
  bar.hidden = true;
  document.body.append(bar);

  const update = () => {
    S.state.online = navigator.onLine;
    bar.hidden = navigator.onLine;
    if (navigator.onLine) UI.toast(t('online'), { ms: 1800 });
  };
  window.addEventListener('offline', update);
  window.addEventListener('online', update);
  if (!navigator.onLine) bar.hidden = false;
}
