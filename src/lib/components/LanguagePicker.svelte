<div class={compact ? 'relative inline-flex' : 'relative w-full'}>
  <select
    value={feed.language}
    aria-label="Language"
    class={`truncate pe-7 focus:outline-none ${compact
      ? `max-w-36 rounded-full bg-white/10 ps-3 py-1.5 text-xs font-medium text-white/80
      backdrop-blur transition hover:bg-white/20`
      : `w-full rounded-lg border border-white/10 bg-white/5 ps-3 py-2 text-sm text-white
      focus:border-amber-400/50`}`}
    onchange={e => feed.setLanguage(e.currentTarget.value)}
  >
    {#each LANGUAGES as lang (lang.code)}
      <option value={lang.code} class="bg-neutral-900 text-white">
        {compact || lang.code === 'en' ? lang.label : `${lang.label} · ${lang.name}`}
      </option>
    {/each}
  </select>

  <svg
    class="pointer-events-none absolute inset-e-2.5 top-1/2 size-3 -translate-y-1/2 text-white/45"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
  >
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
      stroke-linejoin="round" />
  </svg>
</div>

{#if !compact && missing.length > 0 && feed.hasReadableSource}
  <span class="text-white/30">
  <!-- eslint-disable-next-line max-len -->
    Facts written in {missing.join(' and ')} can't be translated on this device, so they're left out. Everything else still reads in {languageName(feed.language)}.
  </span>
{/if}

<script>
  import { feed } from '$lib/feed/feed.svelte.js'
  import { LANGUAGES, languageName } from '$lib/i18n/languages.js'

  /**
   * @typedef {Object} Props
   * @property {boolean} [compact]
   */

  /**
   * @type {Props}
   */
  let { compact = false } = $props()

  const missing = $derived(feed.unreadableLanguages)
</script>

<style>
  select {
    appearance: none;
    field-sizing: content;
  }
</style>
