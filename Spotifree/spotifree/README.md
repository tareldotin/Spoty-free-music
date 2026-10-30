# 🎵 SpotiFree

**A Spotify-style music player powered by YouTube — 100% free, no login, no server, no ads.**

Paste a YouTube playlist link → get every song in a real music-player UI → everything is stored
on your own device.

Built with **zero dependencies and zero build step**: plain ES modules, vanilla CSS, and a
hand-rolled IndexedDB layer. Open it, host it, install it.

---

## ⚡ Quick start

```bash
cd spotifree
python3 serve.py 8000        # or:  npx serve .   /  php -S 0.0.0.0:8000
```

Then open `http://localhost:8000`. That's it — no `npm install`.

> **PWA note:** the service worker only registers over `http://localhost` or `https://`.
> Opening the file directly as `file://…` works for playback, but install/offline won't.

### Deploy free (any static host)

| Host | Command |
|---|---|
| **Vercel** | `npx vercel --prod` (no config needed) |
| **Netlify** | drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop) |
| **GitHub Pages** | push the folder, enable Pages → *Deploy from branch* |
| **Cloudflare Pages** | connect the repo, framework preset: *None* |

Any host that serves static files works. There is nothing to build.

---

## 🔑 Data source — two options

SpotiFree never talks to a server of its own. It only needs *song metadata*, and it can get it
two ways:

### 1. With a free YouTube Data API key (recommended)

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) → create a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. In SpotiFree: **Settings → Data source → paste the key → Save → Test**.

Quota is **10,000 units/day free**. Rough cost: a 100-song playlist ≈ 3 units, a search ≈ 100.
Everyday use is comfortably free. ([Quota docs](https://developers.google.com/youtube/v3/determine_quota_cost))

### 2. With no key at all (works out of the box)

Without a key, SpotiFree reads YouTube's **public pages** through public CORS proxies and parses
the embedded `ytInitialData` JSON. It tries several proxies in order and remembers the one that
worked. Public proxies can be slow or rate-limited, so you can also set your own in
**Settings → Data source → Custom CORS proxy**, using `{url}` as the placeholder:

```
https://your-proxy.example/?url={url}
```

Single-video links additionally use YouTube's `oembed` endpoint, which needs no proxy at all.

---

## ✨ What's implemented

### Import
- Playlist links, single videos, channel links (`@handle`, `/channel/`, `/c/`, `/user/`)
- **Bulk import** — paste many links at once, one per line (or comma/space separated)
- **Smart detection** of what you pasted; links pasted anywhere are caught automatically
- **Drag a link** onto the import box
- **Refresh** button on imported playlists pulls in newly added songs
- A `watch?v=…&list=…` URL imports the whole playlist

### Player
- Play / pause / next / previous, seek bar, volume + mute, live time & duration
- Shuffle, and repeat **Off / All / One**
- Queue with "play next", "add to queue", remove, and an Up Next panel
- **Real crossfade** (0 / 3 / 5 / 8 / 12 s) using two YouTube IFrame players that volume-ramp
  into each other
- Mini player that never gets in the way + full-screen player
- **Swipe left/right** on the artwork for next/previous
- **Media Session API** → lock-screen and notification controls (play/pause/next/prev/seek)
- Keyboard: `Space` play-pause · `Shift + ← / →` prev/next · `↑ / ↓` volume · `Esc` close
- Auto-skip when a video is unplayable (private / embedding disabled / removed)

### Library
- Create / rename / duplicate / delete / reorder playlists, merge two playlists
- Auto-playlists: **Liked songs**, **Recently played**, **Most played**, **Recently added**
- Drag songs onto a playlist card to add them; drag to reorder inside a playlist
- Sort by date added, title A–Z / Z–A, duration
- Instant library search

### Favourites
- Like / unlike (heart everywhere), **dislike** (skips and de-prioritises)

### Search & discover
- YouTube search with **Songs / Playlists / Channels** filters
- Region-based **Trending music**, cached 30 minutes
- Recent searches with long-press to remove a single entry
- Click a playlist or channel result to import it straight into your library

### UI
- Dark (default) + light theme, six accent colours, smooth transitions
- Responsive: sidebar on desktop, bottom nav on phones
- Spotify-style skeleton loading, pull-to-refresh, toasts, sheets
- **English / മലയാളം / हिन्दी / தமிழ்**

### Settings
- Sleep timer (15 / 30 / 45 / 60 min / end of song)
- Equalizer presets, data saver, clear cache, storage usage
- **Export / import a JSON backup** of every playlist, like and history entry
- Region, notifications, install prompt

### PWA
- Installable to home screen, standalone (no browser bar), splash screen
- Service worker caches the app shell → the UI opens offline
- Thumbnails cached (max 300) so artwork survives offline
- Screen wake-lock while playing

---

## 🗂 Project structure

```
spotifree/
├── index.html              app shell, SVG icon sprite, splash
├── manifest.webmanifest    PWA manifest (+ shortcuts)
├── sw.js                   service worker: offline shell + thumbnail cache
├── serve.py                dependency-free dev server
├── icons/                  192, 512, maskable-512
└── assets/
    ├── css/app.css         all styling (CSS variables drive theme + accent)
    └── js/
        ├── util.js         DOM helpers, time/URL parsing, formatters
        ├── db.js           IndexedDB wrapper + backup export/import
        ├── api.js          YouTube Data API v3 + keyless fallback
        ├── store.js        settings (localStorage) + library state
        ├── player.js       dual IFrame players, queue, shuffle, Media Session
        ├── i18n.js         en / ml / hi / ta
        ├── ui.js           every screen and component
        └── app.js          bootstrap, routing, chrome, gestures, PWA
```

### Where data lives

| Store | Contents |
|---|---|
| **IndexedDB** `spotifree` | `songs`, `playlists`, `liked`, `disliked`, `history`, `searches`, `kv` |
| **localStorage** | settings, API key, proxy, language |
| **Cache API** | app shell + YouTube thumbnails |

Nothing is ever uploaded. Wipe it all with **Settings → Erase everything**, or back it up
first with **Export backup**.

---

## ⚠️ Honest limitations

| Thing | Reality |
|---|---|
| **Equalizer** | A YouTube IFrame's audio is played by the browser outside the page's Web Audio graph, so it can't be filtered. Presets are saved and shown, but only take effect on audio the browser lets us process. |
| **Background play** | Android Chrome (especially installed as a PWA) is good. iOS Safari pauses when the screen locks. Android + a PWA install is the best experience. |
| **Battery / data** | Streaming YouTube video-to-audio uses more power than a native music stream. Data Saver helps. |
| **Keyless mode** | Depends on third-party CORS proxies; they can be slow or blocked. Add a free API key for reliability. |
| **YouTube ToS** | Playing YouTube content as audio-only through the IFrame API is a grey area — fine for personal use, but don't ship it commercially without following YouTube's API terms. |
| **Offline audio** | Metadata and artwork are cached; actual audio always needs a connection. |

---

## 🧪 Self-checks

```bash
# syntax
for f in assets/js/*.js sw.js; do node --check <(cat "$f") ; done

# served correctly?
python3 serve.py 8000   # then visit http://localhost:8000
```

Made to be read and modified — there is no framework to fight, and every file is plain JS.
