<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>
{@render children()}

<script>
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet<[]>} [children]
   */

  let {
    children
  } = $props()
</script>
