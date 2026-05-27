import { shuffle, orEmpty } from './shared.js'
import { dyk } from './dyk.js'
import { til } from './til.js'
import { factroom } from './factroom.js'

/**
 * @typedef {import('./shared.js').Fact} Fact
 * @typedef {import('./shared.js').Source} Source
 */

/**
 * @type {readonly Source[]}
 */
export const SOURCES = Object.freeze([dyk, til, factroom])

/**
 * @type {readonly string[]}
 */
export const SOURCE_LANGS = Object.freeze([...new Set(SOURCES.map(s => s.lang))])

/**
 * @param {(lang: string) => boolean} canRead
 * @param {(key: string) => boolean} exclude
 * @returns {Promise<{ facts: Fact[], perSource: Record<string, number> }>}
 */
export const fetchBatch = async (canRead, exclude) => {
  const usable = SOURCES.filter(s => canRead(s.lang))

  const results = await Promise.all(
    usable.map(s => orEmpty(() => s.fetch(s.perBatch, exclude)))
  )

  /** @type {Record<string, number>} */
  const perSource = {}

  usable.forEach((s, i) => {
    perSource[s.id] = results[i].length
  })

  return { facts: shuffle(results.flat()), perSource }
}
