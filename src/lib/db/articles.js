const DB_NAME = 'brightscroll'
const DB_VERSION = 2
const STORE_ARTICLES = 'articles'
const STORE_POSTS = 'posts'
const STORE_META = 'meta'
const CURSOR_KEY = 'cursor'
const LANGUAGE_KEY = 'language'
const STARTED_KEY = 'started'

/**
 * @typedef {import('$lib/facts/posts.js').Post} Post
 * @typedef {Post & { order: number }} StoredPost
 * @typedef {{ hash: string, title: string, url: string }} ReadArticle
 */

/**
 * @type {Promise<IDBDatabase> | null}
 */
let dbPromise = null

/**
 * @returns {Promise<IDBDatabase>}
 */
const open = () => {
  if (dbPromise)
    return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains(STORE_ARTICLES))
        db.createObjectStore(STORE_ARTICLES, { keyPath: 'hash' })

      if (!db.objectStoreNames.contains(STORE_POSTS)) {
        const posts = db.createObjectStore(STORE_POSTS, { keyPath: 'id' })
        posts.createIndex('order', 'order', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_META))
        db.createObjectStore(STORE_META)
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })

  return dbPromise
}

/**
 * @param {IDBObjectStore} store
 * @returns {Promise<unknown[]>}
 */
const getAll = store => new Promise((resolve, reject) => {
  const req = store.getAll()

  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
})

/**
 * @param {IDBObjectStore} store
 * @param {IDBValidKey} key
 * @returns {Promise<unknown>}
 */
const getKey = (store, key) => new Promise((resolve, reject) => {
  const req = store.get(key)

  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
})

/**
 * @param {IDBTransaction} tx
 * @returns {Promise<void>}
 */
const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
})

/**
 * @returns {Promise<Set<string>>}
 */
export const getReadArticleHashes = async () => {
  const db = await open()
  const tx = db.transaction(STORE_ARTICLES, 'readonly')
  const rows = /** @type {ReadArticle[]} */ (await getAll(tx.objectStore(STORE_ARTICLES)))

  return new Set(rows.map(r => r.hash))
}

/**
 * @param {ReadArticle[]} articles
 * @returns {Promise<void>}
 */
export const markArticlesRead = async (articles) => {
  if (articles.length === 0)
    return

  const db = await open()
  const tx = db.transaction(STORE_ARTICLES, 'readwrite')
  const store = tx.objectStore(STORE_ARTICLES)

  articles.forEach(a => store.put({ hash: a.hash, title: a.title, url: a.url, readAt: Date.now() }))

  await done(tx)
}

/**
 * @param {Post[]} posts
 * @param {number} startOrder
 * @returns {Promise<void>}
 */
export const savePosts = async (posts, startOrder) => {
  if (posts.length === 0)
    return

  const db = await open()
  const tx = db.transaction(STORE_POSTS, 'readwrite')
  const store = tx.objectStore(STORE_POSTS)

  posts.forEach((p, i) => store.put({ ...p, order: startOrder + i }))

  await done(tx)
}

/**
 * @param {Post[]} posts
 * @returns {Promise<void>}
 */
export const updatePosts = async (posts) => {
  if (posts.length === 0)
    return

  const db = await open()
  const tx = db.transaction(STORE_POSTS, 'readwrite')
  const store = tx.objectStore(STORE_POSTS)

  posts.forEach(p => store.put(p))

  await done(tx)
}

/**
 * @returns {Promise<StoredPost[]>}
 */
export const loadPosts = async () => {
  const db = await open()
  const tx = db.transaction(STORE_POSTS, 'readonly')
  const rows = /** @type {StoredPost[]} */ (await getAll(tx.objectStore(STORE_POSTS)))

  return rows.sort((a, b) => a.order - b.order)
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export const saveCursor = async (id) => {
  const db = await open()
  const tx = db.transaction(STORE_META, 'readwrite')

  tx.objectStore(STORE_META).put(id, CURSOR_KEY)

  await done(tx)
}

/**
 * @returns {Promise<string | null>}
 */
export const loadCursor = async () => {
  const db = await open()
  const tx = db.transaction(STORE_META, 'readonly')
  const value = await getKey(tx.objectStore(STORE_META), CURSOR_KEY)

  return typeof value === 'string' ? value : null
}

/**
 * @param {string} code
 * @returns {Promise<void>}
 */
export const saveLanguage = async (code) => {
  const db = await open()
  const tx = db.transaction(STORE_META, 'readwrite')

  tx.objectStore(STORE_META).put(code, LANGUAGE_KEY)

  await done(tx)
}

/**
 * @returns {Promise<string | null>}
 */
export const loadLanguage = async () => {
  const db = await open()
  const tx = db.transaction(STORE_META, 'readonly')
  const value = await getKey(tx.objectStore(STORE_META), LANGUAGE_KEY)

  return typeof value === 'string' ? value : null
}

/**
 * @returns {Promise<void>}
 */
export const saveStarted = async () => {
  const db = await open()
  const tx = db.transaction(STORE_META, 'readwrite')

  tx.objectStore(STORE_META).put(true, STARTED_KEY)

  await done(tx)
}

/**
 * @returns {Promise<boolean>}
 */
export const loadStarted = async () => {
  const db = await open()
  const tx = db.transaction(STORE_META, 'readonly')

  return await getKey(tx.objectStore(STORE_META), STARTED_KEY) === true
}

/**
 * @returns {Promise<void>}
 */
export const clearPosts = async () => {
  const db = await open()
  const tx = db.transaction([STORE_POSTS, STORE_META], 'readwrite')

  tx.objectStore(STORE_POSTS).clear()
  tx.objectStore(STORE_META).delete(CURSOR_KEY)

  await done(tx)
}

export const clearAll = async () => {
  const db = await open()
  const tx = db.transaction([STORE_ARTICLES, STORE_POSTS, STORE_META], 'readwrite')

  tx.objectStore(STORE_ARTICLES).clear()
  tx.objectStore(STORE_POSTS).clear()
  tx.objectStore(STORE_META).clear()

  await done(tx)
}
