/* ==========================================================================
   db.js — tiny promise wrapper over IndexedDB (Dexie-free, zero deps)
   Stores: songs, playlists, liked, disliked, history, searches, kv
   ========================================================================== */

const DB_NAME = 'spotifree';
const DB_VER = 1;

export const STORES = {
  songs:     { key: 'videoId' },
  playlists: { key: 'id' },
  liked:     { key: 'videoId' },
  disliked:  { key: 'videoId' },
  history:   { key: 'id', auto: true },
  searches:  { key: 'query' },
  kv:        { key: 'key' },
};

let _dbp = null;

export function open() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: cfg.key, autoIncrement: !!cfg.auto });
        }
      }
      const hist = e.target.transaction.objectStore('history');
      if (!hist.indexNames.contains('playedAt')) hist.createIndex('playedAt', 'playedAt');
      if (!hist.indexNames.contains('videoId')) hist.createIndex('videoId', 'videoId');
      const pl = e.target.transaction.objectStore('playlists');
      if (!pl.indexNames.contains('createdAt')) pl.createIndex('createdAt', 'createdAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  return _dbp;
}

function tx(store, mode = 'readonly') {
  return open().then((db) => db.transaction(store, mode).objectStore(store));
}

const wrap = (req) =>
  new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

/**
 * Storage can be unavailable (private browsing, blocked cookies, quota errors).
 * Instead of taking the whole app down, fall back to a neutral value and warn once.
 */
let warned = false;
async function safe(fn, fallback) {
  try { return await fn(); }
  catch (e) {
    if (!warned) { warned = true; console.warn('[db] storage unavailable — running in memory-only mode:', e?.message || e); }
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function make(name) {
  return {
    name,
    get: (key) => safe(() => tx(name).then((s) => wrap(s.get(key))), null),
    all: () => safe(() => tx(name).then((s) => wrap(s.getAll())), []),
    count: () => safe(() => tx(name).then((s) => wrap(s.count())), 0),
    keys: () => safe(() => tx(name).then((s) => wrap(s.getAllKeys())), []),
    put: (val) => safe(async () => { const s = await tx(name, 'readwrite'); return wrap(s.put(val)); }, undefined),
    bulkPut: (vals) => safe(async () => {
      const s = await tx(name, 'readwrite');
      await Promise.all(vals.map((v) => wrap(s.put(v))));
      return vals.length;
    }, 0),
    delete: (key) => safe(async () => { const s = await tx(name, 'readwrite'); return wrap(s.delete(key)); }, undefined),
    deleteMany: (keys) => safe(async () => {
      const s = await tx(name, 'readwrite');
      await Promise.all(keys.map((k) => wrap(s.delete(k))));
    }, undefined),
    clear: () => safe(async () => { const s = await tx(name, 'readwrite'); return wrap(s.clear()); }, undefined),
    /** all matching an index value */
    where: (index, value) => safe(async () => {
      const s = await tx(name);
      return wrap(s.index(index).getAll(value));
    }, []),
    /** last N records by 'playedAt' index (descending) */
    recent: (n = 200) => safe(() => new Promise(async (res, rej) => {
      const s = await tx(name);
      const out = [];
      const req = s.index('playedAt').openCursor(null, 'prev');
      req.onsuccess = () => {
        const c = req.result;
        if (!c || out.length >= n) return res(out);
        out.push(c.value);
        c.continue();
      };
      req.onerror = () => rej(req.error);
    }), []),
  };
}

export const db = Object.fromEntries(Object.keys(STORES).map((n) => [n, make(n)]));

/* ------------------------- convenience helpers ------------------------- */

export async function kvGet(key, fallback = null) {
  try { const r = await db.kv.get(key); return r ? r.value : fallback; }
  catch { return fallback; }
}
export async function kvSet(key, value) {
  try { return await db.kv.put({ key, value }); } catch { /* ignore */ }
}

/** upsert a song, keeping the earliest addedAt */
export async function putSong(song) {
  if (!song?.videoId) return;
  const prev = await db.songs.get(song.videoId);
  const merged = { ...(prev || {}), ...song, addedAt: prev?.addedAt ?? song.addedAt ?? Date.now() };
  return db.songs.put(merged);
}
export const putSongs = (songs) => db.songs.bulkPut(songs.filter((s) => s?.videoId));

export async function getSongs(ids) {
  if (!ids?.length) return [];
  const rows = await Promise.all(ids.map((id) => db.songs.get(id)));
  return rows.filter(Boolean);
}
/** get songs preserving order + filling gaps */
export async function getSongsOrdered(ids) {
  const map = new Map((await getSongs(ids)).map((s) => [s.videoId, s]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

export async function logPlay(videoId) {
  if (!videoId) return;
  await db.history.put({ videoId, playedAt: Date.now() });
}

export async function topPlayed(limit = 50) {
  const rows = await db.history.all();
  const counts = new Map();
  for (const r of rows) {
    const c = counts.get(r.videoId) || { videoId: r.videoId, count: 0, last: 0 };
    c.count++;
    c.last = Math.max(c.last, r.playedAt || 0);
    counts.set(r.videoId, c);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, limit);
}

export async function recentIds(limit = 50) {
  const rows = await db.history.recent(600);
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    out.push(r.videoId);
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------- backup / restore ------------------------- */

export async function exportAll() {
  const [songs, playlists, liked, disliked, history, searches] = await Promise.all([
    db.songs.all(), db.playlists.all(), db.liked.all(),
    db.disliked.all(), db.history.all(), db.searches.all(),
  ]);
  return {
    app: 'spotifree', version: 1, exportedAt: new Date().toISOString(),
    settings: readSettingsRaw(),
    songs, playlists, liked, disliked, history, searches,
  };
}

export async function importAll(data, { merge = true } = {}) {
  if (!data || (data.app && data.app !== 'spotifree')) throw new Error('Not a SpotiFree backup');
  if (data.songs?.length) await db.songs.bulkPut(data.songs);
  if (data.liked?.length) await db.liked.bulkPut(data.liked);
  if (data.disliked?.length) await db.disliked.bulkPut(data.disliked);
  if (data.history?.length) await db.history.bulkPut(data.history);
  if (data.searches?.length) await db.searches.bulkPut(data.searches);

  if (data.playlists?.length) {
    if (merge) {
      const existing = await db.playlists.all();
      const ids = new Set(existing.map((p) => p.id));
      const renamed = data.playlists.map((p) => (ids.has(p.id) ? { ...p, id: p.id + '-' + Date.now().toString(36) } : p));
      await db.playlists.bulkPut(renamed);
    } else {
      await db.playlists.clear();
      await db.playlists.bulkPut(data.playlists);
    }
  }
  if (data.settings) writeSettingsRaw(data.settings);
  return true;
}

export async function wipeAll() {
  await Promise.all(Object.keys(STORES).map((n) => db[n].clear()));
}

/** settings live in localStorage (fast, synchronous, tiny) */
const SKEY = 'spotifree.settings';
function readSettingsRaw() {
  try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { return {}; }
}
function writeSettingsRaw(obj) {
  localStorage.setItem(SKEY, JSON.stringify({ ...readSettingsRaw(), ...obj }));
}
export { readSettingsRaw, writeSettingsRaw };

/** rough size of everything we own (bytes) */
export async function estimateSize() {
  if (navigator.storage?.estimate) {
    try {
      const { usage = 0 } = await navigator.storage.estimate();
      if (usage) return usage;
    } catch {}
  }
  const [s, p, h] = await Promise.all([db.songs.all(), db.playlists.all(), db.history.all()]);
  return JSON.stringify([s, p, h]).length;
}
