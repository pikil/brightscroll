<div class="flex min-h-dvh w-full flex-col items-center justify-center px-6 py-16 text-center">
  <div class="flex w-full max-w-md flex-col items-center gap-6">
    <h1 class="text-4xl font-semibold tracking-tight text-white">
      Bright<span class="text-amber-400">scroll</span>
    </h1>

    <p class="text-balance text-lg leading-relaxed text-white/70">
      A scrollable feed of genuinely interesting facts — every one written and checked by a person, not generated.
    </p>

    <ul class="mt-2 flex w-full flex-col gap-3 text-left text-sm text-white/60">
      <li class="flex gap-3">
        <span aria-hidden="true">📚</span>
        <!-- eslint-disable-next-line max-len -->
        <span>Facts come from Wikipedia's <strong class="text-white/80">Did you know?</strong> archive, Reddit's <strong class="text-white/80">Today I Learned</strong>, and <strong class="text-white/80">factroom.ru</strong> — shown word for word, with a link to the source.</span>
      </li>
      <li class="flex gap-3">
        <span aria-hidden="true">🔒</span>
        <span>No account, no tracking, nothing to install.
          <strong class="text-white/80">Nothing you read or scroll leaves this browser.</strong></span>
      </li>
      <li class="flex gap-3">
        <span aria-hidden="true">🌍</span>
        <span>Facts not already in your language are translated
          <!-- eslint-disable-next-line max-len -->
          <strong class="text-white/80">on your device</strong> — never sent anywhere. Where a language can't be translated here, those facts are left out rather than shown unreadable.</span>
      </li>
    </ul>

    <label class="mt-2 flex w-full flex-col gap-1 text-left text-xs text-white/45">
      Language
      <LanguagePicker />
    </label>

    <button
      type="button"
      class="mt-2 w-full rounded-full bg-amber-500 px-6 py-3 text-base font-semibold text-black transition hover:bg-amber-400"
      onclick={start}
    >
      {hasSaved ? 'Resume scrolling' : 'Start scrolling'}
    </button>

    <p class="text-xs text-white/30">
      You can change the language any time from the feed.
    </p>
  </div>
</div>

<script>
  import { feed } from '$lib/feed/feed.svelte.js'
  import LanguagePicker from './LanguagePicker.svelte'

  const hasSaved = $derived(feed.posts.length > 0)

  const start = () => { void feed.start() }
</script>
