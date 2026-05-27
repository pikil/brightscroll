# Brightscroll

A browser-only feed of human-curated facts — Wikipedia "Did you know?", Reddit TIL, and
factroom.ru — as a TikTok-style vertical scroll, translated on-device into the reader's language.

Static site: no backend, no accounts, no tracking. Nothing you read or scroll leaves the browser.

## Developing

```sh
npm install
npm run dev          # https if dev_ssl.json is present
npm run dev:host     # exposed on the LAN, for testing on a phone
```

Testing on a phone needs HTTPS, not just `--host`: a LAN IP is not a secure context, and without
one the browser drops IndexedDB persistence and the built-in `Translator` API.

```sh
npm run build        # -> build/ (static SPA)
npm run preview      # serve the production build
npm run lint
npm run check        # svelte-check
npm run test         # vitest (node)
```

## Layout

```
src/lib/
  sources/       the three fact sources + the registry that batches them
  facts/         the Post shape; assigns identity, never touches fact text
  translate/     backend-agnostic router + two backends + the opus-mt worker
  feed/          FeedStore — restore, load-more, prefetch, translation loop
  db/            IndexedDB: dedup, persisted posts, cursor, language
  i18n/          language list, labels, RTL flags
  capabilities/  storage + debug (the one sanctioned console channel)
  components/    Intro, Feed, Post, LanguagePicker
```

## The two rules that matter

**Facts are shown verbatim.** DYK hooks are source-cited and human-reviewed; TIL and factroom are
human-written. Any paraphrase — by a model or by clever string munging — can only reduce fidelity.
Translation is the sole permitted transformation, and the original is always kept alongside it.
There is no generative model here and adding one is not a small change.

**A reader is never served facts they cannot read.** `feed.canRead(lang)` decides whether a source
is *fetched at all*. It is symmetric: English is not a privileged fallback, so a reader of a
language nothing can reach correctly gets an empty feed with an explanation, not English facts they
did not ask for. This is why the language picker is never hidden — where translation is
unavailable, the language setting decides *which sources you get*, not just how they read.

## Translation

Backends are tried in preference order per language pair, and the winner is remembered:

1. **Built-in `Translator` API** (Chrome/Edge 138+) — no download, on-device, and it covers pairs
   opus-mt does not publish at all.
2. **opus-mt via Transformers.js** in a worker — the fallback, mainly for Safari. First use of a
   pair downloads ~110 MB. Whether it loads is *discovered*, not detected: no API reports whether
   ONNX Runtime can build a session on a device, so `prepare()` is the detection.
3. Neither → that source is not fetched.

Routing is **per pair**, never global. `Xenova/opus-mt-ru-*` exists only for en/es/fr, so a German
reader needs en→de to work and ru→de to fail *independently* — they should get DYK and TIL in
German and simply no factroom.

### Open question

The backend order puts the built-in API first despite a standing report of ru→en output that
"barely parsed". The reasoning is that the symptom describes a construction bug rather than a model
one — an instance is bound to the pair it was created with, and feeding it another source language
returns confident garbage rather than an error. See the module comment in `translate/builtin.js`.

**That argument is untested.** `/translator-check` runs both backends over live source text so the
comparison can be made directly. If the built-in output is genuinely bad, the fix is to reverse the
order in `BACKENDS` (`translate/index.js`) — one line — and revisit whether factroom earns its
place, since it is what forces the ru→X direction that opus-mt barely covers.

## Things that have bitten us

- **ESLint bans `for..of` and `for..in`.** Use array methods or a classic `for (let i…)`.
- **`no-console` is an error.** Use `capabilities/debug.js`.
- **WebKit throttles `history.replaceState`** to ~100 per 30s and then throws. `routing.js`
  coalesces writes (trailing, 400 ms) and swallows the error.
- **`vite dev` reloads the page itself when its HMR socket drops.** Phone testing hits this
  constantly — locking the screen drops the socket. Debug any reload report against
  `npm run preview:host`, never `npm run dev:host`.
- **A passing Node test is not evidence about Safari.** opus-mt `q8` loads fine under
  `onnxruntime-node` and is rejected outright by Safari's WASM build. Node can rule a rung *out*,
  never *in*.
- **Safari needs COOP/COEP to fetch anything that cross-origin-redirects.** Hugging Face weight
  files 302 to a second origin. The dev/preview middleware in `vite.config.js` sets the headers;
  **GitHub Pages cannot**, so the opus-mt tier is undeployable there. The built-in API is
  unaffected.
- **Wikipedia anonymous CORS** requires `origin=*` and *no* custom request headers.
- **Reddit JSON works client-side** with no auth or proxy; send `raw_json=1`. Anonymous requests
  are rate-limited, so fetch once per batch.
- **DYK archive pages are `Wikipedia:Did you know archive/YYYY/Month`.** Fetch with
  `action=parse&prop=wikitext` — hooks live in templated wikitext, not a rendered extract.
