<div
  bind:this={container}
  class="viewport relative h-dvh w-full snap-y snap-mandatory overflow-y-scroll"
  style={`--scroll-height: calc(${slots} * 100dvh)`}
  onscroll={onScroll}
>
  {#each windowed as item (item.post.id)}
    {@const heading = item.post.external
      ? 'Shared fact'
      : `Fact #${externalIndex !== -1 && item.index > externalIndex ? item.index : item.index + 1}`
    }
    <div
      data-post-index={item.index}
      class="absolute inset-x-0 h-dvh snap-start snap-always"
      style={`top: calc(${item.index} * 100dvh)`}
    >
      <Post post={item.post} {heading} language={feed.language} />
    </div>
  {/each}

  {#if feed.loading}
    <div
      class="absolute inset-x-0 flex h-dvh snap-start flex-col items-center justify-center gap-4 px-6 text-center"
      style={`top: calc(${feed.posts.length} * 100dvh)`}
    >
      <div class="size-8 animate-spin rounded-full border-2 border-white/15 border-t-amber-400"></div>
      <p class="text-sm text-white/50">Gathering facts…</p>
    </div>
  {:else if feed.posts.length === 0}
    <div class="flex h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
      {#if !feed.hasReadableSource}
        <p class="max-w-xs text-white/60">
          Nothing to show in {languageName(feed.language)}.
        </p>
        <p class="max-w-xs text-sm text-white/40">
          <!-- eslint-disable-next-line max-len -->
          Nothing could be translated into {languageName(feed.language)} on this device, and no source publishes in it. Facts are written in {feed.readableLanguages} — pick one to start reading.
        </p>
      {:else}
        <p class="text-white/60">No facts right now.</p>
        <button
          type="button"
          class="rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20"
          onclick={() => feed.loadMore()}
        >
          Try again
        </button>
      {/if}
    </div>
  {/if}
</div>

<button
  type="button"
  class="fixed left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/20"
  onclick={() => feed.goHome()}
>
  ← Home
</button>

{#if feed.translatorProgress.active}
  <!-- eslint-disable-next-line max-len -->
  <p class="fixed inset-x-0 top-4 z-0 mx-auto w-fit max-w-[70vw] rounded-full bg-white/10 px-3 py-1.5 text-center text-xs text-white/60 backdrop-blur">
    {feed.translatorProgress.pct > 0
      ? `Setting up translation… ${feed.translatorProgress.pct}%`
      : 'Setting up translation…'}
  </p>
{/if}

<div class="fixed right-4 top-4 z-10 flex items-center gap-2">
  <LanguagePicker compact />

  {#if feed.posts.length > 0}
    <button
      type="button"
      class="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/20"
      onclick={clear}
    >
      Clear feed
    </button>
  {/if}
</div>

{#if feed.error}
  <div class="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-6">
    <p class="pointer-events-auto rounded-full bg-red-500/90 px-4 py-2 text-sm text-white">
      {feed.error}
    </p>
  </div>
{/if}

<script>
  import { feed } from '$lib/feed/feed.svelte.js'
  import { languageName } from '$lib/i18n/languages.js'
  import LanguagePicker from './LanguagePicker.svelte'
  import Post from './Post.svelte'

  const BUFFER = 3

  /**
   * @type {HTMLElement|null}
   */
  let container = $state(null)

  let current = $state(feed.currentIndex)
  let resumed = false
  let lastCleared = feed.cleared

  const externalIndex = $derived(feed.posts.findIndex(p => p.external === true))

  const slots = $derived(feed.posts.length + (feed.loading ? 1 : 0))
  const start = $derived(Math.max(0, current - BUFFER))
  const end = $derived(Math.min(feed.posts.length, current + BUFFER + 1))
  const windowed = $derived(
    feed.posts.slice(start, end).map((post, k) => {
      return { post, index: start + k }
    })
  )

  let raf = 0

  const onScroll = () => {
    if (raf || !container)
      return

    raf = requestAnimationFrame(() => {
      raf = 0

      if (!container)
        return

      const h = container.clientHeight || 1
      const idx = Math.round(container.scrollTop / h)

      if (idx !== current) {
        current = idx
        feed.setCurrent(idx)
      }
    })
  }

  const clear = () => { void feed.clear() }

  $effect(() => {
    if (!container || resumed || feed.posts.length === 0)
      return

    resumed = true

    const h = container.clientHeight || 1
    container.scrollTop = feed.currentIndex * h
    current = feed.currentIndex
    feed.setCurrent(feed.currentIndex)
  })

  $effect(() => {
    if (feed.cleared === lastCleared)
      return

    lastCleared = feed.cleared
    current = 0

    if (container)
      container.scrollTop = 0
  })
</script>

<style>
  .viewport::after {
    content: '';
    display: block;
    height: var(--scroll-height);
  }
</style>
