/* ==========================================================================
   store.js — app state: settings (localStorage) + library (IndexedDB)
   ========================================================================== */

import { db, kvGet, kvSet, getSongsOrdered, readSettingsRaw, writeSettingsRaw } from './db.js';
import { uid } from './util.js';

export const AUTO = {
  liked:  { id: 'liked',  name: 'Liked songs',  icon: 'heart-fill', kind: 'auto' },
  recent: { id: 'recent', name: 'Recently played', icon: 'clock',   kind: 'auto' },
  top:    { id: 'top',    name: 'Most played',   icon: 'trending',  kind: 'auto' },
  fresh:  { id: 'fresh',  name: 'Recently added', icon: 'list-plus', kind: 'auto' },
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  accent: 'green',
  lang: 'en',
  volume: 80,
  dataSaver: false,
  crossfade: 0,          // seconds
  autoplaySimilar: false,
  eq: 'flat',
  region: 'IN',
  notifications: false,
  swipe: true,
};

export const settings = { ...DEFAULT_SETTINGS, ...readSettingsRaw() };

export function setSetting(key, value) {
  settings[key] = value;
  writeSettingsRaw({ [key]: value });
}
export function updateSettings(obj) {
  Object.assign(settings, obj);
  writeSettingsRaw(obj);
}

/* ------------------------------------------------------------- library */
export const state = {
  playlists: [],      // user + imported playlists
  liked: new Set(),
  disliked: new Set(),
  allSongs: [],       // every song we know about (unordered)
  recentIds: [],
  topIds: [],
  online: navigator.onLine,
};

export async function refresh() {
  const [playlists, liked, disliked, songs] = await Promise.all([
    db.playlists.all(), db.liked.all(), db.disliked.all(), db.songs.all(),
  ]);
  state.playlists = playlists.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
  state.liked = new Set(liked.map((r) => r.videoId));
  state.disliked = new Set(disliked.map((r) => r.videoId));
  state.allSongs = songs;
  return state;
}

export const getPlaylist = (id) => state.playlists.find((p) => p.id === id);
export const songById = (id) => state.allSongs.find((s) => s.videoId === id);

/** Resolve an auto-playlist id to a concrete song list. */
export async function resolveAuto(id, limit = 100) {
  const { recentIds, topPlayed } = await import('./db.js');
  if (id === 'liked') return getSongsOrdered([...state.liked]);
  if (id === 'recent') return getSongsOrdered(await recentIds(limit));
  if (id === 'top') return getSongsOrdered((await topPlayed(limit)).map((r) => r.videoId));
  if (id === 'fresh') return state.allSongs.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, limit);
  return [];
}

export async function playlistSongs(id) {
  if (AUTO[id]) return resolveAuto(id);
  const p = getPlaylist(id);
  if (!p) return [];
  return getSongsOrdered(p.songIds || []);
}

/* --------------------------------------------------------- playlists */
export async function createPlaylist(name, { songIds = [], source = null, type = 'user' } = {}) {
  const now = Date.now();
  const pl = {
    id: uid(), name: name || 'My playlist', songIds: [...new Set(songIds)],
    type, source, createdAt: now, updatedAt: now,
    order: (state.playlists.at(-1)?.order ?? 0) + 1,
  };
  await db.playlists.put(pl);
  await refresh();
  return pl;
}

export async function renamePlaylist(id, name) {
  const p = getPlaylist(id);
  if (!p) return;
  p.name = name;
  p.updatedAt = Date.now();
  await db.playlists.put(p);
  await refresh();
}

export async function deletePlaylist(id) {
  await db.playlists.delete(id);
  await refresh();
}

export async function duplicatePlaylist(id, name) {
  const p = getPlaylist(id);
  if (!p) return null;
  return createPlaylist(name || `${p.name} (copy)`, { songIds: p.songIds, source: p.source, type: p.type });
}

export async function mergePlaylists(sourceId, targetId) {
  const a = getPlaylist(sourceId), b = getPlaylist(targetId);
  if (!a || !b) return;
  const merged = [...new Set([...(b.songIds || []), ...(a.songIds || [])])];
  b.songIds = merged;
  b.updatedAt = Date.now();
  await db.playlists.put(b);
  await refresh();
}

export async function addSongsToPlaylist(id, ids) {
  const p = getPlaylist(id);
  if (!p) return 0;
  const before = p.songIds.length;
  p.songIds = [...new Set([...(p.songIds || []), ...ids])];
  p.updatedAt = Date.now();
  await db.playlists.put(p);
  await refresh();
  return p.songIds.length - before;
}

export async function removeSongFromPlaylist(id, videoId) {
  const p = getPlaylist(id);
  if (!p) return;
  p.songIds = p.songIds.filter((v) => v !== videoId);
  p.updatedAt = Date.now();
  await db.playlists.put(p);
  await refresh();
}

export async function reorderPlaylist(id, from, to) {
  const p = getPlaylist(id);
  if (!p) return;
  const arr = p.songIds.slice();
  arr.splice(to, 0, arr.splice(from, 1)[0]);
  p.songIds = arr;
  p.updatedAt = Date.now();
  await db.playlists.put(p);
  await refresh();
}

export async function movePlaylist(id, dir) {
  const list = state.playlists;
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const arr = list.slice();
  [arr[i], arr[j]] = [arr[j], arr[i]];
  arr.forEach((p, k) => { p.order = k; });
  await db.playlists.bulkPut(arr);
  await refresh();
}

/* ------------------------------------------------------------- likes */
export async function toggleLike(videoId) {
  const on = state.liked.has(videoId);
  if (on) { state.liked.delete(videoId); await db.liked.delete(videoId); }
  else { state.liked.add(videoId); await db.liked.put({ videoId, likedAt: Date.now() }); state.disliked.delete(videoId); await db.disliked.delete(videoId); }
  await refresh();
  return !on;
}

export async function toggleDislike(videoId) {
  const on = state.disliked.has(videoId);
  if (on) { state.disliked.delete(videoId); await db.disliked.delete(videoId); }
  else {
    state.disliked.add(videoId);
    await db.disliked.put({ videoId, at: Date.now() });
    state.liked.delete(videoId);
    await db.liked.delete(videoId);
  }
  await refresh();
  return !on;
}

/* ----------------------------------------------------------- searches */
export async function recentSearches(limit = 8) {
  const rows = await db.searches.all();
  return rows.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, limit).map((r) => r.query);
}
export async function saveSearch(query) {
  const q = (query || '').trim();
  if (q.length < 2) return;
  await db.searches.put({ query: q, at: Date.now() });
}
export async function removeSearch(query) { await db.searches.delete(query); }
export async function clearSearches() { await db.searches.clear(); }

/* --------------------------------------------------------------- misc */
export const qualityFor = () => (settings.dataSaver ? 'default' : 'mq');
export const isOnline = () => state.online;

export async function cacheMeta(key, value) {
  await kvSet('cache:' + key, { value, at: Date.now() });
}
export async function readMeta(key, maxAgeMs = 15 * 60 * 1000) {
  const entry = await kvGet('cache:' + key);
  if (!entry) return null;
  if (Date.now() - entry.at > maxAgeMs) return null;
  return entry.value;
}
