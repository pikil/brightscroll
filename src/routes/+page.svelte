<main class="min-h-dvh bg-neutral-950 text-white">
  {#if feed.started}
    <Feed />
  {:else}
    <Intro />
  {/if}
</main>

<script>
  import { feed } from '$lib/feed/feed.svelte.js'
  import Feed from '$lib/components/Feed.svelte'
  import Intro from '$lib/components/Intro.svelte'
  import { requestPersistence } from '$lib/capabilities/storage.js'

  $effect(() => {
    void requestPersistence()
    void feed.restore()
  })
</script>
