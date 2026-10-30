/* ==========================================================================
   util.js — small helpers, no dependencies
   ========================================================================== */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Create an element: el('div.card', {onclick}, [children|string]) */
export function el(spec, props = {}, ...kids) {
  const [tag, ...classes] = String(spec).split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className += (node.className ? ' ' : '') + v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const icon = (name, cls = '') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'ic ' + cls);
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#i-' + name);
  s.append(u);
  return s;
};

/** <svg><use href="#i-name"/></svg> as HTML string */
export const ic = (name) => `<svg class="ic"><use href="#i-${name}"/></svg>`;

export const uid = () =>
  (crypto.randomUUID?.() || 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9));

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const debounce = (fn, ms = 220) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/** seconds -> m:ss or h:mm:ss */
export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

/** "4:13" / "1:02:33" / "PT4M13S" -> seconds */
export function parseDuration(v) {
  if (v == null) return 0;
  if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
  const s = String(v).trim();
  let m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(s);
  if (m) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  const n = parseInt(s, 10);
  return isFinite(n) ? n : 0;
}

/** "1,234,567 views" / "2.3M" -> number (0 if unknown) */
export function parseCount(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const s = String(v).replace(/,/g, '').trim();
  const m = /^([\d.]+)\s*([KMB])?/i.exec(s);
  if (!m) return 0;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

export const fmtCount = (n) => {
  if (!n) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export function fmtTotal(secs) {
  const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m || 1} min`;
}

export function fmtAgo(ts) {
  const d = Date.now() - ts;
  const mins = Math.floor(d / 6e4);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const shuffleArr = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const moveItem = (arr, from, to) => {
  const a = arr.slice();
  a.splice(to, 0, a.splice(from, 1)[0]);
  return a;
};

/** Turn any YouTube-ish URL into a videoId, else null */
export function videoIdFromUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/|\/v\/)([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) return m[1];
  }
  return null;
}

/** playlist id from url */
export function playlistIdFromUrl(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  if (/^(PL|OL|FL|UU|LL|RD|WL)[\w-]{10,}$/i.test(s)) return s;
  const m = /[?&]list=([\w-]+)/.exec(s);
  return m ? m[1] : null;
}

/** channel handle or id from url */
export function channelFromUrl(url) {
  const s = String(url || '').trim();
  const patterns = [
    /youtube\.com\/(?:channel|c)\/([\w-]+)/,
    /youtube\.com\/@([\w.\-]+)/,
    /youtube\.com\/user\/([\w-]+)/,
    /^@([\w.\-]+)$/,
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) return { handle: re === patterns[1] || re === patterns[3] ? m[1] : null, id: re === patterns[0] ? m[1] : null, raw: m[1] };
  }
  return null;
}

/** Classify a pasted string */
export function detectInput(text) {
  const s = String(text || '').trim();
  if (!s) return { kind: 'empty' };
  const pid = playlistIdFromUrl(s);
  if (pid && !videoIdFromUrl(s)) return { kind: 'playlist', id: pid };
  const vid = videoIdFromUrl(s);
  if (vid) {
    // watch URL that also carries a list= param → import the playlist, but note the video
    const p = playlistIdFromUrl(s);
    return { kind: 'video', id: vid, playlistId: p && /^PL|OL|FL|UU|LL|WL/.test(p) ? p : null };
  }
  const ch = channelFromUrl(s);
  if (ch) return { kind: 'channel', ...ch };
  return { kind: 'unknown', raw: s };
}

/** thumbnail url tuned by data-saver */
export function thumb(videoId, quality = 'mq') {
  if (!videoId) return '';
  const map = { sd: 'sddefault', hq: 'hqdefault', mq: 'mqdefault', max: 'maxresdefault', def: 'default' };
  return `https://i.ytimg.com/vi/${videoId}/${map[quality] || 'mqdefault'}.jpg`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const pickFile = (accept) =>
  new Promise((resolve) => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept });
    inp.style.display = 'none';
    document.body.append(inp);
    inp.addEventListener('change', () => { resolve(inp.files?.[0] || null); inp.remove(); });
    inp.click();
  });
