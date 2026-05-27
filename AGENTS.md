# AGENTS.md

Context for AI coding agents working in this repo. Read this first.

## What this project is

A Svelte web app showing a vertical-scroll feed of human-curated facts, pulled live from three
public sources and translated on-device into the reader's language. It is a static site: no
backend, no accounts, no analytics, and **no generative model**. The only models are translation
models, and only on the fallback path.

## Stack

- **Framework**: Svelte 5 (runes mode forced project-wide via `svelte.config.js`), SvelteKit +
  `adapter-static` with SPA fallback (`fallback: 'index.html'`, `ssr = false`).
- **Build**: Vite 8; Tailwind 4 (via `@tailwindcss/vite`, imported in `src/routes/layout.css`).
- **Language**: JavaScript + JSDoc types, typechecked with `svelte-check` (`checkJs`, `strict`). No
  `.ts` files — annotate with JSDoc and cast with `/** @type {...} */ (expr)`.
- **Runtime dependencies**: `@huggingface/transformers`, used *only* for opus-mt translation in
  `src/lib/translate/`. Not a general model runtime, and must not become one.
- **Package manager**: npm (`package-lock.json`, `engine-strict`).

## Architecture map

- `src/lib/sources/` — the three fact sources and the registry that batches them.
  - `shared.js` — the `Fact` and `Source` shapes plus cleaning helpers (`shuffle`,
    `decodeEntities`, `stripHtml`, `clampToSentences`, `orEmpty`). Put anything two sources need
    here rather than copying it.
  - `dyk.js` / `til.js` / `factroom.js` — one `Source` each.
  - `index.js` — `SOURCES`, `SOURCE_LANGS` (derived), and `fetchBatch(canRead, exclude)`.
- `src/lib/facts/posts.js` — the `Post` shape and `buildPosts`. Assigns identity; never touches
  fact text.
- `src/lib/translate/` — `index.js` (the per-pair router), `builtin.js` (browser `Translator` API),
  `opus.js` (opus-mt), `client.js` (worker RPC), `worker.js` (pipeline + dtype ladder),
  `protocol.js` (typed messages).
- `src/lib/capabilities/` — `storage.js`, `debug.js` (the one sanctioned console channel).
  Capability-module pattern; no raw `navigator.*` elsewhere.
- `src/lib/feed/feed.svelte.js` — runes `FeedStore` singleton: restore, load-more, prefetch,
  translation loop, and the `canRead` gate.
- `src/lib/db/articles.js` — IndexedDB: source dedup + persisted posts + cursor + language.
- `src/lib/i18n/languages.js` — the language list, display labels, RTL flags.
- `src/lib/hash.js` — cyrb53 hashing (dedup key + post id).
- `src/lib/routing.js` — encode/decode the shareable post URL; reflect the current post into history.
- `src/lib/components/` — `Intro`, `Feed`, `Post`, `LanguagePicker` (shared by intro and feed).
  Entry: `src/routes/+page.svelte`.
- `src/routes/translator-check/` — diagnostic harness, not part of the app. See "Open question".

## Non-obvious constraints

These trip up agents that pattern-match to "normal" web apps:

- **Facts are shown verbatim. Never add a rewriting step.** Sources are human-written and
  DYK hooks are source-cited and human-reviewed. Any paraphrase — by a model or by clever string
  munging — can only reduce fidelity. Translation is the sole permitted transformation, and it
  keeps the original. This is a correctness rule, not a style preference.
- **No generative model, and no reintroducing one casually.** If a task seems to want generated or
  rewritten text, flag it and read `DECISIONS.md` first.
- **No server calls to OpenAI/Anthropic/etc.** Nothing the user reads leaves the device. A remote
  translation API would break this and was explicitly rejected.
- **Translation is routed per language pair, never globally.** One pair with no backend must not
  disable another. `feed.pairs` holds a state *per source language*; anything that collapses it to
  a single flag will empty the feed for readers whose other pair was working fine.
- **Translation is best-effort.** `translate()` returns `null` whenever no backend can handle a
  pair. Callers must leave the text as-is and carry on; never surface it as a failure.
- **Translation support is discovered, not detected.** No API reports whether ONNX Runtime can
  build a session here; only trying does. `prepare()` *is* the detection. Never assume translation
  will work and fetch on that basis — that is how readers end up with facts they cannot read.
- **Never hide the language picker.** Where a pair cannot be translated, the language setting
  decides which *sources* are fetched, so that is exactly when the reader most needs the control.
- **Sources are gated on readability, not filtered at render.** `feed.canRead(lang)` decides
  whether a source is *fetched at all*. The gate is symmetric — English is **not** a privileged
  fallback, and a reader of no available language correctly gets an empty feed with an explanation.
- **Each source must degrade independently.** A source that errors returns `[]` so a batch falls
  back to the others rather than failing the feed. `orEmpty` in `sources/shared.js` does this.
- **A passing Node test is not evidence about Safari.** opus-mt `q8` loads fine under
  `onnxruntime-node` and is rejected outright by Safari's WASM build. Node can rule a rung *out* (as
  it did for the broken `fp16` export), never *in*. Verify dtypes on the target browser.

## Open question an agent should know about

The backend order — built-in `Translator` API ahead of opus-mt — is **an assumption, not a
measurement**. See the 2026-07-22 entry in `DECISIONS.md`. `/translator-check` runs both backends
over live source text to settle it. If built-in output turns out to be bad, the fix is to reorder
`BACKENDS` in `translate/index.js`, and that harness route can then be deleted.

Do not "fix" the ordering, or delete `builtin.js`, on the basis of an anecdote. Run the harness.

## Conventions

- **Components**: PascalCase, one component per file, colocated styles. Markup first, then
  `<script>`, then `<style>`.
- **Stores / runes**: keep feed state out of components; centralize in `src/lib/feed/`.
- **Capabilities pattern**: every Browser API access goes through a module exposing `{ supported |
  possible, ... }`. No raw `navigator.*` calls in components.
- **Errors**: user-visible errors are typed and translatable; never surface raw exception messages.
- **No `any`.** Use `unknown` and narrow.

## Commands

```
npm run dev        # vite dev (https if dev_ssl.json present)
npm run dev:host   # same, exposed on the LAN for phone testing
npm run build      # production build -> build/ (adapter-static SPA)
npm run preview    # preview the production build
npm run check      # svelte-kit sync && svelte-check (typecheck)
npm run lint       # eslint .
npm run test       # vitest (node)
```

Agents: run `npm run lint` and `npm run check` before declaring a task done.

## Things that have bitten us

- **ESLint bans `for..of` and `for..in`** (`no-restricted-syntax`). Use array methods
  (`.forEach`/`.map`/`.reduce`) or a classic `for (let i…)`.
- **`no-console` is an error.** Surface state through `capabilities/debug.js` or UI, not `console.*`.
- **WebKit throttles `history.replaceState` to ~100 per 30 s and then throws.** Reflecting every
  scrolled post into the URL blew past this on a fast flick, and the throw aborted `setCurrent`
  before the infinite-scroll prefetch. `routing.js` coalesces writes (trailing, 400 ms) and
  swallows the error.
- **`vite dev` reloads the page by itself when its HMR socket drops** (`vite:ws:disconnect` →
  `location.reload()`, in Vite's injected dev client — not in our source, and absent from
  production builds). Phone testing hits this constantly: locking the screen drops the socket.
  Debug any reload/restart report against `npm run preview:host`, never `npm run dev:host`.
  Grepping `src/` for `location.reload` is not enough to rule it out.
- **Serving to a phone needs HTTPS, not just `--host`.** `localhost` is a secure context by
  exemption; a LAN IP is not. Without the `dev_ssl.json` certs the phone silently loses IndexedDB
  persistence and the `Translator` API. Both `server.https` and `preview.https` are wired to them.
- **iOS could not construct an ONNX session for any generative model tried** (both WebGPU and WASM,
  down to 260 MB), and the tab is killed with no exception — it just reloads. This is why the size
  and backend of the translation pair are pinned where they are, and why anyone proposing a larger
  model needs to measure first.
- **Safari needs COOP/COEP to fetch anything that cross-origin-redirects.** Hugging Face weight
  files 302 to a second origin; Safari fails that redirect from a Worker with "Fetch API cannot
  load … due to access control checks" while same-repo JSON loads fine. Server CORS is correct on
  both hops. The Vite middleware sets the headers — but **GitHub Pages cannot set custom headers**,
  so the opus-mt tier is undeployable there.
- **opus-mt coverage is uneven and asymmetric.** `Xenova/opus-mt-en-*` exists for
  zh/hi/es/fr/ar/ru/id/de/it but not pt/ja/ko; `opus-mt-ru-*` exists only for es/fr/en. Check
  before assuming a pair works. `q4f16` is *larger* than `q8` for these repos — it is a
  compatibility rung, not a smaller one.
- **A `Translator` instance is bound to the pair it was created with.** Reusing one across source
  languages returns confident garbage rather than an error. Always pass `sourceLanguage` explicitly
  and cache per pair.
- **Wikipedia anonymous CORS** requires `origin=*` and *no* custom request headers (an
  `Api-User-Agent` header forces a preflight). Browsers can't set `User-Agent`.
- **Reddit JSON (`www.reddit.com/r/*/top.json`) works client-side with no auth or proxy** — it
  returns `Access-Control-Allow-Origin: *` and a browser's own User-Agent is accepted (only
  empty/bot UAs get 403'd, which is why `curl` without a UA fails but the app doesn't). Send
  `raw_json=1` to skip HTML-entity encoding. Anonymous requests are rate-limited, so fetch once per
  batch, not per item.
- **DYK archive pages are `Wikipedia:Did you know archive/YYYY/Month`** (the old
  `Wikipedia:Recent additions/...` titles now redirect). Fetch hooks with
  `action=parse&prop=wikitext`, not `extracts` — they live in templated wikitext, not a rendered
  extract. A not-yet-written future month returns an API `error`; `dyk.js` treats that as empty,
  not fatal.

## Out of scope

- Server-side anything (there is no server)
- Auth, accounts, payments
- Mobile native wrappers
- Generating or rewriting fact text
