/* ==========================================================================
   ui.js — every screen, component and interaction
   ========================================================================== */

import * as A from './api.js';
import * as S from './store.js';
import * as P from './player.js';
import { db, putSongs, getSongsOrdered } from './db.js';
import { t } from './i18n.js';
import {
  $, el, icon, ic, fmtTime, fmtAgo, fmtTotal, fmtCount, uid, debounce,
  detectInput, download, pickFile, sleep, thumb,
} from './util.js';

const PL = P.Player;

/* ------------------------------------------------------- navigation hook */
let navigate = () => {};
export const setNavigator = (fn) => { navigate = fn; };
export let route = { name: 'home' };

/* ============================ toasts ================================== */
let toastTimer = new Map();
export function toast(msg, { type = '', ms = 2600 } = {}) {
  const host = $('#toasts');
  const node = el('div.toast' + (type ? '.' + type : ''), { html: '' }, msg);
  host.append(node);
  const id = uid();
  toastTimer.set(id, setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 260);
    toastTimer.delete(id);
  }, ms));
  while (host.children.length > 3) host.firstChild.remove();
}

/* ============================ sheets ================================== */
export function openSheet(title, bodyNode, { wide = false } = {}) {
  const sheet = $('#sheet'), scrim = $('#scrim');
  $('#sheetTitle').textContent = title;
  const body = $('#sheetBody');
  body.innerHTML = '';
  body.append(bodyNode);
  sheet.style.width = wide ? 'min(560px,calc(100vw - 32px))' : '';
  sheet.hidden = false; scrim.hidden = false;
}
export function closeSheet() { $('#sheet').hidden = true; $('#scrim').hidden = true; }

export function confirmSheet(title, message, onYes, yesLabel = t('yes')) {
  const body = el('div', {},
    el('p', { style: { margin: '0 0 18px', color: 'var(--text-2)', lineHeight: '1.55', fontSize: '14px' } }, message),
    el('div', { style: { display: 'flex', gap: '10px' } },
      el('button.btn.ghost', { style: { flex: '1' }, onclick: closeSheet }, t('cancel')),
      el('button.btn.primary', { style: { flex: '1' }, onclick: () => { closeSheet(); onYes(); } }, yesLabel)));
  openSheet(title, body);
}

function promptSheet(title, label, value, onSave, placeholder = '') {
  const input = el('input.input', { value: value || '', placeholder });
  const body = el('div', {},
    el('div.field', {}, el('label', {}, label), input),
    el('div', { style: { display: 'flex', gap: '10px' } },
      el('button.btn.ghost', { style: { flex: '1' }, onclick: closeSheet }, t('cancel')),
      el('button.btn.primary', { style: { flex: '1' }, onclick: () => { const v = input.value.trim(); if (v) { closeSheet(); onSave(v); } } }, t('save'))));
  openSheet(title, body);
  setTimeout(() => input.focus(), 60);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') body.querySelector('.btn.primary').click(); });
}

/* ============================ helpers ================================= */
function img(src, alt = '', cls = '') {
  const n = el('img', { src, alt, loading: 'lazy', class: cls });
  n.addEventListener('error', () => { n.style.visibility = 'hidden'; n.parentElement?.classList.add('broken'); });
  return n;
}

const placeholderArt = (name = 'disc', cls = '') =>
  el('div.pl-ico' + (cls ? '.' + cls : ''), {}, icon(name));

export const songCount = (n) => (n === 1 ? t('songsOne') : t('songsCount', { n }));

function totalDuration(songs) {
  let secs = 0;
  for (const s of songs) secs += s.duration || 0;
  return secs;
}

/* ============================ song row ================================ */
export function songRow(song, opts = {}) {
  const { index, playlistId, queueIndex, showIndex = true, draggable = false, context = '', contextId = null, songs = [] } = opts;
  const liked = S.state.liked.has(song.videoId);
  const isCur = PL.current?.videoId === song.videoId;

  const idxCell = el('div.row-idx', {},
    el('span.num', {}, queueIndex != null ? String(queueIndex + 1) : (index != null ? String(index + 1) : '')),
    (() => { const s = icon('play'); s.style.width = '15px'; s.style.height = '15px'; return s; })());

  const main = el('div.row-main', {},
    img(thumb(song.videoId, S.settings.dataSaver ? 'def' : 'mq'), '', 'row-thumb'),
    el('div.row-text', {},
      el('div.row-title', { title: song.title }, song.title || '(untitled)'),
      el('div.row-sub', {}, [song.channel, song.views ? `${fmtCount(song.views)} views` : ''].filter(Boolean).join(' · '))));

  const likeBtn = el('button.row-like' + (liked ? '.on' : ''), {
    title: liked ? t('unlike') : t('like'),
    onclick: async (e) => {
      e.stopPropagation();
      const on = await S.toggleLike(song.videoId);
      likeBtn.classList.toggle('on', on);
      likeBtn.firstChild?.remove();
      likeBtn.prepend(icon(on ? 'heart-fill' : 'heart'));
      toast(on ? 'Added to Liked songs' : 'Removed from Liked songs');
      if (isCur) syncPlayerLike();
      markDirty();
    },
  }, icon(liked ? 'heart-fill' : 'heart'));

  const dur = el('div.row-dur', {}, song.duration ? fmtTime(song.duration) : '--:--');

  const more = el('button.row-more', {
    onclick: (e) => { e.stopPropagation(); songMenu(song, { playlistId, context, contextId, songs }); },
  }, icon('more'));

  const row = el('div.row' + (isCur ? '.playing' : ''), {
    dataset: { videoId: song.videoId },
    onclick: () => playFrom(songs, songs.indexOf(song) >= 0 ? songs.indexOf(song) : 0, context, contextId),
    oncontextmenu: (e) => { e.preventDefault(); songMenu(song, { playlistId, context, contextId, songs }); },
  }, showIndex ? idxCell : el('div'), main, likeBtn, dur, more);

  if (isCur) row.classList.add('playing');
  if (draggable) {
    row.draggable = true;
    row.dataset.videoId = song.videoId;
    row.addEventListener('dragstart', (e) => {
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ videoId: song.videoId, from: index }));
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('dragover'); });
    row.addEventListener('dragleave', () => row.classList.remove('dragover'));
    row.addEventListener('drop', async (e) => {
      e.preventDefault(); row.classList.remove('dragover');
      const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (payload.videoId === song.videoId || payload.from == null) return;
      await S.reorderPlaylist(playlistId, payload.from, index);
      render(route);
    });
  }
  return row;
}

/* ============================ cards =================================== */
export function card(item, { onOpen, round = false, sub = '', iconName = 'disc', artClass = '' } = {}) {
  const art = el('div.card-art' + (round ? '.round' : ''), {},
    item.thumbnail ? img(item.thumbnail, item.title) : placeholderArt(iconName, artClass),
    el('div.card-play', {}, icon('play')));
  if (item._liked) art.classList.add('liked');
  return el('div.card', { onclick: onOpen, title: item.title || item.name },
    art,
    el('div.card-title', {}, item.title || item.name || ''),
    el('div.card-sub', {}, sub));
}

export function quickPick(item, { onOpen, onPlay } = {}) {
  const art = item.thumbnail ? img(item.thumbnail) : placeholderArt(item.icon || 'disc', item.liked ? 'liked' : '');
  return el('div.qp-item', { onclick: onOpen },
    art,
    el('div.qp-name', {}, item.name || item.title || ''),
    el('div.qp-play', { onclick: (e) => { e.stopPropagation(); onPlay?.(); } }, icon('play')));
}

/* ============================ actions ================================= */
export async function playFrom(songs, index = 0, context = '', contextId = null) {
  if (!songs?.length) return;
  await putSongs(songs);
  P.setQueue(songs, index, { context, contextId });
  render(route);
}

function markDirty() { /* lightweight: sidebar + current view refresh on next render */ }

/** Cheap highlight update so we don't re-render a whole screen on every song change. */
export function updatePlayingRows() {
  const id = PL.current?.videoId;
  for (const row of document.querySelectorAll('.row')) {
    row.classList.toggle('playing', !!id && row.dataset.videoId === id);
  }
}

export function syncPlayerLike() {
  const s = PL.current;
  if (!s) return;
  const liked = S.state.liked.has(s.videoId);
  for (const [sel, name] of [['#miniLike', 'heart'], ['#fpLike', 'heart']]) {
    const b = $(sel);
    if (!b) continue;
    b.classList.toggle('liked', liked);
    b.innerHTML = '';
    b.append(icon(liked ? 'heart-fill' : 'heart'));
  }
}

/* ----------------------------------------------------------- song menu */
export function songMenu(song, { playlistId, context = '', contextId = null, songs = [] } = {}) {
  const liked = S.state.liked.has(song.videoId);
  const disliked = S.state.disliked.has(song.videoId);
  const items = [];

  items.push(el('button.opt', { onclick: () => { closeSheet(); P.addToQueue([song], { next: true }); toast(t('added')); } },
    icon('list-plus'), t('playNext')));
  items.push(el('button.opt', { onclick: () => { closeSheet(); P.addToQueue([song]); toast(t('added')); } },
    icon('plus'), t('queue')));

  items.push(el('div.sep'));
  items.push(el('button.opt', { onclick: () => { closeSheet(); addToPlaylistSheet([song]); } },
    icon('list-plus'), t('addToPlaylist')));

  items.push(el('button.opt' + (liked ? '.on' : ''), {
    onclick: async () => {
      const on = await S.toggleLike(song.videoId);
      closeSheet(); toast(on ? 'Added to Liked songs' : 'Removed');
      if (PL.current?.videoId === song.videoId) syncPlayerLike();
      render(route);
    },
  }, icon(liked ? 'heart-fill' : 'heart'), liked ? 'Remove from Liked songs' : 'Add to Liked songs'));

  items.push(el('button.opt' + (disliked ? '.on' : ''), {
    onclick: async () => {
      await S.toggleDislike(song.videoId);
      closeSheet(); toast(disliked ? 'Undone' : 'Noted — will be skipped');
      render(route);
    },
  }, icon('ban'), disliked ? 'Remove dislike' : 'Dislike'));

  if (playlistId && !S.AUTO[playlistId]) {
    items.push(el('div.sep'));
    items.push(el('button.opt', {
      onclick: async () => { await S.removeSongFromPlaylist(playlistId, song.videoId); closeSheet(); toast(t('removed')); render(route); },
    }, icon('trash'), t('removeFromPlaylist')));
  }

  items.push(el('div.sep'));
  items.push(el('button.opt', {
    onclick: async () => {
      try { await navigator.clipboard.writeText('https://youtu.be/' + song.videoId); toast('Link copied'); }
      catch { toast('https://youtu.be/' + song.videoId); }
      closeSheet();
    },
  }, icon('link'), 'Copy link'));
  items.push(el('button.opt', { onclick: () => { closeSheet(); window.open('https://www.youtube.com/watch?v=' + song.videoId, '_blank', 'noopener'); } },
    icon('disc'), 'Open on YouTube'));

  openSheet(song.title || 'Song', el('div', {},
    el('div', { style: { display: 'flex', gap: '12px', marginBottom: '12px' } },
      img(thumb(song.videoId, 'def'), '', ''),
      el('div', { style: { minWidth: '0' } },
        el('div', { style: { fontWeight: '700', fontSize: '14.5px' } }, song.title || ''),
        el('div', { style: { color: 'var(--text-2)', fontSize: '12.5px', marginTop: '2px' } }, song.channel || ''))),
    ...items));
}

/* -------------------------------------------------- add-to-playlist */
export function addToPlaylistSheet(songs) {
  const list = el('div', {});
  const build = () => {
    list.innerHTML = '';
    const mine = S.state.playlists.filter((p) => !S.AUTO[p.id]);
    if (!mine.length) list.append(el('p.hint', {}, 'No playlists yet — create one below.'));
    for (const p of mine) {
      list.append(el('button.opt', {
        onclick: async () => {
          const n = await S.addSongsToPlaylist(p.id, songs.map((s) => s.videoId));
          await putSongs(songs);
          closeSheet(); toast(`${t('added')} — ${n}`);
          renderSidebar(); render(route);
        },
      }, icon('library'), el('div', {}, el('div', {}, p.name), el('div.opt-sub', {}, songCount((p.songIds || []).length)))));
    }
    list.append(el('div.sep'));
    list.append(el('button.opt', {
      onclick: () => {
        promptSheet(t('newPlaylist'), t('name'), '', async (name) => {
          const pl = await S.createPlaylist(name, { songIds: songs.map((s) => s.videoId) });
          await putSongs(songs);
          toast(t('created'));
          renderSidebar(); render(route);
          return pl;
        });
      },
    }, icon('plus'), t('newPlaylist')));
  };
  build();
  openSheet(t('addToPlaylist'), list);
}

/* ============================ skeletons =============================== */
function skeletonGrid(n = 8) {
  const g = el('div.grid');
  for (let i = 0; i < n; i++) {
    g.append(el('div.card.sk-card', {},
      el('div.sk.sk-art'), el('div.sk.sk-line'), el('div.sk.sk-line.w60')));
  }
  return g;
}
function skeletonRows(n = 8) {
  const l = el('div');
  for (let i = 0; i < n; i++) {
    l.append(el('div.sk-row', {},
      el('div.sk.sk-thumb'),
      el('div', { style: { flex: '1' } }, el('div.sk.sk-line'), el('div.sk.sk-line.w60'))));
  }
  return l;
}

/* ============================ SIDEBAR ================================= */
export function renderSidebar() {
  const host = $('#sidePlaylists');
  host.innerHTML = '';

  const autoOrder = ['liked', 'recent', 'fresh', 'top'];
  for (const id of autoOrder) {
    const a = S.AUTO[id];
    const node = el('div.side-pl' + (route.id === id ? '.active' : ''), {
      onclick: () => navigate({ name: 'auto', id }),
    },
      el('div.pl-ico' + (id === 'liked' ? '.liked' : ''), {}, icon(a.icon)),
      el('span', {}, t({
        liked: 'likedSongs', recent: 'recentlyPlayed',
        fresh: 'recentlyAdded', top: 'mostPlayed',
      }[id])));
    host.append(node);
  }

  for (const p of S.state.playlists) {
    const cover = p.songIds?.[0];
    const song = cover ? S.state.allSongs.find((s) => s.videoId === cover) : null;
    host.append(el('div.side-pl' + (route.id === p.id ? '.active' : ''), {
      onclick: () => navigate({ name: 'playlist', id: p.id }),
    },
      song?.thumbnail ? img(thumb(song.videoId, 'def')) : el('div.pl-ico', {}, icon('library')),
      el('span', {}, p.name)));
  }
}

/* ============================ HOME ==================================== */
async function renderHome() {
  const view = $('#view');
  view.innerHTML = '';
  const h = new Date().getHours();
  const greet = h < 12 ? t('goodMorning') : h < 17 ? t('goodAfternoon') : t('goodEvening');

  view.append(el('h2', { style: { fontSize: '30px', fontWeight: '800', margin: '4px 0 18px', letterSpacing: '-.6px' } }, greet));
  view.append(importBanner());

  /* ---- quick picks ---- */
  const qp = el('div.qp');
  const picks = [
    { id: 'liked', name: t('likedSongs'), icon: 'heart-fill', liked: true },
    { id: 'recent', name: t('recentlyPlayed'), icon: 'clock' },
    { id: 'fresh', name: t('recentlyAdded'), icon: 'list-plus' },
    { id: 'top', name: t('mostPlayed'), icon: 'trending' },
    ...S.state.playlists.slice(0, 6).map((p) => ({ pl: p, name: p.name, id: p.id, icon: 'library' })),
  ];
  for (const p of picks) {
    const cover = p.pl?.songIds?.[0];
    const song = cover ? S.state.allSongs.find((s) => s.videoId === cover) : null;
    qp.append(quickPick(
      { ...p, liked: p.id === 'liked', thumbnail: song ? thumb(song.videoId, S.settings.dataSaver ? 'def' : 'mq') : null },
      {
        onOpen: () => navigate(p.pl ? { name: 'playlist', id: p.id } : { name: 'auto', id: p.id }),
        onPlay: async () => {
          const songs = p.pl ? await S.playlistSongs(p.id) : await S.resolveAuto(p.id, 60);
          if (!songs.length) return toast('Nothing to play yet');
          const ctx = p.pl ? p.name
            : t({ liked: 'likedSongs', recent: 'recentlyPlayed', fresh: 'recentlyAdded', top: 'mostPlayed' }[p.id] || 'library');
          await playFrom(songs, 0, ctx);
        },
      }));
  }
  view.append(el('div.section', {}, el('div.section-head', {}, el('h2', {}, t('jumpBackIn'))), qp));

  /* ---- trending (lazy) ---- */
  const trendSec = el('div.section', {},
    el('div.section-head', {}, el('h2', {}, t('trending'))),
    skeletonGrid(8));
  view.append(trendSec);
  loadTrending(trendSec);

  /* ---- user playlists ---- */
  if (S.state.playlists.length) {
    const grid = el('div.grid');
    for (const p of S.state.playlists) {
      const cover = p.songIds?.[0];
      const song = cover ? S.state.allSongs.find((s) => s.videoId === cover) : null;
      grid.append(card(
        { title: p.name, thumbnail: song ? thumb(song.videoId, S.settings.dataSaver ? 'def' : 'mq') : null },
        {
          onOpen: () => navigate({ name: 'playlist', id: p.id }),
          sub: songCount((p.songIds || []).length),
        }));
    }
    view.append(el('div.section', {},
      el('div.section-head', {}, el('h2', { onclick: () => navigate({ name: 'library' }) }, t('playlists'))), grid));
  }
}

async function loadTrending(sec) {
  const cached = await S.readMeta('trending:' + S.settings.region, 30 * 60 * 1000);
  const paint = (items) => {
    const grid = el('div.grid');
    for (const it of items.slice(0, 12)) {
      grid.append(card(it, {
        sub: [it.channel, it.views ? fmtCount(it.views) + ' views' : ''].filter(Boolean).join(' · '),
        onOpen: async () => { await playFrom([it], 0, t('trending')); },
      }));
    }
    sec.innerHTML = '';
    sec.append(el('div.section-head', {}, el('h2', {}, t('trending'))), grid);
  };
  if (cached?.length) return paint(cached);
  try {
    const { items } = await A.trending(S.settings.region, { quality: S.qualityFor() });
    if (!items?.length) throw new Error('empty');
    await S.cacheMeta('trending:' + S.settings.region, items);
    paint(items);
  } catch (e) {
    sec.innerHTML = '';
    sec.append(el('div.section-head', {}, el('h2', {}, t('trending'))),
      el('p.hint', {}, 'Trending needs an API key or a reachable CORS proxy. Add a key in Settings → Data source, or just paste a playlist link above.'));
  }
}

function importBanner() {
  return el('div.banner', {},
    icon('link'),
    el('div', {},
      el('b', {}, 'Got a YouTube link? '),
      'Paste a playlist, video or channel URL and SpotiFree will build a playlist from it — no login, nothing uploaded.',
      el('div', {}, el('button.btn.primary', { style: { marginTop: '10px' }, onclick: () => showImportModal() }, t('pasteLinks')))));
}

/* ============================ SEARCH ================================== */
let searchState = { query: '', filter: 'video', results: [], loading: false, pageToken: '' };
let searchBody = null;

async function renderSearch() {
  const view = $('#view');
  view.innerHTML = '';

  const input = el('input', { type: 'text', value: searchState.query, placeholder: t('searchYoutube') });
  const bar = el('div.searchbar', {}, icon('search'), input,
    searchState.query ? el('button.clear', { onclick: () => { searchState = { query: '', filter: 'video', results: [], loading: false, pageToken: '' }; renderSearch(); } }, icon('x')) : null);
  view.append(bar);

  const chips = el('div.chips');
  for (const [key, label] of [['video', t('songs')], ['playlist', t('playlists')], ['channel', 'Channels']]) {
    chips.append(el('button.chip' + (searchState.filter === key ? '.on' : ''), {
      onclick: () => { searchState.filter = key; searchState.results = []; renderSearch(); runSearch(searchState.query); },
    }, label));
  }
  view.append(chips);

  const body = el('div');
  view.append(body);
  searchBody = body;

  input.addEventListener('input', debounce((e) => {
    searchState.query = e.target.value.trim();
    if (searchState.query.length >= 2) runSearch(searchState.query);
    else renderSearchBody();
  }, 450));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(input.value.trim()); });
  setTimeout(() => input.focus(), 80);

  await renderSearchBody();
}

async function renderSearchBody(body = searchBody) {
  if (!body) return;
  body.innerHTML = '';
  if (!searchState.query) {
    const hist = await S.recentSearches(8);
    if (hist.length) {
      body.append(el('div.section-head', {},
        el('h2', { style: { fontSize: '16px' } }, t('searchHistory')),
        el('button.see-all', { onclick: async () => { await S.clearSearches(); renderSearchBody(body); } }, t('clearHistory'))));
      const wrap = el('div.chips');
      for (const q of hist) {
        wrap.append(el('button.chip', {
          onclick: () => { searchState.query = q; renderSearch(); runSearch(q); },
          oncontextmenu: async (e) => { e.preventDefault(); await S.removeSearch(q); renderSearchBody(body); },
        }, icon('clock'), q));
      }
      body.append(wrap);
    }
    body.append(el('div.empty', {}, icon('search'),
      el('h3', {}, t('typeToSearch')),
      el('p', {}, 'Powered by YouTube. With an API key you get richer results; without one we read public pages.')));
    return;
  }
  if (searchState.loading) { body.append(skeletonRows(8)); return; }
  if (!searchState.results.length) {
    body.append(el('div.empty', {}, icon('search'), el('h3', {}, t('noResults')),
      el('p', {}, 'Try different words, or add an API key in Settings → Data source.')));
    return;
  }

  if (searchState.filter === 'video') {
    const list = el('div.list');
    searchState.results.forEach((s, i) => list.append(songRow(s, { index: i, songs: searchState.results, context: searchState.query })));
    body.append(list);
    if (searchState.pageToken) {
      body.append(el('button.btn.ghost', { style: { marginTop: '16px' }, onclick: () => runSearch(searchState.query, true) }, 'Load more'));
    }
  } else {
    const grid = el('div.grid');
    for (const it of searchState.results) {
      grid.append(card(it, {
        round: searchState.filter === 'channel',
        sub: searchState.filter === 'playlist' ? `${it.count || ''} ${(it.count || 0) === 1 ? 'song' : 'songs'} · ${it.channel || ''}`
          : searchState.filter === 'channel' ? (it.subs || it.channel || '') : it.channel,
        onOpen: async () => {
          if (searchState.filter === 'playlist') {
            const pl = await importPlaylistToLibrary(it.id, it.title);
            if (pl) navigate({ name: 'playlist', id: pl.id });
          } else if (searchState.filter === 'channel') {
            await importChannel({ id: it.id }, it.title);
          } else {
            await playFrom([it], 0, searchState.query);
          }
        },
      }));
    }
    body.append(grid);
  }
}

async function runSearch(query, more = false) {
  if (!query) return;
  searchState.loading = true;
  if (!more) { searchState.results = []; searchState.pageToken = ''; }
  await renderSearchBody();
  try {
    await S.saveSearch(query);
    if (S.settings.dataSaver) { /* still fetch, but with low-res thumbs */ }
    const res = await A.search(query, {
      type: searchState.filter, quality: S.qualityFor(), pageToken: more ? searchState.pageToken : '',
    });
    searchState.results = more ? [...searchState.results, ...res.items] : res.items;
    searchState.pageToken = res.nextPageToken || '';
    // remember what we saw so offline browsing still shows something
    await putSongs(res.items.filter((i) => i.kind !== 'playlist' && i.kind !== 'channel'));
    searchState.loading = false;
  } catch (e) {
    searchState.loading = false;
    toast(e.message || t('networkError'), { type: 'err' });
  }
  await renderSearchBody();
}

/* ============================ LIBRARY ================================= */
const libState = { filter: 'all', sort: 'added', query: '' };
let libBody = null;

async function renderLibrary() {
  const view = $('#view');
  view.innerHTML = '';

  const chips = el('div.chips');
  for (const [k, label] of [['all', t('all')], ['playlist', t('playlists')], ['songs', t('songs')]]) {
    chips.append(el('button.chip' + (libState.filter === k ? '.on' : ''), { onclick: () => { libState.filter = k; renderLibrary(); } }, label));
  }
  chips.append(el('button.chip', { onclick: () => showImportModal() }, icon('link'), t('import')));
  chips.append(el('button.chip', { onclick: async () => { const n = await S.createPlaylist('My playlist'); toast(t('created')); renderSidebar(); navigate({ name: 'playlist', id: n.id }); } }, icon('plus'), t('newPlaylist')));
  view.append(chips);

  const q = el('input', { type: 'text', value: libState.query, placeholder: 'Search your library' });
  view.append(el('div.searchbar', {}, icon('search'), q,
    libState.query ? el('button.clear', { onclick: () => { libState.query = ''; renderLibrary(); } }, icon('x')) : null));
  q.addEventListener('input', debounce((e) => { libState.query = e.target.value.trim(); renderLibraryBody(); }, 250));

  const body = el('div');
  view.append(body);
  libBody = body;

  await renderLibraryBody();
}

async function renderLibraryBody(body = libBody) {
  if (!body) return;
  body.innerHTML = '';

  const needle = libState.query.toLowerCase();

  /* playlists + auto */
  if (libState.filter !== 'songs') {
    const grid = el('div.grid');
    for (const id of ['liked', 'recent', 'top', 'fresh']) {
      const a = S.AUTO[id];
      grid.append(card({ title: t({ liked: 'likedSongs', recent: 'recentlyPlayed', top: 'mostPlayed', fresh: 'recentlyAdded' }[id]), thumbnail: null }, {
        iconName: a.icon, artClass: id === 'liked' ? 'liked' : '',
        sub: id === 'liked' ? songCount(S.state.liked.size) : '',
        onOpen: () => navigate({ name: 'auto', id }),
      }));
    }
    for (const p of S.state.playlists.filter((p) => !needle || p.name.toLowerCase().includes(needle))) {
      const cover = p.songIds?.[0];
      const song = cover ? S.state.allSongs.find((s) => s.videoId === cover) : null;
      const node = card({ title: p.name, thumbnail: song ? thumb(song.videoId, S.settings.dataSaver ? 'def' : 'mq') : null }, {
        sub: songCount((p.songIds || []).length),
        onOpen: () => navigate({ name: 'playlist', id: p.id }),
      });
      node.addEventListener('dragover', (e) => { e.preventDefault(); node.style.outline = '2px solid var(--accent)'; });
      node.addEventListener('dragleave', () => { node.style.outline = ''; });
      node.addEventListener('drop', async (e) => {
        e.preventDefault(); node.style.outline = '';
        const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
        if (!payload.videoId) return;
        const n = await S.addSongsToPlaylist(p.id, [payload.videoId]);
        toast(`${t('added')} — ${n}`); renderSidebar(); renderLibrary();
      });
      grid.append(node);
    }
    body.append(el('div.section', {}, grid));
  }

  /* all songs */
  if (libState.filter !== 'playlist') {
    let songs = S.state.allSongs.slice();
    if (needle) songs = songs.filter((s) => (s.title || '').toLowerCase().includes(needle) || (s.channel || '').toLowerCase().includes(needle));
    const cmp = {
      az: (a, b) => (a.title || '').localeCompare(b.title || ''),
      za: (a, b) => (b.title || '').localeCompare(a.title || ''),
      dur: (a, b) => (b.duration || 0) - (a.duration || 0),
      added: (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
    }[libState.sort];
    songs.sort(cmp);

    if (!songs.length && !S.state.playlists.length) {
      body.append(el('div.empty', {}, icon('library'), el('h3', {}, t('emptyLibrary')),
        el('p', {}, t('emptyLibraryMsg')),
        el('button.btn.primary', { onclick: () => showImportModal() }, t('pasteLinks'))));
      return;
    }
    if (!songs.length) return;

    body.append(el('div.section-head', {},
      el('h2', { style: { fontSize: '18px' } }, t('songs')),
      el('select.input', {
        style: { width: 'auto', padding: '6px 10px', fontSize: '13px' },
        onchange: (e) => { libState.sort = e.target.value; renderLibrary(); },
      },
        el('option', { value: 'added', selected: libState.sort === 'added' }, t('dateAdded')),
        el('option', { value: 'az', selected: libState.sort === 'az' }, t('titleAZ')),
        el('option', { value: 'za', selected: libState.sort === 'za' }, t('titleZA')),
        el('option', { value: 'dur', selected: libState.sort === 'dur' }, t('duration')))));

    const list = el('div.list');
    songs.forEach((s, i) => list.append(songRow(s, { index: i, songs, context: t('library'), showIndex: false })));
    body.append(list);
  }
}

/* ============================ PLAYLIST / AUTO ========================= */
async function renderPlaylist(id, isAuto = false) {
  const view = $('#view');
  view.innerHTML = '';

  const songs = isAuto ? await S.resolveAuto(id, 200) : await S.playlistSongs(id);
  const meta = isAuto
    ? { name: t({ liked: 'likedSongs', recent: 'recentlyPlayed', top: 'mostPlayed', fresh: 'recentlyAdded' }[id]), kind: 'Auto playlist', icon: S.AUTO[id].icon, source: null }
    : { name: S.getPlaylist(id)?.name || 'Playlist', kind: 'Playlist', icon: 'library', source: S.getPlaylist(id)?.source, id };
  const cover = songs[0]?.thumbnail;
  const total = totalDuration(songs);

  const art = el('div.hero-art' + (id === 'liked' ? '.liked' : ''), {},
    cover ? img(cover, meta.name) : placeholderArt(meta.icon));

  const actions = el('div.hero-actions', {},
    el('button.play-btn', {
      onclick: async () => {
        if (!songs.length) return toast('Nothing to play');
        await playFrom(songs, 0, meta.name, isAuto ? null : id);
      },
    }, icon('play')),
    el('button.icon-btn.big', { title: t('shuffle'), onclick: async () => {
      if (!songs.length) return toast('Nothing to play');
      const sh = songs.slice().sort(() => Math.random() - 0.5);
      await playFrom(sh, 0, meta.name, isAuto ? null : id);
      P.setShuffle(true);
    } }, icon('shuffle')),
    meta.source ? el('button.icon-btn', { title: 'Refresh from YouTube', onclick: () => refreshPlaylist(id) }, icon('refresh')) : null,
    !isAuto ? el('button.icon-btn', { title: 'More', onclick: () => playlistMenu(id) }, icon('more')) : null);

  view.append(el('div.hero', {}, art,
    el('div.hero-meta', {},
      el('div.hero-kind', {}, meta.kind),
      el('h1.hero-name', {}, meta.name),
      el('div.hero-sub', {},
        el('b', {}, S.state.playlists.find((p) => p.id === id)?.channel || ''),
        el('span', {}, songCount(songs.length)),
        el('span.dot'),
        el('span', {}, total ? fmtTotal(total) : '')),
      actions)));

  if (!songs.length) {
    view.append(el('div.empty', {}, icon('disc'),
      el('h3', {}, id === 'liked' ? t('emptyLiked') : 'No songs here'),
      el('p', {}, id === 'liked' ? t('emptyLikedMsg') : 'Paste a YouTube link to fill this playlist.'),
      el('button.btn.primary', { onclick: () => showImportModal(null, isAuto ? null : id) }, t('pasteLinks'))));
    return;
  }

  const hd = el('div.row-hd', {}, el('div', {}, '#'), el('div', {}, 'Title'), el('div.h-dur', {}, t('duration')), el('div.h-more'));
  const list = el('div.list');
  songs.forEach((s, i) => list.append(songRow(s, {
    index: i, songs, context: meta.name, contextId: isAuto ? null : id,
    playlistId: isAuto ? null : id, draggable: !isAuto,
  })));
  view.append(hd, list);
}

async function refreshPlaylist(id) {
  const p = S.getPlaylist(id);
  if (!p?.source) return;
  const src = p.source;
  toast('Refreshing…');
  try {
    let songs = [];
    if (src.type === 'playlist') songs = await A.getPlaylistItems(src.id, { quality: S.qualityFor() });
    else if (src.type === 'channel') songs = (await A.getChannelUploads(src, { quality: S.qualityFor() })).songs;
    if (!songs.length) return toast('No songs returned', { type: 'err' });
    await putSongs(songs);
    const before = p.songIds.length;
    p.songIds = [...new Set(songs.map((s) => s.videoId))];
    p.updatedAt = Date.now();
    await db.playlists.put(p);
    await S.refresh();
    toast(`Updated — ${p.songIds.length - before >= 0 ? '+' : ''}${p.songIds.length - before} songs`);
    render(route);
  } catch (e) { toast(e.message || t('networkError'), { type: 'err' }); }
}

function playlistMenu(id) {
  const p = S.getPlaylist(id);
  if (!p) return;
  openSheet(p.name, el('div', {},
    el('button.opt', { onclick: () => { closeSheet(); promptSheet(t('rename'), t('name'), p.name, async (v) => { await S.renamePlaylist(id, v); toast(t('renamed')); renderSidebar(); render(route); }); } }, icon('pencil'), t('rename')),
    el('button.opt', { onclick: () => { closeSheet(); promptSheet(t('duplicate'), t('name'), p.name + ' (copy)', async (v) => { await S.duplicatePlaylist(id, v); toast(t('copied')); renderSidebar(); render(route); }); } }, icon('copy'), t('duplicate')),
    el('button.opt', {
      onclick: () => {
        closeSheet();
        const others = S.state.playlists.filter((x) => x.id !== id);
        const body = el('div', {});
        if (!others.length) body.append(el('p.hint', {}, 'Create another playlist first.'));
        for (const o of others) {
          body.append(el('button.opt', { onclick: async () => { await S.mergePlaylists(id, o.id); closeSheet(); toast(t('merged')); renderSidebar(); render(route); } }, icon('merge'), o.name));
        }
        openSheet(t('mergeInto'), body);
      },
    }, icon('merge'), t('merge')),
    el('div.sep'),
    el('button.opt', { onclick: async () => { await S.movePlaylist(id, -1); closeSheet(); renderSidebar(); render(route); } }, icon('chev-down'), 'Move up'),
    el('button.opt', { onclick: async () => { await S.movePlaylist(id, 1); closeSheet(); renderSidebar(); render(route); } }, icon('chev-down'), 'Move down'),
    el('div.sep'),
    el('button.opt.opt-danger', {
      onclick: () => { closeSheet(); confirmSheet(t('delete'), `Delete “${p.name}”? The songs stay in your library.`, async () => { await S.deletePlaylist(id); toast(t('deleted')); renderSidebar(); navigate({ name: 'library' }); }); },
    }, icon('trash'), t('delete'))));
}

/* ============================ IMPORT ================================== */
export function showImportModal(prefill = '', targetPlaylistId = null) {
  const ta = el('textarea.input', { placeholder: 'https://www.youtube.com/playlist?list=PL…\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@channel', rows: 5 });
  if (prefill) ta.value = prefill;
  const prog = el('div.progress', { hidden: true }, el('i'));
  const ptext = el('div.progress-txt', { hidden: true });
  const btn = el('button.btn.primary.block', {}, t('importBtn'));

  const body = el('div', {},
    el('div.field', {},
      el('label', {}, t('pasteLinks')),
      ta,
      el('div.hint', {}, t('pasteHint'))),
    prog, ptext,
    el('div', { style: { display: 'flex', gap: '10px' } },
      el('button.btn.ghost', { style: { flex: '1' }, onclick: closeSheet }, t('cancel')),
      (() => { btn.style.flex = '1'; return btn; })()));

  btn.onclick = () => doImport(ta.value, { targetPlaylistId, prog, ptext, btn });

  const dz = el('div.dropzone', {}, '…or drop a link here');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('over');
    const txt = e.dataTransfer.getData('text/plain') || '';
    if (/youtube|youtu\.be/i.test(txt)) { ta.value = (ta.value ? ta.value + '\n' : '') + txt.trim(); }
  });
  body.append(dz);

  openSheet(t('import'), body, { wide: true });
  setTimeout(() => ta.focus(), 60);
}

async function doImport(rawText, { targetPlaylistId, prog, ptext, btn } = {}) {
  const lines = String(rawText || '').split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return toast(t('badLink'), { type: 'err' });

  btn.disabled = true;
  prog.hidden = false; ptext.hidden = false;
  const setProg = (p, msg) => { prog.firstChild.style.width = Math.round(p * 100) + '%'; ptext.textContent = msg || ''; };

  let addedTotal = 0;
  let lastPlaylistId = targetPlaylistId;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const d = detectInput(line);
    setProg(i / lines.length, `Reading ${i + 1} of ${lines.length}…`);
    try {
      if (d.kind === 'playlist' || (d.kind === 'video' && d.playlistId)) {
        const pid = d.kind === 'playlist' ? d.id : d.playlistId;
        const meta = await A.getPlaylistMeta(pid).catch(() => ({ id: pid, title: 'Imported playlist' }));
        const songs = await A.getPlaylistItems(pid, {
          quality: S.qualityFor(),
          onProgress: (n, total) => setProg((i + Math.min(1, n / (total || n || 1))) / lines.length, `${meta.title || 'Playlist'} — ${n} songs`),
        });
        if (!songs.length) continue;
        await putSongs(songs);
        const pl = lastPlaylistId && i === 0 && targetPlaylistId
          ? (await S.addSongsToPlaylist(targetPlaylistId, songs.map((s) => s.videoId)), S.getPlaylist(targetPlaylistId))
          : await S.createPlaylist(meta.title || 'Imported playlist', {
              songIds: songs.map((s) => s.videoId),
              source: { type: 'playlist', id: pid, url: line },
            });
        lastPlaylistId = pl.id;
        addedTotal += songs.length;
      } else if (d.kind === 'video') {
        const song = await A.getVideo(d.id, { quality: S.qualityFor() });
        await putSongs([song]);
        if (lastPlaylistId) await S.addSongsToPlaylist(lastPlaylistId, [song.videoId]);
        else {
          const pl = await S.createPlaylist('Imported songs', { songIds: [song.videoId], source: { type: 'video', id: d.id, url: line } });
          lastPlaylistId = pl.id;
        }
        addedTotal++;
      } else if (d.kind === 'channel') {
        const { name, songs } = await A.getChannelUploads(d, { quality: S.qualityFor(), limit: 60 });
        if (!songs.length) continue;
        await putSongs(songs);
        const pl = await S.createPlaylist(name || 'Channel uploads', {
          songIds: songs.map((s) => s.videoId), source: { type: 'channel', ...d, url: line }, type: 'imported',
        });
        lastPlaylistId = pl.id;
        addedTotal += songs.length;
      } else {
        toast(`${t('badLink')}: ${line.slice(0, 40)}`, { type: 'err' });
      }
    } catch (e) {
      toast(e.message || t('networkError'), { type: 'err', ms: 3600 });
    }
  }

  setProg(1, 'Done');
  await S.refresh();
  renderSidebar();
  btn.disabled = false;
  if (addedTotal) {
    toast(`${t('importDone')} — ${addedTotal} songs`);
    closeSheet();
    if (lastPlaylistId) navigate({ name: 'playlist', id: lastPlaylistId });
    else render(route);
  } else {
    ptext.textContent = 'Nothing was imported. Add an API key in Settings → Data source if this keeps happening.';
  }
}

async function importPlaylistToLibrary(id, name) {
  toast('Fetching playlist…');
  try {
    const meta = await A.getPlaylistMeta(id).catch(() => ({ title: name, id }));
    const songs = await A.getPlaylistItems(id, { quality: S.qualityFor() });
    await putSongs(songs);
    const pl = await S.createPlaylist(meta.title || name || 'Playlist', { songIds: songs.map((s) => s.videoId), source: { type: 'playlist', id }, type: 'imported' });
    toast(t('importDone'));
    renderSidebar();
    return pl;
  } catch (e) { toast(e.message || t('networkError'), { type: 'err' }); return null; }
}

async function importChannel(input, name) {
  toast('Fetching channel…');
  try {
    const { name: n, songs } = await A.getChannelUploads(input, { quality: S.qualityFor(), limit: 60 });
    if (!songs.length) return toast('No videos found', { type: 'err' });
    await putSongs(songs);
    const pl = await S.createPlaylist(n || name || 'Channel', { songIds: songs.map((s) => s.videoId), source: { type: 'channel', ...input }, type: 'imported' });
    toast(t('importDone'));
    renderSidebar();
    navigate({ name: 'playlist', id: pl.id });
  } catch (e) { toast(e.message || t('networkError'), { type: 'err' }); }
}

/* ============================ SETTINGS ================================ */
async function renderSettings() {
  const view = $('#view');
  view.innerHTML = '';
  const set = S.settings;

  const row = (label, desc, control) =>
    el('div.set', {}, el('div.set-txt', {}, el('div.set-label', {}, label), desc ? el('div.set-desc', {}, desc) : null), el('div.set-ctl', {}, control));

  const sw = (key, onChange) => {
    const b = el('button.switch' + (set[key] ? '.on' : ''), {
      onclick: () => {
        const v = !S.settings[key];
        S.setSetting(key, v);
        b.classList.toggle('on', v);
        onChange?.(v);
      },
    });
    return b;
  };

  /* ---- appearance ---- */
  view.append(el('div.section', {},
    el('div.section-head', {}, el('h2', { style: { fontSize: '20px' } }, t('appearance'))),

    row(t('theme'), '', el('div', { style: { display: 'flex', gap: '8px' } },
      el('button.btn' + (set.theme === 'dark' ? '.primary' : '.ghost'), {
        onclick: () => { S.setSetting('theme', 'dark'); applyTheme(); renderSettings(); },
      }, icon('moon'), t('dark')),
      el('button.btn' + (set.theme === 'light' ? '.primary' : '.ghost'), {
        onclick: () => { S.setSetting('theme', 'light'); applyTheme(); renderSettings(); },
      }, icon('sun'), t('light')))),

    row(t('accentColor'), '', el('div.swatches', {},
      ...['green', 'blue', 'purple', 'pink', 'red', 'orange'].map((c) =>
        el('button.swatch' + (set.accent === c ? '.on' : ''), {
          style: { background: `var(--accent-${c})` },
          dataset: { accent: c },
          onclick: () => { S.setSetting('accent', c); applyTheme(); renderSettings(); },
        })))),

    row(t('language'), '', el('div.languages', {},
      ...[{ c: 'en', n: 'English' }, { c: 'ml', n: 'മലയാളം' }, { c: 'hi', n: 'हिन्दी' }, { c: 'ta', n: 'தமிழ்' }].map((l) =>
        el('button.lang-btn' + (set.lang === l.c ? '.on' : ''), {
          onclick: async () => {
            const { setLang, applyI18n } = await import('./i18n.js');
            S.setSetting('lang', l.c); setLang(l.c); applyI18n();
            renderSidebar(); renderSettings(); syncChrome();
          },
        }, l.n))))));

  /* ---- playback ---- */
  const eqSel = el('select.input', { style: { width: 'auto', padding: '7px 10px', fontSize: '13px' } },
    ...[['flat', 'Flat'], ['bass', 'Bass boost'], ['treble', 'Treble'], ['pop', 'Pop'], ['rock', 'Rock'], ['classical', 'Classical'], ['podcast', 'Podcast / voice']]
      .map(([v, l]) => el('option', { value: v, selected: set.eq === v }, l)));
  eqSel.addEventListener('change', () => { S.setSetting('eq', eqSel.value); toast('Preset saved — ' + eqSel.value); });

  view.append(el('div.section', {},
    el('div.section-head', {}, el('h2', { style: { fontSize: '20px' } }, t('playback'))),

    row(t('crossfade'), 'Blend the end of one song into the next',
      el('select.input', {
        style: { width: 'auto', padding: '7px 10px', fontSize: '13px' },
        onchange: (e) => { S.setSetting('crossfade', Number(e.target.value)); P.applySettings(S.settings); },
      },
        ...[[0, t('off')], [3, '3s'], [5, '5s'], [8, '8s'], [12, '12s']].map(([v, l]) =>
          el('option', { value: v, selected: Number(set.crossfade) === v }, l)))),

    row(t('autoplaySimilar'), 'Keep the music going with related songs',
      sw('autoplaySimilar', (v) => { PL.autoplaySimilar = v; })),

    row(t('sleepTimer'), PL.sleepMode ? `${Math.max(0, Math.round((PL.sleepEndsAt - Date.now()) / 60000))} min left` : t('off'),
      el('button.btn.ghost', { onclick: () => sleepTimerSheet() }, icon('timer'), 'Set')),

    row(t('equalizer'), 'Applies to audio the browser can process', eqSel),

    row(t('notifications'), 'Now-playing notification where supported',
      sw('notifications', async (v) => {
        if (v && 'Notification' in window) {
          const r = await Notification.requestPermission().catch(() => 'denied');
          if (r !== 'granted') { S.setSetting('notifications', false); renderSettings(); }
        }
      }))));

  /* ---- data ---- */
  const usage = el('span', { style: { color: 'var(--text-2)', fontSize: '13px' } }, '…');
  (async () => {
    const { estimateSize } = await import('./db.js');
    const bytes = await estimateSize();
    usage.textContent = (bytes / 1048576).toFixed(2) + ' MB';
  })();

  view.append(el('div.section', {},
    el('div.section-head', {}, el('h2', { style: { fontSize: '20px' } }, t('data'))),

    row(t('dataSaver'), 'Low-resolution artwork, fewer requests',
      sw('dataSaver', () => render(route))),

    row(t('storageUsed'), t('offlineMsg'), usage),

    row(t('exportData'), 'A JSON file with every playlist and like',
      el('button.btn.ghost', {
        onclick: async () => {
          const { exportAll } = await import('./db.js');
          const data = await exportAll();
          download(`spotifree-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
          toast(t('exported'));
        },
      }, icon('download'), t('exportData'))),

    row(t('importData'), 'Restore from a backup file',
      el('button.btn.ghost', {
        onclick: async () => {
          const file = await pickFile('application/json,.json');
          if (!file) return;
          try {
            const { importAll } = await import('./db.js');
            const data = JSON.parse(await file.text());
            await importAll(data, { merge: true });
            await S.refresh(); renderSidebar(); renderSettings();
            toast(t('imported'));
          } catch (e) { toast('Could not read that file', { type: 'err' }); }
        },
      }, icon('upload'), t('importData'))),

    row(t('clearCache'), 'Frees space — keeps your playlists',
      el('button.btn.ghost', {
        onclick: async () => {
          if (!('caches' in window)) return toast(t('cleared'));
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith('spotifree-')).map((k) => caches.delete(k)));
          localStorage.removeItem('spotifree.proxy.ok');
          toast(t('cleared'));
        },
      }, icon('broom'), t('clearCache')))));

  /* ---- data source ---- */
  const keyInput = el('input.input', { type: 'password', value: A.getKey(), placeholder: 'AIza…' });
  const keyStatus = el('div.hint', {}, A.hasKey() ? 'Using the YouTube Data API.' : 'No key set — using public pages via CORS proxy.');
  const testBtn = el('button.btn.ghost', {
    onclick: async () => {
      const v = keyInput.value.trim();
      A.setKey(v);
      testBtn.disabled = true; testBtn.textContent = '…';
      const res = v ? await A.testKey(v) : await A.testProxy();
      testBtn.disabled = false; testBtn.textContent = t('test');
      if (res.ok) { keyStatus.textContent = `✓ ${t('working')} (${res.ms || '?'} ms)`; keyStatus.style.color = 'var(--accent)'; }
      else { keyStatus.textContent = `✕ ${t('failed')}: ${res.error || 'unknown'}`; keyStatus.style.color = '#ff6b6b'; }
    },
  }, icon('sparkles'), t('test'));

  view.append(el('div.section', {},
    el('div.section-head', {}, el('h2', { style: { fontSize: '20px' } }, t('dataSource'))),
    el('div.field', {},
      el('label', {}, t('apiKeyTitle')),
      keyInput,
      el('div.hint', {},
        t('apiKeyDesc'), ' ',
        el('a', { href: 'https://console.cloud.google.com/apis/credentials', target: '_blank', rel: 'noopener' }, 'Get a free key'),
        ' → enable “YouTube Data API v3”. 10,000 units/day are free.')),
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
      el('button.btn.primary', { onclick: () => { A.setKey(keyInput.value.trim()); toast('Key saved'); render(route); } }, t('save')),
      testBtn),
    el('div', { style: { marginTop: '10px' } }, keyStatus),

    el('div.field', { style: { marginTop: '18px' } },
      el('label', {}, 'Custom CORS proxy (optional)'),
      el('input.input', {
        value: localStorage.getItem('spotifree.proxy') || '',
        placeholder: 'https://your-proxy.example/?url={url}',
        oninput: (e) => { const v = e.target.value.trim(); v ? localStorage.setItem('spotifree.proxy', v) : localStorage.removeItem('spotifree.proxy'); },
      }),
      el('div.hint', {}, 'Used only when no API key is set. Must include {url}.')),

    row('Region', 'Used for the Trending section',
      el('input.input', {
        value: set.region || 'IN', maxlength: 2, style: { width: '80px', textTransform: 'uppercase' },
        onchange: (e) => { S.setSetting('region', e.target.value.toUpperCase().slice(0, 2)); render(route); },
      }))));

  /* ---- about ---- */
  view.append(el('div.section', {},
    el('div.section-head', {}, el('h2', { style: { fontSize: '20px' } }, t('about'))),
    row(t('version'), 'SpotiFree 1.0 — 100% free, no accounts, no servers, no ads.',
      el('span', { style: { color: 'var(--text-2)', fontSize: '13px' } }, '1.0.0')),
    row(t('install'), 'Add to your home screen for the full app feel',
      el('button.btn.ghost', { onclick: () => window.dispatchEvent(new Event('spotifree:install')) }, icon('install'), t('install'))),
    el('div.set', {},
      el('div.set-txt', {}, el('div.set-label', {}, t('wipe')), el('div.set-desc', {}, 'Erase everything stored on this device')),
      el('div.set-ctl', {},
        el('button.btn.danger', {
          onclick: () => confirmSheet(t('wipe'), t('wipeConfirm'), async () => {
            const { wipeAll } = await import('./db.js');
            await wipeAll();
            await S.refresh(); renderSidebar(); navigate({ name: 'home' });
            toast(t('cleared'));
          }, t('wipe')),
        }, icon('trash'), t('wipe'))))));
}

function sleepTimerSheet() {
  const opts = [
    [15 * 60000, t('min15')], [30 * 60000, t('min30')], [45 * 60000, t('min45')],
    [60 * 60000, t('hour1')], ['song', t('endOfSong')],
  ];
  const body = el('div', {},
    ...opts.map(([v, l]) => el('button.opt', {
      onclick: () => {
        closeSheet();
        if (v === 'song') { P.setSleep(0, 'song'); toast('Sleep timer: ' + t('endOfSong')); }
        else { P.setSleep(v); toast(`Sleep timer: ${l}`); }
      },
    }, icon('timer'), l)),
    el('div.sep'),
    el('button.opt.opt-danger', { onclick: () => { closeSheet(); P.clearSleep(); toast('Sleep timer off'); } },
      icon('x'), t('off')));
  openSheet(t('sleepTimer'), body);
}

export function applyTheme() {
  const s = S.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.accent = s.accent;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', s.theme === 'dark' ? '#0a0a0a' : '#ffffff');
}

/* ============================ QUEUE PANEL ============================= */
export function renderQueue() {
  const body = $('#qBody');
  body.innerHTML = '';
  const rest = PL.order.slice(PL.pos + 1).map((i) => PL.queue[i]).filter(Boolean);
  $('#qSub').textContent = rest.length ? `${rest.length} ${t('upNext').toLowerCase()}` : t('emptyQueue');

  body.append(el('div', { style: { marginBottom: '14px' } },
    el('div', { style: { fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px', fontWeight: '700' } }, t('nowPlaying')),
    PL.current ? songRow(PL.current, { showIndex: false, songs: [PL.current], context: PL.context }) : el('p.hint', {}, '—')));

  if (!rest.length) {
    body.append(el('p.hint', {}, t('emptyQueue')));
    return;
  }
  body.append(el('div', { style: { fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '14px 0 8px', fontWeight: '700' } }, t('upNext')));
  const list = el('div.list');
  rest.forEach((s, i) => {
    const row = songRow(s, { index: i, songs: rest, showIndex: false, context: PL.context });
    const remove = el('button.row-more', { onclick: (e) => { e.stopPropagation(); P.removeFromQueue(PL.pos + 1 + i); renderQueue(); } }, icon('x'));
    row.append(remove);
    list.append(row);
  });
  body.append(list);
}

/* ============================ ROOT RENDER ============================= */
export async function render(nextRoute) {
  if (nextRoute) route = nextRoute;
  const view = $('#view');
  $('#topbar').classList.toggle('solid', false);

  switch (route.name) {
    case 'home':     $('#tbTitle').textContent = t('home'); await renderHome(); break;
    case 'search':   $('#tbTitle').textContent = t('search'); await renderSearch(); break;
    case 'library':  $('#tbTitle').textContent = t('library'); await renderLibrary(); break;
    case 'playlist': { const p = S.getPlaylist(route.id); $('#tbTitle').textContent = p?.name || t('playlists'); await renderPlaylist(route.id, false); break; }
    case 'auto':     $('#tbTitle').textContent = t({ liked: 'likedSongs', recent: 'recentlyPlayed', top: 'mostPlayed', fresh: 'recentlyAdded' }[route.id] || 'library'); await renderPlaylist(route.id, true); break;
    case 'settings': $('#tbTitle').textContent = t('settings'); await renderSettings(); break;
    default:         await renderHome();
  }

  // active nav highlight
  for (const sel of ['#sidebar .side-item', '#bottomnav .bn-item']) {
    for (const b of document.querySelectorAll(sel)) {
      b.classList.toggle('active', b.dataset.nav === route.name || (route.name === 'library' && b.dataset.nav === 'library'));
    }
  }
  for (const p of document.querySelectorAll('#sidePlaylists .side-pl')) p.classList.toggle('active', false);
  renderSidebar();
  syncChrome();
}

function syncChrome() {
  document.querySelectorAll('#sidebar .side-item span, #bottomnav .bn-item span').forEach((n) => {
    const key = n.dataset.i18n;
    if (key) n.textContent = t(key);
  });
}
