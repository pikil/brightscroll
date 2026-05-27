<article class="h-dvh w-full snap-start snap-always overflow-y-auto overflow-x-hidden">
  <div class="flex min-h-full w-full flex-col items-center justify-center px-6 py-10 sm:py-16">
    <div class="flex w-full max-w-xl flex-col gap-5 sm:gap-6">
      <p class="text-xs font-medium uppercase tracking-widest
        {post.external ? 'text-sky-400/90' : 'text-amber-400/80'}">
        {heading} · {post.title}
      </p>

      {#if post.image && !imageFailed}
        <img
          src={post.image}
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror={() => { imageFailed = true }}
          class="max-h-[40dvh] w-full rounded-xl object-cover"
        />
      {/if}

      <p dir={dir} class="text-2xl font-medium leading-snug text-white sm:text-3xl">
        {factText}
      </p>

      {#if translation}
        <details class="text-sm text-white/40">
          <summary class="cursor-pointer select-none transition hover:text-white/60">
            Show original ({languageName(post.lang)})
          </summary>
          <p dir={isRtl(post.lang) ? 'rtl' : null} class="mt-2 leading-relaxed">
            {post.fact}
          </p>
        </details>
      {/if}

      <div class="mt-2 flex items-center gap-3">
        <a
          href={post.link}
          target="_blank"
          class="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          rel="noopener noreferrer"
        >
          Read on {sourceLabel} ↗
        </a>
        <button
          type="button"
          class="rounded-full bg-amber-500/90 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-400"
          onclick={share}
        >
          {copied ? 'Link copied!' : 'Share'}
        </button>
      </div>
    </div>
  </div>
</article>

<script>
  import { encodePost } from '$lib/routing.js'
  import { isRtl, languageName } from '$lib/i18n/languages.js'

  /**
   * @typedef {Object} Props
   * @property {import('$lib/facts/posts.js').Post} post
   * @property {string} heading
   * @property {string} [language]
   */

  /**
   * @type {Props}
   */
  let {
    post,
    heading,
    language = 'en'
  } = $props()

  let copied = $state(false)
  let imageFailed = $state(false)

  const translation = $derived(post.translations?.[language])
  const factText = $derived(translation?.fact || post.fact)
  const shownLang = $derived(translation ? language : (post.lang ?? 'en'))
  const dir = $derived(isRtl(shownLang) ? 'rtl' : null)

  const sourceLabel = $derived.by(() => {
    try {
      return new URL(post.link || post.url).hostname.replace(/^www\./, '')
    } catch {
      return 'source'
    }
  })

  const shareUrl = () => `${location.origin}${location.pathname}?p=${encodePost(post)}`

  const share = async () => {
    const url = shareUrl()

    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.fact, url })
        return
      }

      await navigator.clipboard.writeText(url)

      copied = true
      setTimeout(() => { copied = false }, 1800)
    } catch {
      // User dismissed the share sheet, or clipboard denied — nothing to recover.
    }
  }
</script>
