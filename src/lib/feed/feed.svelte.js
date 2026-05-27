import { DEFAULT_LANGUAGE, languageName } from '$lib/i18n/languages.js'
import { articleHash } from '$lib/hash.js'
import { fetchBatch, SOURCE_LANGS } from '$lib/sources/index.js'
import { buildPosts } from '$lib/facts/posts.js'
import { prepare, translate } from '$lib/translate/index.js'
import { consoleLog } from '$lib/capabilities/debug.js'
import {
  getReadArticleHashes,
  markArticlesRead,
  savePosts,
  updatePosts,
  loadPosts,
  clearPosts,
  saveCursor,
  loadCursor,
  saveLanguage,
  loadLanguage,
  saveStarted,
  loadStarted
} from '$lib/db/articles.js'
import { postFromLocation, reflectPost, clearReflectedPost } from '$lib/routing.js'

export const PREFETCH = 6
export const TRANSLATE_AHEAD = 3

/**
 * @typedef {'preparing' | 'ready' | 'unavailable'} PairState
 */

class FeedStore {
  /**
   * @type {import('$lib/facts/posts.js').Post[]}
   */
  posts = $state([])

  loading = $state(false)

  error = $state('')

  language = $state(DEFAULT_LANGUAGE)

  currentIndex = $state(0)

  cleared = $state(0)

  started = $state(false)

  /**
   * @type {Record<string, PairState>}
   */
  pairs = $state({})

  translatorProgress = $state({ pct: 0, active: false })

  restored = false

  #translating = false
  #retranslate = false

  /**
   * @param {string} lang
   * @returns {boolean}
   */
  canRead(lang) {
    return lang === this.language || this.pairs[lang] === 'ready'
  }

  get hasReadableSource() {
    return SOURCE_LANGS.some(lang => this.canRead(lang))
  }

  get readableLanguages() {
    return SOURCE_LANGS.map(languageName).join(' or ')
  }

  /**
   * @returns {string[]}
   */
  get unreadableLanguages() {
    return SOURCE_LANGS.filter(lang => !this.canRead(lang)).map(languageName)
  }

  /**
   * @returns {Promise<void>}
   */
  async prepareTranslation() {
    const target = this.language

    this.pairs = Object.fromEntries(
      SOURCE_LANGS.map(lang => [lang, lang === target ? 'ready' : 'preparing'])
    )

    const needed = SOURCE_LANGS.filter(lang => lang !== target)

    if (needed.length === 0)
      return

    this.translatorProgress = { pct: 0, active: true }

    await Promise.all(needed.map(async (lang) => {
      const ok = await prepare(lang, target, p => this.#onTranslatorProgress(p))

      if (this.language !== target)
        return

      this.pairs = { ...this.pairs, [lang]: ok ? 'ready' : 'unavailable' }
    }))

    this.translatorProgress = { pct: 0, active: false }

    consoleLog('feed:pairs', { target, pairs: $state.snapshot(this.pairs) })
  }

  /**
   * @param {{ pct: number }} p
   */
  #onTranslatorProgress(p) {
    this.translatorProgress = { pct: p.pct, active: true }
  }

  async restore() {
    if (this.restored)
      return

    this.restored = true

    try {
      const savedLanguage = await loadLanguage()

      if (savedLanguage)
        this.language = savedLanguage

      const saved = await loadPosts()
      const shared = postFromLocation()
      const cursor = await loadCursor()

      this.started = Boolean(shared) || await loadStarted()

      const cursorIdx = cursor ? saved.findIndex(p => p.id === cursor) : -1

      /**
       * @param {import('$lib/facts/posts.js').Post} p
       */
      const isShared = p => Boolean(shared) && p.hash === shared?.hash && p.fact === shared?.fact

      if (shared && !saved.some(isShared)) {
        const at = cursorIdx >= 0 ? cursorIdx : 0

        this.posts = [...saved.slice(0, at), shared, ...saved.slice(at)]
        this.currentIndex = at
      } else {
        this.posts = saved
        this.currentIndex = Math.max(0, shared ? saved.findIndex(isShared) : cursorIdx)
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not restore feed'
    }

    if (!this.started)
      return

    await this.#bringUp()
  }

  async start() {
    this.started = true

    await saveStarted().catch(() => {})
    await this.#bringUp()
  }

  /**
   * @returns {Promise<void>}
   */
  async #bringUp() {
    await this.prepareTranslation()

    if (this.posts.length === 0)
      await this.loadMore()
    else
      void this.#ensureTranslations()
  }

  goHome() {
    this.started = false
  }

  /**
   * @param {string} code
   */
  async setLanguage(code) {
    if (code === this.language)
      return

    this.language = code

    await saveLanguage(code).catch(() => {})
    await this.prepareTranslation()

    void this.#ensureTranslations()
  }

  async clear() {
    await clearPosts()

    this.posts = []
    this.currentIndex = 0
    this.cleared++
    clearReflectedPost()

    await this.loadMore()
  }

  async loadMore() {
    if (this.loading)
      return

    this.loading = true
    this.error = ''

    try {
      const readHashes = await getReadArticleHashes()
      const { facts, perSource } = await fetchBatch(
        lang => this.canRead(lang),
        key => readHashes.has(articleHash(key))
      )

      consoleLog('feed:batch', { language: this.language, ...perSource })

      const posts = buildPosts(facts)

      if (posts.length > 0) {
        const start = this.posts.length

        await savePosts(posts, start)
        await markArticlesRead(posts.map((p) => {
          return { hash: p.hash, title: p.title, url: p.url }
        }))

        this.posts = [...this.posts, ...posts.map((p, i) => {
          return { ...p, order: start + i }
        })]
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not load more posts'
    } finally {
      this.loading = false
    }

    void this.#ensureTranslations()
  }

  async #ensureTranslations() {
    if (this.#translating) {
      this.#retranslate = true
      return
    }

    this.#translating = true

    try {
      const lang = this.language
      const to = Math.min(this.posts.length, this.currentIndex + TRANSLATE_AHEAD + 1)

      for (let i = Math.max(0, this.currentIndex); i < to; i++) {
        if (this.language !== lang)
          break

        const post = this.posts[i]
        const from = post?.lang ?? DEFAULT_LANGUAGE

        if (!post || from === lang || post.translations?.[lang])
          continue

        const out = await translate(post.fact, from, lang)

        if (!out || this.language !== lang)
          continue

        const updated = {
          ...post,
          translations: {
            ...(post.translations ?? {}),
            [lang]: { fact: out.text, via: out.via }
          }
        }

        this.posts = this.posts.map((p, k) => (k === i ? updated : p))

        if (typeof updated.order === 'number' && !updated.external)
          void updatePosts([updated]).catch(() => {})
      }
    } finally {
      this.#translating = false

      if (this.#retranslate) {
        this.#retranslate = false
        void this.#ensureTranslations()
      }
    }
  }

  /**
   * @param {number} index
   */
  setCurrent(index) {
    if (index < 0 || index >= this.posts.length)
      return

    const post = this.posts[index]

    this.currentIndex = index

    reflectPost(post)

    if (!post.external)
      void saveCursor(post.id).catch(() => {})

    void this.#ensureTranslations()

    if (index >= this.posts.length - PREFETCH)
      void this.loadMore()
  }
}

export const feed = new FeedStore()
