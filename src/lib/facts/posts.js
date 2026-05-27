import { articleHash, postId } from '$lib/hash.js'

/**
 * @typedef {Object} Translation
 * @property {string} fact
 * @property {string} via
 */

/**
 * @typedef {Object} Post
 * @property {string} id
 * @property {string} hash
 * @property {string} title
 * @property {string} url
 * @property {string} fact
 * @property {string} link
 * @property {string} lang
 * @property {string} [image]
 * @property {boolean} [external]
 * @property {number} [order]
 * @property {Record<string, Translation>} [translations]
 */

/**
 * @param {import('$lib/sources/shared.js').Fact[]} facts
 * @returns {Post[]}
 */
export const buildPosts = facts => facts.map((f, i) => {
  const hash = articleHash(f.key)

  return {
    id: postId(hash, i),
    hash,
    title: f.title,
    url: f.url,
    fact: f.fact,
    link: f.link || f.url,
    lang: f.lang,
    ...(f.image ? { image: f.image } : {})
  }
})
