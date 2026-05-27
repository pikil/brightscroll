import { shuffle, collapseSpace } from './shared.js'

/**
 * @typedef {import('./shared.js').Fact} Fact
 */

/**
 * @typedef {Object} RedditPost
 * @property {string} [name]
 * @property {string} [title]
 * @property {string} [permalink]
 * @property {string} [url]
 * @property {string} [url_overridden_by_dest]
 * @property {boolean} [stickied]
 * @property {boolean} [over_18]
 * @property {string} [removed_by_category]
 */

/**
 * @typedef {Object} RedditChild
 * @property {RedditPost} [data]
 */

/**
 * @typedef {Object} RedditListing
 * @property {{ children?: RedditChild[] }} [data]
 */

const LISTING = 'https://www.reddit.com/r/todayilearned/top.json'
const TIMEFRAMES = Object.freeze(['all', 'year', 'month', 'week'])
const MIN_FACT = 24
const MAX_FACT = 320
const STRIP_PREFIX = /^TIL\b[\s:,.-]*(?:that\s+)?/i

/**
 * @param {string} title
 * @returns {string}
 */
export const cleanTitle = (title) => {
  const s = collapseSpace(String(title ?? '').replace(STRIP_PREFIX, ''))

  if (s.length === 0)
    return s

  return s[0].toUpperCase() + s.slice(1)
}

/**
 * @param {RedditChild} child
 * @returns {Fact | null}
 */
const toFact = (child) => {
  const d = child?.data

  if (!d || d.stickied || d.over_18 || d.removed_by_category)
    return null

  const fact = cleanTitle(d.title ?? '')

  if (fact.length < MIN_FACT || fact.length > MAX_FACT)
    return null

  const url = d.url_overridden_by_dest || d.url || `https://www.reddit.com${d.permalink}`

  return {
    key: String(d.name),
    title: 'Today I Learned',
    url,
    link: url,
    fact,
    lang: 'en'
  }
}

/**
 * @type {import('./shared.js').Source}
 */
export const til = {
  id: 'til',
  label: 'Today I Learned',
  lang: 'en',
  perBatch: 3,

  fetch: async (count, exclude) => {
    const url = new URL(LISTING)

    url.searchParams.set('t', TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)])
    url.searchParams.set('limit', '100')
    url.searchParams.set('raw_json', '1')

    const res = await fetch(url, { method: 'GET' })

    if (!res.ok)
      throw new Error(`Reddit error ${res.status}`)

    const json = /** @type {RedditListing} */ (await res.json())
    const children = json?.data?.children ?? []

    /** @type {Fact[]} */
    const facts = []

    children.forEach((child) => {
      const fact = toFact(child)

      if (fact && !exclude(fact.key))
        facts.push(fact)
    })

    return shuffle(facts).slice(0, count)
  }
}
