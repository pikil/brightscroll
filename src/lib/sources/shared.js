/**
 * @typedef {Object} Fact
 * @property {string} key
 * @property {string} title
 * @property {string} url
 * @property {string} link
 * @property {string} fact
 * @property {string} lang
 * @property {string} [image]
 */

/**
 * @typedef {Object} Source
 * @property {string} id
 * @property {string} label
 * @property {string} lang
 * @property {number} perBatch
 * @property {(count: number, exclude: (key: string) => boolean) => Promise<Fact[]>} fetch
 */

/** @type {Record<string, string>} */
const NAMED_ENTITIES = Object.freeze({
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': '\'',
  '&#39;': '\'',
  '&laquo;': '«',
  '&raquo;': '»',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&times;': '×',
  '&deg;': '°'
})

const NAMED_RE = new RegExp(Object.keys(NAMED_ENTITIES).join('|'), 'g')

/**
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export const shuffle = (arr) => {
  const out = arr.slice()

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }

  return out
}

/**
 * @param {string} s
 * @returns {string}
 */
export const decodeEntities = s => s
  .replace(NAMED_RE, m => NAMED_ENTITIES[m])
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))

/**
 * @param {string} s
 * @returns {string}
 */
export const collapseSpace = s => s.replace(/\s+/g, ' ').trim()

/**
 * @param {string} s
 * @returns {string}
 */
const tidyPunctuation = s => s
  .replace(/\s+([.,!?:;…»)])/gu, '$1')
  .replace(/([«(])\s+/gu, '$1')

/**
 * @param {string} html
 * @returns {string}
 */
export const stripHtml = html => tidyPunctuation(collapseSpace(
  decodeEntities(collapseSpace(String(html ?? '').replace(/<[^>]+>/g, ' ')))
))

/**
 * @template T
 * @param {() => Promise<T[]>} run
 * @returns {Promise<T[]>}
 */
export const orEmpty = async (run) => {
  try {
    return await run()
  } catch {
    return []
  }
}
