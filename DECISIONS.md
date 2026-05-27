# DECISIONS.md

Append-only log of meaningful technical decisions. Newest at the top. Don't edit old entries — supersede them with a new one and link.

Format:

```
## YYYY-MM-DD — Short title

**Status**: accepted | superseded by [#N]
**Context**: what forced this decision
**Decision**: what we picked
**Alternatives considered**: with one-line reasons for rejection
**Consequences**: what this makes easier / harder
```

---

## 2026-07-22 — Route translation per language pair, best backend first

**Status**: accepted
**Context**: Translation is what makes a mixed-source feed coherent — factroom publishes in Russian, DYK and TIL in English, so most readers cannot read part of the feed unmodified. Two constraints shape how it can be done. **Coverage is uneven**: `Xenova` publishes `opus-mt-en-*` for zh/hi/es/fr/ar/ru/id/de/it but no pt/ja/ko, and `opus-mt-ru-*` for only es/fr/en — measured against the Hugging Face API, not assumed. **Loadability is device-specific**: Safari's ONNX Runtime WASM build rejects quantisations that load fine under `onnxruntime-node`, and iOS has been observed killing tabs constructing sessions from 260 MB up, so nothing can be inferred from a passing local test.
**Decision**: One router (`translate/index.js`) over a small backend interface (`possible`, `prepare`, `translate`). Backends are tried in preference order per pair and the winner is remembered: the browser's built-in **`Translator` API** first (no download, on-device, covers pairs opus-mt does not publish), then **opus-mt via Transformers.js** in a worker. The dtype ladder is `q8` → `q4f16`; `fp16` is excluded (broken export, fails under Node too) and `fp32` is excluded as unsafe at 415 MB with a 220 MB single session. Crucially, routing is **per pair and never global** — a pair with no backend must not disable any other pair.
**Alternatives considered**:
- _opus-mt only_: purpose-built and often good, but it cannot serve pt/ja/ko at all and barely serves anything out of Russian, and it costs a ~110 MB download per pair on exactly the mobile devices least able to afford it.
- _Built-in API only_: free and broad, but absent on Safari/iOS, which would leave the platform with no translation and a feed gated down to one language.
- _A single global `ready | unavailable` flag_: much simpler, and wrong. With `opus-mt-ru-de` unpublished, one missing model would gate off the English sources too and hand a German reader an empty feed on a fully capable browser.
- _Pivoting `ru→en→X` through two models_: composes existing pairs to fill the coverage gap, at the cost of running the output of one MT model through another. Rejected on quality; revisit only if the gap proves worse than the degradation.
- _A remote translation service_: the only option that is good everywhere, and the only one that breaks "nothing you read leaves the browser". Rejected on the spec's first principle.
**Consequences**:
- Easier: readers get the best backend their browser offers, per pair, with no download wherever the built-in API exists. Adding or reordering a backend is a one-line change to `BACKENDS`. A missing model degrades one source for one reader instead of emptying the feed.
- Harder: two translation paths to reason about, and `@huggingface/transformers` plus a worker and COOP/COEP middleware stay in the tree for the fallback. **Built-in output quality is unverified** — see the next entry. Startup waits on a pair probe before the first batch, so the opus-mt path delays the feed rather than filling it with untranslatable posts.

---

## 2026-07-22 — Put the built-in `Translator` API ahead of opus-mt, and test that

**Status**: accepted, pending measurement
**Context**: Backend order is the single biggest lever on translation quality, and it was set on reasoning rather than evidence. There is a report of the built-in API producing ru→en output that "barely parsed". That symptom — confident, fluent-looking, wrong — is characteristic of a *construction* bug rather than a model one: a `Translator` instance is bound to the exact pair it was created with, so feeding it text in a different source language returns garbage instead of an error. Reusing one instance across source languages, or omitting an explicit `sourceLanguage`, both produce exactly that.
**Decision**: Order the backends built-in first, and make `translate/builtin.js` strict about the three things most likely to have caused that report: one cached instance **per pair**, `sourceLanguage` always passed explicitly, and one `translate()` call per fact rather than several concatenated. Ship `/translator-check`, a harness that runs both backends over live text from the real sources, so the ordering can be judged on output instead of argument.
**Alternatives considered**:
- _Keep the built-in API out entirely_: safe against the reported symptom, but it would put opus-mt — with no pt/ja/ko and almost no `ru→X` — in front of every reader, including the ones who have a better option available for free.
- _Ship it second, behind opus-mt_: costs a ~110 MB download to reach a backend that may well be worse, on the devices least able to afford it.
- _Decide after measuring_: the honest order, but it blocks everything else on a manual browser session. Shipping the harness alongside the assumption gets the same answer without stalling.
**Consequences**:
- Easier: most readers get high-quality translation with no download, and the coverage holes in opus-mt stop mattering wherever the built-in API exists. The claim is falsifiable in about five minutes with the harness.
- Harder: **this is an assumption in production until someone runs the harness.** If built-in output is genuinely bad, readers on Chrome see it first. Reversing `BACKENDS` is one line, but the decision to reverse needs the measurement. `/translator-check` and `translate/builtin.js` both carry pointers back to this entry.

---

## 2026-07-22 — Gate sources on readability, symmetrically

**Status**: accepted
**Context**: The feed mixes languages by construction. Without a rule about what to fetch, a reader set to English receives Russian facts they cannot read, with no explanation and no way to act on it. Filtering at render is worse than useless — it burns the fetch, the dedup entry and the storage write, then hides the result.
**Decision**: `feed.canRead(lang)` decides whether a source is **fetched at all**: true when `lang` is the reader's own language, or when some backend can translate `lang` into it. The rule is **symmetric** — English is not a privileged fallback. A reader whose language nothing can reach gets an empty feed with an explanation naming the languages that do work, rather than facts they did not ask for.
**Alternatives considered**:
- _Fall back to English when nothing else is readable_: the obvious default, and precisely the bug this exists to prevent. It would be no less a bug in English than in Russian.
- _Fetch everything and filter at render_: spends the request anyway, and leaves the reader watching a feed silently drop most of its posts.
- _Hide the language picker where translation is unavailable_: backwards. That is exactly when the setting is load-bearing, because it decides which sources you get.
**Consequences**:
- Easier: whatever a reader sees, they can read it. The empty state is legible and actionable instead of looking broken.
- Harder: some readers get a smaller, plainer feed — on Safari, most languages lose factroom, which is the only source carrying images. Three languages get nothing at all there. Posts already saved are not re-filtered, since the gate applies at fetch time, so switching language leaves older unreadable posts in place.

---

## 2026-07-22 — One source registry instead of per-source wiring

**Status**: accepted
**Context**: Three sources with different shapes (a Wikipedia hook, a Reddit title, a WordPress excerpt) invite three of everything: per-source batch constants, per-source booleans in the feed store, a hand-written `Promise.all`, and a post builder per shape. That spreads a "add a fourth source" change across the whole data path, and lets shared helpers drift apart in three copies.
**Decision**: Every source produces the same `Fact` shape and exposes the same `Source` descriptor (`id`, `label`, `lang`, `perBatch`, `fetch`). `sources/index.js` holds the registry; `fetchBatch(canRead, exclude)` filters by readability, fetches in parallel, and flattens. Shared cleaning helpers live in `sources/shared.js`. `SOURCE_LANGS` is derived from the registry rather than declared. Each source's fetch is wrapped so a failure contributes an empty list rather than failing the batch.
**Alternatives considered**:
- _Keep per-source branching in the feed store_: no abstraction to learn, but the feed store then knows the name of every source, and gating logic gets restated once per source.
- _A plugin system with registration hooks_: more machinery than three static sources justify.
**Consequences**:
- Easier: adding a source is one file plus one array entry, with no feed-store edit. Gating, dedup and error isolation are uniform and testable without the network. One post builder instead of two.
- Harder: a source with genuinely different needs (paging, auth, per-item fetches) has to fit the `fetch(count, exclude)` shape or force the interface to grow.

---

## 2026-07-22 — Facts are shown verbatim; no generative model

**Status**: accepted
**Context**: A feed of facts lives or dies on fidelity. All three sources are human-written, and DYK hooks in particular are source-cited and human-reviewed. Any rewriting step — a model asked to "improve phrasing", or clever string munging — can only move the text away from what a person checked, and does so invisibly.
**Decision**: Fact text is transformed exactly once, at parse time, to remove source scaffolding (`... that`, the `TIL` prefix, WordPress markup and its "Читать далее" tail). After that it is rendered unchanged. **Translation is the only permitted transformation**, and it never replaces the original: the post keeps `fact` in its canonical language and stores translations alongside, reachable from the UI. No generative model runs in this app.
**Alternatives considered**:
- _A small local LLM to normalise or rephrase hooks_: the sources already arrive normalised, so it would spend a large download to produce text that must then be checked against the original for faithfulness — and rejected when it fails.
- _Extracting facts from arbitrary article text_: turns a curated feed into a generated one and puts an unreviewed claim in front of a reader.
**Consequences**:
- Easier: fidelity is a property of the architecture rather than of a prompt. No model download on the default path, no eval harness, no faithfulness checker.
- Harder: content is bounded by what the three sources publish. Reintroducing generated text later means bringing back a whole runtime, not flipping a flag.

---

## 2026-07-22 — Node-only tests over pure logic

**Status**: accepted
**Context**: The behaviour most worth testing is capability-dependent — what happens when a browser *cannot* translate a pair. That is close to untestable in a real browser: Chromium ships the `Translator` API, so `vi.stubGlobal` cannot remove it, the stub silently fails to apply, and the test passes for the wrong reason. Meanwhile a browser test project costs a Playwright dependency and a much slower run.
**Decision**: Vitest in Node only, over logic kept deliberately DOM-free: source cleaning, batch gating, post building, and backend routing. Capability modules are mocked at the module boundary, where absence can actually be simulated. Anything that genuinely needs a browser — scroll-snap behaviour, the `Translator` API's real output, whether an ONNX session builds — is verified by hand and recorded here, because a passing Node test is not evidence about Safari.
**Alternatives considered**:
- _Keep a browser test project_: it can exercise components, but not the capability-absence cases that matter most, and it invites tests that look like coverage while asserting nothing real.
- _No tests_: the routing logic has already proven subtle enough to warrant them.
**Consequences**:
- Easier: fast suite, no browser dependency, and the tests that exist assert things that can actually be false.
- Harder: no automated coverage of components or scroll behaviour. Device-specific claims need a manual run, and there is no CI gate that would catch a regression in one.

---

## 2026-05-27 — Read all three sources live from the browser, with no proxy

**Status**: accepted
**Context**: The app has no backend, so every source must be reachable from a page with anonymous CORS. Each of the three needs something specific to work that way, and each has a failure mode that looks like a bug elsewhere.
**Decision**: Fetch all three directly. **Wikipedia**: `action=parse&prop=wikitext` against `Wikipedia:Did you know archive/YYYY/Month`, with `origin=*` and no custom headers — an `Api-User-Agent` header forces a preflight the API does not answer. **Reddit**: `www.reddit.com/r/todayilearned/top.json` with `raw_json=1`; it returns `Access-Control-Allow-Origin: *` and accepts a browser's own User-Agent. **factroom**: the WordPress REST API, which echoes the request Origin. A random archive page / listing page per batch supplies variety without server-side state.
**Alternatives considered**:
- _A proxy or serverless function_: fixes CORS and rate limits in one move, and reintroduces the server this project exists without — along with a log of what everyone reads.
- _Wikipedia `extracts` instead of `wikitext`_: hooks live in templated wikitext and do not appear in a rendered extract.
- _Bundling a static fact corpus_: no network dependency and no rate limits, but the feed stops being live and the sources stop being attributable.
**Consequences**:
- Easier: three live, human-curated sources with no infrastructure at all.
- Harder: three third-party APIs that can change or fail independently, which is why each source degrades to an empty batch. Reddit rate-limits anonymous requests, so batches fetch one listing rather than one request per item. A not-yet-written DYK archive month returns an API `error`, treated as empty rather than fatal.

---

## 2026-05-27 — Client-only SPA with self-contained shareable post URLs

**Status**: accepted
**Context**: The feed is client-only state (IndexedDB, scroll position), and any post should be shareable — but there is no server to resolve a share link against, and no database a recipient could read.
**Decision**: `adapter-static` with an `index.html` SPA fallback and `ssr = false`. A shared post is encoded **into the URL itself** as a base64url JSON payload (`?p=`), carrying the fact, its language, link and image, so the link resolves with no lookup. A shared link skips the intro: that visitor came for a specific fact. The current post is reflected into history as the reader scrolls.
**Alternatives considered**:
- _Server-rendered share pages with OG tags_: better link previews, and it needs the server this project does not have.
- _Share a source URL only_: loses the exact fact, which is the thing being shared.
**Consequences**:
- Easier: deployable as static files anywhere; every post is a durable link that works without us.
- Harder: share URLs are long and their content is visible in the link. No social preview cards. **WebKit throttles history state changes to ~100 per 30 s and then throws** — a fast flick crosses far more indices than that, and the throw would abort mid-scroll, so `routing.js` coalesces writes (trailing, 400 ms) and swallows the error.

---

## 2026-05-27 — Cross-origin isolation via COEP `credentialless`

**Status**: accepted
**Context**: Safari refuses Hugging Face's weight fetches without it: the files 302-redirect to a second origin, and Safari rejects that redirect from inside a Worker with "Fetch API cannot load … due to access control checks", while same-repo JSON loads fine. Server CORS is correct on both hops.
**Decision**: Send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` from Vite middleware, on dev and preview alike — `server.headers` does not cover SvelteKit's HTML response, so it has to be middleware. `credentialless` loads cross-origin subresources without credentials and without requiring CORP.
**Alternatives considered**:
- _`require-corp`_: stricter, and it would require CORP headers we do not control on the weight host.
- _Proxy the weights_: reintroduces a server and pays the bandwidth.
**Consequences**:
- Easier: the opus-mt fallback works on the browser that most needs it.
- Harder: **GitHub Pages cannot set custom headers**, so the opus-mt tier is undeployable there — that host degrades to the built-in API plus source gating, which is a supported state rather than a breakage. Relevant again for any future feature fetching large cross-origin assets.
