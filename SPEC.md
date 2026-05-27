# SPEC.md

Single-file spec. Split into `specs/` once this exceeds ~400 lines.

## One-line description

A browser-only feed of human-curated facts — Wikipedia "Did you know?", Reddit TIL, and
factroom.ru — served as a TikTok-style vertical scroll, translated on-device into the reader's
language.

## Why in-browser

Stating the "why" prevents agents from drifting toward server-side shortcuts.

- **Privacy**: nothing the user reads or scrolls leaves the device. There is no analytics, no
  account, and no server of ours at all.
- **Cost**: no inference billing and no backend to run — the app is static files.
- **Latency**: facts are fetched and rendered directly; nothing waits on a model.

If a proposed change weakens any of these without an explicit decision in `DECISIONS.md`, it's the
wrong change.

> Facts are read live from three public sources (Wikipedia, Reddit, factroom.ru). Those are the
> app's only network dependencies, apart from translation weights on the fallback path.

## Users and core flows

1. **First run.** User lands on an intro: what the app is, where facts come from, that nothing
   leaves the browser, and a language picker. One click starts the feed. The intro is shown
   **once** — it is persisted, so returning visitors land straight in the feed, and a shared link
   skips it entirely.
2. **Scroll the feed.** One fact-post fills the viewport (vertical scroll-snap). Each post shows
   the fact, its source label, a "Read on …" link, and a Share button. A **Home** control returns
   to the intro without losing the reading position or re-arming the intro for future visits.
3. **Infinite load.** Each batch pulls 3 facts from each source, shuffled together. Nearing the end
   (within 6 posts) loads a new batch, never re-reading a source item.
4. **Return / share.** Posts persist in IndexedDB, so returning restores the feed and position. The
   current post is reflected into the URL, so any post is a shareable, self-contained link.
5. **Language.** Set on the intro and changeable any time from the feed's top bar (one shared
   `LanguagePicker`, always visible). Defaults to English; the choice is persisted. Facts not
   already in that language are translated on-device. Where a language pair cannot be translated
   here, the setting instead decides **which sources are fetched** — so the control matters more
   there, not less, and is never hidden.

## Non-goals

- Not a chatbot UI, and not an LLM app — no generative model runs here. The only models are
  translation models, and only on the fallback path.
- Not a wrapper around remote inference APIs.
- Not multi-user; no accounts.
- Not a Wikipedia mirror, and not a fact *extractor* — every fact shown was written and curated by
  a human.

## Facts are shown verbatim

The three sources are human-written and already clean: `dyk.js` strips the leading `... that` and
trailing `?` from archive wikitext, `til.js` strips the `TIL` prefix and capitalises, and
`factroom.js` takes the opening paragraph of the rendered post body. Posts render that text
unchanged.

factroom deliberately reads `content` rather than `excerpt`: WordPress cuts the excerpt to a fixed
word count and caps it with "… Читать далее", which lands mid-sentence on about half of all posts.
The opening paragraph of `content` is the fact in full. A paragraph longer than the cap belongs to
an article rather than a self-contained fact, so it is skipped — a fact is never shown cut short.

This is a correctness property, not just simplicity. DYK hooks are source-cited and human-reviewed;
any machine rewriting of them can only reduce fidelity. Translation is the only text transformation
the app performs, and the original is always retained alongside it and reachable from the post.

## Capability matrix

| Capability | Required? | Fallback if missing |
|---|---|---|
| `fetch` to Wikipedia / Reddit / factroom (CORS) | Required | No content; each source degrades independently to an empty batch |
| IndexedDB | Required | Feed persistence + source dedup; no graceful fallback yet |
| Built-in `Translator` API | Preferred | Falls through to opus-mt for that pair |
| `Worker` + an ONNX session (opus-mt) | Preferred | That pair is untranslatable; its sources are not fetched |
| `navigator.storage` (persistent) | Preferred | Feed may be evicted under storage pressure |

## Translation

Translation is routed **per language pair**, through backends tried in preference order. The first
that can handle a pair wins it, and the answer is remembered:

1. **Built-in `Translator` API** (Chrome/Edge 138+) — no download, on-device, and it covers pairs
   opus-mt does not publish at all.
2. **opus-mt via Transformers.js**, in a worker — the fallback, in practice Safari. First use of a
   pair downloads ~110 MB (`q8`) or ~155 MB (`q4f16`), cached after, with progress shown.
3. Neither → that pair is untranslatable here.

Whether opus-mt works is **discovered at runtime**: no API reports whether ONNX Runtime can build a
session on a given device, so `prepare()` attempts a load and the answer decides what the feed
contains.

Routing is per pair and never global. A single language with no available backend must not disable
translation for any other — that failure mode empties the feed for readers whose *other* pair was
working fine.

### Source gating

`feed.canRead(lang)` is true when `lang` is the reader's own language, or some backend can
translate `lang` into it. A source that fails it is not fetched.

The rule is symmetric: English gets no special treatment. A reader is either served facts they can
read, or told plainly why there are none.

Where the built-in API is present it covers the full language list, so all three sources are
served. Where opus-mt is the only backend, coverage is uneven, because `Xenova/opus-mt-en-*` is
published for most of the list while `opus-mt-ru-*` exists only for en/es/fr:

| Reader language | Sources served (opus-mt only) |
|---|---|
| English, Russian, Spanish, French | DYK + TIL + factroom |
| German, Italian, Chinese, Hindi, Arabic, Indonesian | DYK + TIL — no factroom |
| Portuguese, Japanese, Korean | **none** — empty state naming the languages that work |

Because the setting decides content on those browsers, the language picker is always visible.

## Acceptance criteria

- [x] First run shows an intro explaining the app and offering a language; one click starts the feed.
- [x] Intro is shown once; returning visitors and shared links go straight to the feed.
- [x] Feed mixes all three sources, shuffled, 9 posts per batch.
- [x] Facts render verbatim, with the original reachable whenever a translation is shown.
- [x] Nearing the end loads a new batch of never-seen source items.
- [x] Posts persist in IndexedDB; returning restores the feed and scroll position.
- [x] Each post has a self-contained shareable URL.
- [x] Translation is routed per pair, so one unavailable pair cannot empty the feed.
- [x] Sources are gated on readability, symmetrically, so a reader is never served facts they
      cannot read.
- [ ] `npm run lint`, `npm run check` and `npm run test` pass.
- [ ] Verified end-to-end in a real browser on desktop and iOS.
- [ ] Built-in `Translator` output judged against opus-mt on live source text (`/translator-check`).

## Open questions

- **Built-in translation quality is unmeasured.** The backend order puts it first on the reasoning
  in `DECISIONS.md`, but that has not been checked against real output. `/translator-check` exists
  to settle it. If it loses, reversing `BACKENDS` in `translate/index.js` is a one-line change.
- **opus-mt's `ru→X` coverage is thin.** Only es/fr/en are published, so on Safari the only source
  with images drops out for most languages. Whether to add a second image-bearing source, accept
  it, or pivot `ru→en→X` (doubling translation error) is undecided.
- **Three languages get nothing on Safari.** Portuguese, Japanese and Korean have no published
  `opus-mt-en-*` either. Adding sources in more languages, or accepting a fallback language by
  explicit choice, are both open.
- **Already-saved posts are not re-filtered.** The gate applies when fetching, so a reader who
  switches to a language they can no longer read keeps posts already in their feed.
- **First-use download has no "not now".** The opus-mt path starts a ~110 MB download with progress
  shown but no consent step and no metered-connection warning.
- **Source balance.** Fixed 3 per source per batch. Whether that ratio reads well over a long
  scroll is untuned.
