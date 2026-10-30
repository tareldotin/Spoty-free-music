/* ==========================================================================
   api.js — YouTube data access
   Two engines:
     1. Official YouTube Data API v3  (needs a free key from Google Cloud)
     2. Keyless fallback: public page scrape through CORS proxies
   The app prefers (1) when a key is present and falls back to (2) on any error.
   ========================================================================== */

import { parseDuration, parseCount } from './util.js';

const API = 'https://www.googleapis.com/youtube/v3';

/* ------------------------------------------------------------------ keys */
export const getKey = () => (localStorage.getItem('spotifree.ytkey') || '').trim();
export const setKey = (k) => localStorage.setItem('spotifree.ytkey', (k || '').trim());
export const hasKey = () => !!getKey();

/* --------------------------------------------------------------- proxies */
const DEFAULT_PROXIES = [
  'https://api.allorigins.win/raw?url={url}',
  'https://api.codetabs.com/v1/proxy?quest={url}',
  'https://corsproxy.io/?url={url}',
  'https://api.cors.lol/?url={url}',
  'https://thingproxy.freeboard.io/fetch/{url}',
  'https://proxy.corsfix.com/?{url}',
];
const WORKED_KEY = 'spotifree.proxy.ok';

function proxyList() {
  const custom = (localStorage.getItem('spotifree.proxy') || '').trim();
  const remembered = (localStorage.getItem(WORKED_KEY) || '').trim();
  const list = [];
  if (custom) list.push(custom.includes('{url}') ? custom : custom + encodeURIComponent('{url}'));
  if (remembered && !list.includes(remembered)) list.push(remembered);
  for (const p of DEFAULT_PROXIES) if (!list.includes(p)) list.push(p);
  return list;
}
const rememberProxy = (p) => { try { localStorage.setItem(WORKED_KEY, p); } catch {} };

/* -------------------------------------------------------------- fetching */
async function getJSON(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    const body = await r.text();
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { msg = JSON.parse(body)?.error?.message || msg; } catch {}
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    return JSON.parse(body);
  } finally { clearTimeout(t); }
}

async function getText(url, { timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

/** Fetch a YouTube page's HTML through the first proxy that answers. */
export async function fetchViaProxy(target) {
  let lastErr;
  for (const tpl of proxyList()) {
    const url = tpl.replace('{url}', encodeURIComponent(target));
    try {
      const html = await getText(url, { timeout: 14000 });
      if (html && html.length > 2000 && /ytInitialData|ytInitialPlayerResponse/.test(html)) {
        rememberProxy(tpl);
        return html;
      }
      lastErr = new Error('proxy returned an unusable body');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No CORS proxy available');
}

/* ------------------------------------------------- ytInitialData parsing */
const text = (n) => {
  if (!n) return '';
  if (typeof n === 'string') return n;
  if (typeof n.simpleText === 'string') return n.simpleText;
  if (Array.isArray(n.runs)) return n.runs.map((r) => r.text || '').join('');
  if (typeof n.content === 'string') return n.content;
  return '';
};

/** Extract the first balanced JSON object that follows `marker`. */
function extractJSONAfter(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  let i = src.indexOf('{', at);
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false, start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(src.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** Depth-first walk, calling `cb(node)` for every plain object. */
function walk(node, cb, depth = 0, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || depth > 60) return;
  if (seen.has(node)) return;
  seen.add(node);
  cb(node, depth);
  if (Array.isArray(node)) {
    for (const v of node) if (v && typeof v === 'object') walk(v, cb, depth + 1, seen);
    return;
  }
  for (const k of Object.keys(node)) {
    if (k.startsWith('$')) continue;
    const v = node[k];
    if (v && typeof v === 'object') walk(v, cb, depth + 1, seen);
  }
}

const isVid = (v) => typeof v === 'string' && /^[\w-]{11}$/.test(v);
const bestThumb = (t, vid, prefer) => {
  if (t?.thumbnails?.length) {
    const list = t.thumbnails;
    const pick = list[Math.min(list.length - 1, prefer === 'low' ? 0 : 2)] || list[list.length - 1];
    return pick.url;
  }
  return `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
};

/** Pull every video-ish renderer out of a parsed ytInitialData blob. */
function collectVideos(data, { exclude = [], limit = Infinity, quality = 'mq' } = {}) {
  const out = [];
  const seen = new Set(exclude.filter(Boolean));
  walk(data, (n) => {
    if (out.length >= limit) return;
    const vid = n.videoId;
    if (!isVid(vid) || seen.has(vid)) return;
    // only accept nodes that look like a card we can render
    const hasTitle = n.title || n.headline;
    const hasThumb = n.thumbnail || n.thumbnails;
    if (!hasTitle || !hasThumb) return;
    const kind = Object.keys(n).find((k) => /Renderer$/.test(k));
    const r = kind ? n[kind] : null;
    const node = r && r.videoId === vid ? { ...r, thumbnail: r.thumbnail, title: r.title } : n;
    const title = text(node.title) || text(node.headline) || '';
    if (!title) return;
    seen.add(vid);
    const dur =
      node.lengthSeconds != null && String(node.lengthSeconds) !== ''
        ? Number(node.lengthSeconds)
        : parseDuration(text(node.lengthText) || text(node.lengthText?.simpleText));
    out.push({
      videoId: vid,
      title,
      channel: text(node.ownerText) || text(node.shortBylineText) || text(node.longBylineText) || text(node.author) || '',
      channelId: node.ownerBadges ? '' : (node.ownerId || n.ownerId || ''),
      thumbnail: bestThumb(node.thumbnail, vid, quality),
      duration: isFinite(dur) ? dur : 0,
      views: parseCount(text(node.viewCountText) || text(node.videoInfoText || node.shortViewCountText)),
      published: text(node.publishedTimeText) || '',
    });
  });
  return out;
}

function collectPlaylists(data, limit = 40) {
  const out = [];
  const seen = new Set();
  walk(data, (n) => {
    if (out.length >= limit) return;
    const id = n.playlistId;
    if (!id || seen.has(id)) return;
    if (!(n.thumbnail || n.thumbnails) || !n.title) return;
    seen.add(id);
    out.push({
      id,
      title: text(n.title),
      channel: text(n.shortBylineText) || text(n.longBylineText) || '',
      thumbnail: bestThumb(n.thumbnail || n.thumbnails?.[0], ''),
      count: Number(n.videoCount) || parseCount(text(n.videoCountText)),
    });
  });
  return out;
}

function collectChannels(data, limit = 25) {
  const out = [];
  const seen = new Set();
  walk(data, (n) => {
    if (out.length >= limit) return;
    const id = n.channelId;
    if (!id || seen.has(id) || !n.title) return;
    if (!n.thumbnail && !n.avatar) return;
    seen.add(id);
    out.push({
      id,
      title: text(n.title),
      handle: text(n.handle) || text(n.canonicalChannelUrl)?.split('/').pop() || '',
      thumbnail: bestThumb(n.thumbnail, ''),
      subs: text(n.videoCountText) || text(n.subscriberCountText) || '',
    });
  });
  return out;
}

export function parsePage(html) {
  return {
    data: extractJSONAfter(html, 'ytInitialData'),
    player: extractJSONAfter(html, 'ytInitialPlayerResponse'),
  };
}

/* ============================ PUBLIC API ============================== */

function normalize(item, quality = 'mq') {
  const sn = item.snippet || {};
  const cd = item.contentDetails || {};
  const th = sn.thumbnails || {};
  const vid = typeof item.id === 'string'
    ? item.id
    : (item.id?.videoId || item.id?.channelId || item.id?.playlistId || item.snippet?.resourceId?.videoId);
  return {
    videoId: vid,
    title: sn.title || '(untitled)',
    channel: sn.channelTitle || sn.videoOwnerChannelTitle || '',
    channelId: item.id?.channelId || sn.channelId || sn.videoOwnerChannelId || '',
    thumbnail:
      (quality === 'low' ? th.default?.url : th.maxres?.url || th.standard?.url || th.high?.url || th.medium?.url || th.default?.url) ||
      `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
    duration: parseDuration(cd.duration || item.contentDetails?.duration),
    published: sn.publishedAt || '',
    views: parseCount(item.statistics?.viewCount),
    description: (sn.description || '').slice(0, 400),
  };
}

const q = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '')));

/* ---------------------------------------------------- 1. single video */
export async function getVideo(id, { quality = 'mq' } = {}) {
  if (hasKey()) {
    try {
      const d = await getJSON(`${API}/videos?${q({ part: 'snippet,contentDetails,statistics', id, key: getKey() })}`);
      const it = d.items?.[0];
      if (it) return { ...normalize(it, quality), source: 'api' };
    } catch (e) { console.warn('[api] videos.list failed', e.message); }
  }
  // keyless: oEmbed (CORS-friendly, no proxy) + watch page for duration
  let song = { videoId: id, title: 'YouTube video', channel: '', thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, duration: 0 };
  try {
    const o = await getJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { timeout: 8000 });
    song = { ...song, title: o.title || song.title, channel: o.author_name || '', thumbnail: o.thumbnail_url || song.thumbnail };
  } catch { /* oEmbed blocked; fall through to scrape */ }
  try {
    const html = await fetchViaProxy(`https://www.youtube.com/watch?v=${id}&hl=en`);
    const { player } = parsePage(html);
    if (player?.videoDetails) {
      const vd = player.videoDetails;
      song.title = vd.title || song.title;
      song.channel = vd.author || song.channel;
      song.channelId = vd.channelId || '';
      song.duration = parseDuration(vd.lengthSeconds);
      song.views = parseCount(vd.viewCount);
    }
    song.source = 'scrape';
  } catch { song.source = 'oembed'; }
  return song;
}

/* ------------------------------------------------------- 2. playlists */
export async function getPlaylistMeta(id) {
  if (hasKey()) {
    try {
      const d = await getJSON(`${API}/playlists?${q({ part: 'snippet,contentDetails', id, key: getKey() })}`);
      const it = d.items?.[0];
      if (it) {
        const th = it.snippet.thumbnails || {};
        return {
          id,
          title: it.snippet.title,
          channel: it.snippet.channelTitle || '',
          thumbnail: th.maxres?.url || th.standard?.url || th.high?.url || th.medium?.url || '',
          count: it.contentDetails?.itemCount || 0,
          description: it.snippet.description || '',
        };
      }
    } catch (e) { console.warn('[api] playlists.list failed', e.message); }
  }
  const html = await fetchViaProxy(`https://www.youtube.com/playlist?list=${id}&hl=en`);
  const { data } = parsePage(html);
  if (!data) throw new Error('Could not read the playlist page. Try adding an API key in Settings.');
  const d =
    data.metadata?.playlistMetadataRenderer ||
    data.header?.playlistHeaderRenderer ||
    data.microformat?.microformatDataRenderer || {};
  return {
    id,
    title: text(d.title || d.albumName) || 'Imported playlist',
    channel: text(d.ownerText) || text(data.sidebar?.playlistSidebarRenderer?.items?.[1]?.playlistSidebarSecondaryInfoRenderer?.videoOwner?.videoOwnerRenderer?.title) || '',
    thumbnail: (d.thumbnail?.thumbnails || []).slice(-1)[0]?.url || '',
    count: parseCount(text(d.numVideosText)) || Number(d.videoCount) || 0,
    description: text(d.description),
  };
}

export async function getPlaylistItems(id, { onProgress, quality = 'mq', limit = 500 } = {}) {
  const out = [];
  if (hasKey()) {
    let token = '';
    try {
      do {
        const d = await getJSON(`${API}/playlistItems?${q({
          part: 'snippet,contentDetails', playlistId: id, maxResults: 50, pageToken: token, key: getKey(),
        })}`);
        const items = (d.items || []).filter((i) => i.snippet?.title && i.snippet?.title !== 'Private video' && i.snippet?.title !== 'Deleted video');
        for (const i of items) {
          out.push({
            ...normalize(i, quality),
            videoId: i.contentDetails?.videoId || i.snippet?.resourceId?.videoId,
            addedAtPlaylist: i.snippet?.publishedAt || '',
          });
        }
        onProgress?.(out.length, d.pageInfo?.totalResults);
        token = d.nextPageToken || '';
        if (out.length >= limit) break;
      } while (token);
      if (out.length) return out;
    } catch (e) {
      console.warn('[api] playlistItems failed', e.message);
      out.length = 0;
    }
  }
  // keyless
  const html = await fetchViaProxy(`https://www.youtube.com/playlist?list=${id}&hl=en`);
  const { data } = parsePage(html);
  if (!data) throw new Error('Could not read the playlist page. Try adding an API key in Settings.');
  const vids = collectVideos(data, { quality, limit });
  onProgress?.(vids.length, vids.length);
  if (!vids.length) throw new Error('No playable songs found in that link.');
  return vids;
}

/* -------------------------------------------------------- 3. channels */
export async function getChannelUploads(input, { quality = 'mq', limit = 60 } = {}) {
  // input: {id} or {handle}
  if (hasKey()) {
    try {
      const p = input.id
        ? { id: input.id, part: 'contentDetails,snippet' }
        : { forHandle: '@' + String(input.handle || '').replace(/^@/, ''), part: 'contentDetails,snippet' };
      const d = await getJSON(`${API}/channels?${q({ ...p, key: getKey() })}`);
      const ch = d.items?.[0];
      const uploads = ch?.contentDetails?.relatedPlaylists?.uploads;
      if (uploads) {
        const songs = await getPlaylistItems(uploads, { quality, limit });
        return { name: ch.snippet?.title || 'Channel uploads', songs };
      }
    } catch (e) { console.warn('[api] channels.list failed', e.message); }
  }
  const slug = input.id ? `channel/${input.id}` : `@${String(input.handle || '').replace(/^@/, '')}`;
  const html = await fetchViaProxy(`https://www.youtube.com/${slug}/videos?hl=en`);
  const { data } = parsePage(html);
  if (!data) throw new Error('Could not read that channel. Try adding an API key in Settings.');
  const name =
    text(data.metadata?.channelMetadataRenderer?.title) ||
    text(data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.title) ||
    input.handle || 'Channel';
  const songs = collectVideos(data, { quality, limit });
  return { name, songs };
}

/* ---------------------------------------------------------- 4. search */
export async function search(query, { type = 'video', quality = 'mq', pageToken = '' } = {}) {
  if (hasKey()) {
    try {
      const params = {
        part: 'snippet', maxResults: 25, q: query, key: getKey(), pageToken,
        type: type === 'all' ? 'video,playlist,channel' : type,
        videoCategoryId: undefined,
      };
      if (type === 'video' || type === 'all') params.videoEmbeddable = 'true';
      const d = await getJSON(`${API}/search?${q(params)}`);
      const ids = (d.items || []).map((i) => i.id?.videoId).filter(Boolean);
      let durMap = {};
      if (ids.length) {
        try {
          const vd = await getJSON(`${API}/videos?${q({ part: 'contentDetails,statistics,snippet', id: ids.join(','), key: getKey() })}`);
          for (const v of vd.items || []) durMap[v.id] = v;
        } catch {}
      }
      const items = (d.items || []).map((i) => {
        const base = normalize(i, quality);
        const extra = durMap[base.videoId];
        if (extra) {
          base.duration = parseDuration(extra.contentDetails?.duration);
          base.views = parseCount(extra.statistics?.viewCount);
        }
        return { ...base, kind: i.id?.kind?.replace('youtube#', '') || 'video' };
      });
      return { items, nextPageToken: d.nextPageToken || '', source: 'api' };
    } catch (e) { console.warn('[api] search failed', e.message); }
  }
  const url =
    type === 'playlist' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%253D%253D&hl=en`
    : type === 'channel' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D&hl=en`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`;
  const html = await fetchViaProxy(url);
  const { data } = parsePage(html);
  if (!data) throw new Error('Search needs an API key or a working CORS proxy (Settings → Data source).');
  let items;
  if (type === 'playlist') items = collectPlaylists(data).map((p) => ({ ...p, kind: 'playlist', videoId: p.id }));
  else if (type === 'channel') items = collectChannels(data).map((c) => ({ ...c, kind: 'channel', videoId: c.id }));
  else items = collectVideos(data, { quality, limit: 30 }).map((v) => ({ ...v, kind: 'video' }));
  return { items, nextPageToken: '', source: 'scrape' };
}

/* -------------------------------------------------------- 5. trending */
export async function trending(region = 'IN', { quality = 'mq' } = {}) {
  if (hasKey()) {
    try {
      const d = await getJSON(`${API}/videos?${q({
        part: 'snippet,contentDetails,statistics', chart: 'mostPopular',
        videoCategoryId: 10, regionCode: region, maxResults: 25, key: getKey(),
      })}`);
      return { items: (d.items || []).map((i) => normalize(i, quality)), source: 'api' };
    } catch (e) { console.warn('[api] trending failed', e.message); }
  }
  const html = await fetchViaProxy('https://www.youtube.com/feed/trending?bp=4gINGgt5dG1hX2NoYXJ0cw%3D%3D&hl=en&gl=' + region);
  const { data } = parsePage(html);
  if (!data) throw new Error('Trending needs an API key or a working CORS proxy.');
  return { items: collectVideos(data, { quality, limit: 30 }), source: 'scrape' };
}

/* ------------------------------------------------- 6. related / similar */
export async function related(videoId, title, { quality = 'mq', limit = 12 } = {}) {
  if (hasKey()) {
    try {
      const d = await getJSON(`${API}/search?${q({
        part: 'snippet', maxResults: limit, type: 'video', videoEmbeddable: 'true',
        q: title ? title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').slice(0, 60) : 'music', key: getKey(),
      })}`);
      const items = (d.items || []).map((i) => normalize(i, quality)).filter((i) => i.videoId !== videoId);
      if (items.length) return items;
    } catch (e) { console.warn('[api] related failed', e.message); }
  }
  try {
    const html = await fetchViaProxy(`https://www.youtube.com/watch?v=${videoId}&hl=en`);
    const { data } = parsePage(html);
    if (data) {
      const vids = collectVideos(data, { exclude: [videoId], quality, limit });
      if (vids.length) return vids;
    }
  } catch {}
  return [];
}

/* ------------------------------------------------- 7. diagnostics */
export async function testProxy() {
  const t0 = performance.now();
  try {
    const html = await fetchViaProxy('https://www.youtube.com/results?search_query=music&hl=en');
    return { ok: /ytInitialData/.test(html), ms: Math.round(performance.now() - t0) };
  } catch (e) { return { ok: false, error: e.message, ms: Math.round(performance.now() - t0) }; }
}

export async function testKey(key) {
  if (!key) return { ok: false, error: 'No key' };
  try {
    const d = await getJSON(`${API}/videos?${q({ part: 'snippet', id: 'dQw4w9WgXcQ', key })}`, { timeout: 10000 });
    if (d.items?.length) return { ok: true };
    return { ok: false, error: 'Key works but returned no data' };
  } catch (e) { return { ok: false, error: e.message }; }
}
