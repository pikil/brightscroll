const PARAM = 'p'

/**
 * @typedef {Object} SharedPost
 * @property {string} h
 * @property {string} f
 * @property {string} l
 * @property {string} t
 * @property {string} [n] canonical language of the fact (default 'en')
 * @property {string} [g] image URL
 */

/**
 * @param {string} str
 */
const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str)
  let bin = ''

  bytes.forEach((b) => { bin += String.fromCharCode(b) })

  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * @param {string} str
 */
const b64decode = (str) => {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

/**
 * @param {import('$lib/facts/posts.js').Post} post
 * @returns {string}
 */
export const encodePost = (post) => {
  /**
   * @type {SharedPost}
   */
  const payload = {
    h: post.hash,
    f: post.fact,
    l: post.link,
    t: post.title,
    n: post.lang ?? 'en',
    ...(post.image ? { g: post.image } : {})
  }

  return b64encode(JSON.stringify(payload))
}

/**
 * @param {string | null} token
 * @returns {(import('$lib/facts/posts.js').Post) | null}
 */
export const decodePost = (token) => {
  if (!token)
    return null

  try {
    /**
     * @type {SharedPost}
     */
    const p = JSON.parse(b64decode(token))

    if (!p || typeof p.h !== 'string' || typeof p.f !== 'string')
      return null

    return {
      id: `${p.h}-shared`,
      hash: p.h,
      title: p.t ?? '',
      url: (p.l ?? '').split('#')[0],
      fact: p.f,
      link: p.l ?? '',
      lang: typeof p.n === 'string' ? p.n : 'en',
      external: true,
      ...(typeof p.g === 'string' && p.g ? { image: p.g } : {})
    }
  } catch {
    return null
  }
}

/**
 * @returns {(import('$lib/facts/posts.js').Post) | null}
 */
export const postFromLocation = () => (typeof location === 'undefined')
  ? null
  : decodePost(new URLSearchParams(location.search).get(PARAM))

const MIN_INTERVAL_MS = 400

let lastWrite = 0
let trailing = false

/**
 * @type {{ post: import('$lib/facts/posts.js').Post, replace: boolean } | null}
 */
let queued = null

/**
 * @param {import('$lib/facts/posts.js').Post} post
 * @param {boolean} replace
 */
const write = (post, replace) => {
  try {
    const url = new URL(location.href)
    url.searchParams.set(PARAM, encodePost(post))
    history[replace ? 'replaceState' : 'pushState'](history.state, '', url)
    lastWrite = Date.now()
  } catch {
    // Throttled by the browser, or the URL grew past its limit. The shareable link is a convenience — never let it break scrolling.
  }
}

const flush = () => {
  trailing = false

  if (!queued)
    return

  const { post, replace } = queued

  queued = null
  write(post, replace)
}

/**
 * @param {import('$lib/facts/posts.js').Post} post
 * @param {boolean} [replace]
 */
export const reflectPost = (post, replace = true) => {
  if (typeof location === 'undefined')
    return

  const since = Date.now() - lastWrite

  if (since >= MIN_INTERVAL_MS && !trailing) {
    write(post, replace)
    return
  }

  queued = { post, replace }

  if (trailing)
    return

  trailing = true
  setTimeout(flush, Math.max(0, MIN_INTERVAL_MS - since))
}

export const clearReflectedPost = () => {
  if (typeof location === 'undefined')
    return

  queued = null

  try {
    const url = new URL(location.href)
    url.searchParams.delete(PARAM)
    history.replaceState(history.state, '', url)
    lastWrite = Date.now()
  } catch {
    // See write() — history throttling must never break the feed.
  }
}
