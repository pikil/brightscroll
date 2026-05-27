<div class="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-10 px-6 py-12">
  <header class="flex flex-col gap-2">
    <h1 class="text-2xl font-semibold text-white">Translator check</h1>
    <p class="text-sm leading-relaxed text-white/60">
      Built-in <code class="text-amber-400/90">Translator</code> API vs opus-mt, on live facts from the real sources. Not part of the app.
    </p>
    <p class="text-sm text-white/50">
      Built-in API: {builtinPossible
        ? 'present in this browser'
        : 'not present — run this in Chrome/Edge 138+ over HTTPS'}
    </p>
  </header>

  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-lg font-medium text-white">1 · Pair coverage</h2>
      <button type="button" onclick={checkMatrix} disabled={matrixBusy} class={btn}>
        {matrixBusy ? 'Checking…' : 'Check availability'}
      </button>
    </div>

    {#if matrix.length > 0}
      <div class="overflow-x-auto">
        <table class="w-full min-w-lg border-collapse text-sm">
          <thead>
            <tr class="border-b border-white/10 text-left text-xs uppercase tracking-wider
              text-white/40">
              <th class="py-2 pe-4 font-medium">Language</th>
              <th class="py-2 pe-4 font-medium">en→X built-in</th>
              <th class="py-2 pe-4 font-medium">en→X opus-mt</th>
              <th class="py-2 pe-4 font-medium">ru→X built-in</th>
              <th class="py-2 font-medium">ru→X opus-mt</th>
            </tr>
          </thead>
          <tbody>
            {#each matrix as row (row.code)}
              <tr class="border-b border-white/5">
                <td class="py-2 pe-4 text-white/80">{row.label}</td>
                <td class="py-2 pe-4"><span class={chip(row.enBuiltin)}>{row.enBuiltin}</span></td>
                <td class="py-2 pe-4"><span class={chip(row.enOpus)}>{row.enOpus}</span></td>
                <td class="py-2 pe-4"><span class={chip(row.ruBuiltin)}>{row.ruBuiltin}</span></td>
                <td class="py-2"><span class={chip(row.ruOpus)}>{row.ruOpus}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-lg font-medium text-white">2 · Output quality</h2>

      <select bind:value={target} aria-label="Target language" class={btn}>
        {#each LANGUAGES as lang (lang.code)}
          <option value={lang.code} class="bg-neutral-900">{lang.label} · {lang.name}</option>
        {/each}
      </select>

      <button type="button" onclick={loadSamples} disabled={busy} class={btn}>
        Fetch live facts
      </button>

      <button
        type="button"
        onclick={() => run('builtin')}
        disabled={busy || samples.length === 0 || !builtinPossible}
        class="rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-200
          transition hover:bg-amber-400/30 disabled:opacity-40"
      >
        Run built-in
      </button>

      <button
        type="button"
        onclick={() => run('opus')}
        disabled={busy || samples.length === 0}
        class="rounded-full bg-sky-400/20 px-3 py-1.5 text-xs font-medium text-sky-200 transition
          hover:bg-sky-400/30 disabled:opacity-40"
      >
        Run opus-mt (downloads ~110 MB/pair)
      </button>

      {#if samples.length > 0}
        <button type="button" onclick={copyReport} class={btn}>
          {copied ? 'Copied' : 'Copy report'}
        </button>
      {/if}
    </div>

    {#if status}
      <p class="text-sm text-white/50">{status}</p>
    {/if}

    <div class="flex flex-col gap-4">
      {#each samples as s (s.key)}
        <article class="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/3 p-4">
          <p class="text-xs font-medium uppercase tracking-widest text-white/35">
            {s.source} · {s.lang} → {target}
          </p>

          <p dir={isRtl(s.lang) ? 'rtl' : null} class="text-sm leading-relaxed text-white/70">
            {s.text}
          </p>

          {#if s.builtin}
            <div class="flex flex-col gap-1 border-s-2 border-amber-400/40 ps-3">
              <span class="text-xs font-medium uppercase tracking-wider text-amber-400/70">
                built-in{s.builtinMs ? ` · ${s.builtinMs} ms` : ''}
              </span>
              <p dir={isRtl(target) ? 'rtl' : null} class="text-sm leading-relaxed text-white">
                {s.builtin}
              </p>
            </div>
          {/if}

          {#if s.opus}
            <div class="flex flex-col gap-1 border-s-2 border-sky-400/40 ps-3">
              <span class="text-xs font-medium uppercase tracking-wider text-sky-400/70">
                opus-mt{s.opusMs ? ` · ${s.opusMs} ms` : ''}
              </span>
              <p dir={isRtl(target) ? 'rtl' : null} class="text-sm leading-relaxed text-white">
                {s.opus}
              </p>
            </div>
          {/if}
        </article>
      {/each}
    </div>
  </section>
</div>

<script>
  import { LANGUAGES, isRtl } from '$lib/i18n/languages.js'
  import { SOURCES } from '$lib/sources/index.js'
  import * as builtin from '$lib/translate/builtin.js'
  import * as opus from '$lib/translate/opus.js'

  /**
   * @typedef {Object} Sample
   * @property {string} key
   * @property {string} source
   * @property {string} lang
   * @property {string} text
   * @property {string} [builtin]
   * @property {string} [opus]
   * @property {number} [builtinMs]
   * @property {number} [opusMs]
   */

  const btn = `rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition
    hover:bg-white/20 disabled:opacity-40`

  /**
   * @type {Record<string, string[]>}
   */
  const OPUS_PAIRS = Object.freeze({
    en: ['zh', 'hi', 'es', 'fr', 'ar', 'ru', 'id', 'de', 'it'],
    ru: ['es', 'fr', 'en']
  })

  const builtinPossible = builtin.possible

  /**
   * @type {{ code: string, label: string, enBuiltin: string, enOpus: string,
   *   ruBuiltin: string, ruOpus: string }[]}
   */
  let matrix = $state([])

  /** @type {Sample[]} */
  let samples = $state([])

  let target = $state('de')
  let busy = $state(false)
  let matrixBusy = $state(false)
  let status = $state('')
  let copied = $state(false)

  /**
   * @template T
   * @param {T[]} items
   * @param {(item: T, index: number) => Promise<void>} step
   * @returns {Promise<void>}
   */
  const series = (items, step) => items.reduce(
    (chain, item, i) => chain.then(() => step(item, i)),
    Promise.resolve()
  )

  /**
   * @param {string} state
   * @returns {string}
   */
  const chip = (state) => {
    const base = 'rounded px-1.5 py-0.5 text-xs font-medium'

    if (state === 'available' || state === 'published')
      return `${base} bg-emerald-400/15 text-emerald-300`

    if (state === 'downloadable' || state === 'downloading')
      return `${base} bg-amber-400/15 text-amber-300`

    if (state === 'same')
      return `${base} bg-white/5 text-white/30`

    return `${base} bg-rose-400/15 text-rose-300`
  }

  /**
   * @param {string} source
   * @param {string} code
   * @returns {string}
   */
  const opusStatus = (source, code) => {
    if (source === code)
      return 'same'

    return OPUS_PAIRS[source].includes(code) ? 'published' : 'unavailable'
  }

  const checkMatrix = async () => {
    matrixBusy = true

    matrix = await Promise.all(LANGUAGES.map(async (lang) => {
      const [enBuiltin, ruBuiltin] = await Promise.all([
        lang.code === 'en' ? Promise.resolve('same') : builtin.availability('en', lang.code),
        lang.code === 'ru' ? Promise.resolve('same') : builtin.availability('ru', lang.code)
      ])

      return {
        code: lang.code,
        label: `${lang.label} (${lang.code})`,
        enBuiltin,
        enOpus: opusStatus('en', lang.code),
        ruBuiltin,
        ruOpus: opusStatus('ru', lang.code)
      }
    }))

    matrixBusy = false
  }

  const loadSamples = async () => {
    busy = true
    status = 'Fetching live facts…'

    try {
      const batches = await Promise.all(
        SOURCES.map(s => s.fetch(4, () => false).catch(() => []))
      )

      samples = batches.flatMap((facts, i) => facts.map((f) => {
        return {
          key: `${SOURCES[i].id}-${f.key}`,
          source: SOURCES[i].label,
          lang: f.lang,
          text: f.fact
        }
      }))

      status = `${samples.length} facts loaded.`
    } catch (err) {
      status = err instanceof Error ? err.message : 'Could not fetch facts'
    } finally {
      busy = false
    }
  }

  /**
   * @param {'builtin' | 'opus'} which
   */
  const run = async (which) => {
    busy = true

    const backend = which === 'builtin' ? builtin : opus
    const pairs = [...new Set(samples.map(s => s.lang))].filter(l => l !== target)

    status = `Preparing ${which} (${pairs.map(l => `${l}→${target}`).join(', ')})…`

    await Promise.all(pairs.map(l => backend.prepare(l, target, (p) => {
      status = `Downloading ${which} weights… ${p.pct}%`
    })))

    status = `Translating with ${which}…`

    await series(samples.slice(), async (s, i) => {
      if (s.lang === target)
        return

      const started = performance.now()
      const out = await backend.translate(s.text, s.lang, target)
      const ms = Math.round(performance.now() - started)

      const patch = which === 'builtin'
        ? { builtin: out ?? '— unavailable for this pair —', builtinMs: ms }
        : { opus: out ?? '— no model published for this pair —', opusMs: ms }

      samples = samples.map((x, k) => (k === i ? { ...x, ...patch } : x))
    })

    status = `${which} pass complete.`
    busy = false
  }

  const copyReport = async () => {
    const lines = samples.map(s => [
      `### ${s.source} · ${s.lang} → ${target}`,
      '',
      `**Source:** ${s.text}`,
      '',
      `**Built-in** (${s.builtinMs ?? '—'} ms): ${s.builtin ?? '— not run —'}`,
      '',
      `**opus-mt** (${s.opusMs ?? '—'} ms): ${s.opus ?? '— not run —'}`,
      ''
    ].join('\n'))

    await navigator.clipboard.writeText(
      [`# Translator check · target ${target}`, '', ...lines].join('\n')
    )

    copied = true
    setTimeout(() => { copied = false }, 1500)
  }
</script>
