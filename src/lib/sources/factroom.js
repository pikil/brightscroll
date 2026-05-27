import { shuffle, stripHtml } from './shared.js'

/**
 * @typedef {import('./shared.js').Fact} Fact
 */

/**
 * @typedef {Object} WpMedia
 * @property {string} [code]
 * @property {string} [source_url]
 * @property {{ sizes?: Record<string, { source_url?: string } | undefined> }} [media_details]
 */

/**
 * @typedef {Object} WpPost
 * @property {number} [id]
 * @property {string} [link]
 * @property {{ rendered?: string }} [content]
 * @property {{ 'wp:featuredmedia'?: WpMedia[] }} [_embedded]
 */

const API = 'https://www.factroom.ru/wp-json/wp/v2/posts'
const PER_PAGE = 20
// ceil(15317 posts / PER_PAGE), kept slightly under the true max so a random page is always in range. Refresh only if the site grows a lot.
const MAX_PAGE = 760
const MIN_FACT = 40
const MAX_FACT = 560

const TRAILER = /^(?:Читайте|Смотрите|Читать)\s+(?:также|по\s+теме)/iu

/**
 * @param {string} html
 * @returns {string}
 */
export const leadParagraph = (html) => {
  const body = String(html ?? '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')

  const [lead = ''] = (body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [])
    .map(stripHtml)
    .filter(Boolean)

  return TRAILER.test(lead) ? '' : lead
}

/**
 * @param {WpPost} post
 * @returns {string | undefined}
 */
const featuredImage = (post) => {
  const media = post?._embedded?.['wp:featuredmedia']?.[0]

  if (!media || media.code)
    return undefined

  const sizes = media.media_details?.sizes ?? {}

  return sizes.medium?.source_url || media.source_url || undefined
}

/**
 * @param {WpPost} post
 * @returns {Fact | null}
 */
const toFact = (post) => {
  const fact = leadParagraph(post?.content?.rendered ?? '')

  if (fact.length < MIN_FACT || fact.length > MAX_FACT)
    return null

  const link = typeof post?.link === 'string' ? post.link : ''

  if (!link)
    return null

  const image = featuredImage(post)

  return {
    key: String(post.id),
    title: 'Factroom',
    url: link,
    link,
    fact,
    lang: 'ru',
    ...(image ? { image } : {})
  }
}

/**
 * @type {import('./shared.js').Source}
 */
export const factroom = {
  id: 'factroom',
  label: 'Factroom',
  lang: 'ru',
  perBatch: 3,

  fetch: async (count, exclude) => {
    const url = new URL(API)

    url.searchParams.set('per_page', String(PER_PAGE))
    url.searchParams.set('page', String(1 + Math.floor(Math.random() * MAX_PAGE)))
    url.searchParams.set('_embed', 'wp:featuredmedia')

    const res = await fetch(url, { method: 'GET' })

    if (!res.ok)
      throw new Error(`factroom error ${res.status}`)

    const posts = /** @type {WpPost[]} */ (await res.json())

    if (!Array.isArray(posts))
      return []

    /** @type {Fact[]} */
    const facts = []

    posts.forEach((post) => {
      const fact = toFact(post)

      if (fact && !exclude(fact.key))
        facts.push(fact)
    })

    return shuffle(facts).slice(0, count)
  }
}
