import { shuffle, decodeEntities, collapseSpace } from './shared.js'

/**
 * @typedef {import('./shared.js').Fact} Fact
 */

const API = 'https://en.wikipedia.org/w/api.php'
const FIRST_YEAR = 2012
const LAST_YEAR = 2024
const MONTHS = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
])
const MIN_FACT = 24
const MAX_FACT = 320
const MAX_ATTEMPTS = 6

const HOOK_LINE = /^\*\s*\.{2,}\s*that\b/i
const BOLD_LINK = /'{3,}\[\[([^\]|]+)(?:\|[^\]]+)?\]\]'{3,}/

/**
 * @param {string} title
 * @returns {string}
 */
const articleUrl = title =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`

/**
 * @param {string} line
 * @returns {string}
 */
const cleanHook = (line) => {
  let s = line
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<[^>]+>/g, '')
    // {{convert|88.5|ft|…}} -> "88.5 ft"
    .replace(/\{\{convert\|([^|}]+)\|([^|}]+)[^}]*\}\}/gi, '$1 $2')
    .replace(/\{\{`s\}\}/g, '’s')
    .replace(/\{\{'s\}\}/g, '’s')
    .replace(/\{\{'\}\}/g, '’')

  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\{\{[^{}]*\}\}/g, '')

    if (next === s)
      break

    s = next
  }

  return decodeEntities(
    collapseSpace(
      s.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\(\s*(?:example\s+)?pictured\s*\)/gi, '')
        .replace(/'{2,}/g, '')
        .replace(/^\*+\s*\.{2,}\s*that\s+/i, '')
    ).replace(/\?+$/, '').trim()
  )
}

/**
 * @param {string} wikitext
 * @returns {Fact[]}
 */
export const parseHooks = (wikitext) => {
  /** @type {Fact[]} */
  const facts = []

  wikitext.split('\n').forEach((line) => {
    if (!HOOK_LINE.test(line))
      return

    const linkMatch = BOLD_LINK.exec(line)

    if (!linkMatch)
      return

    const fact = cleanHook(line)

    if (fact.length < MIN_FACT || fact.length > MAX_FACT)
      return

    if (/[[\]{}|]/.test(fact))
      return

    const title = linkMatch[1].trim()

    facts.push({
      key: title,
      title,
      url: articleUrl(title),
      link: articleUrl(title),
      fact,
      lang: 'en'
    })
  })

  return facts
}

/**
 * @returns {string}
 */
const randomArchivePage = () => {
  const year = FIRST_YEAR + Math.floor(Math.random() * (LAST_YEAR - FIRST_YEAR + 1))
  const month = MONTHS[Math.floor(Math.random() * MONTHS.length)]

  return `Wikipedia:Did you know archive/${year}/${month}`
}

/**
 * @param {string} page
 * @returns {Promise<string>}
 */
const fetchWikitext = async (page) => {
  const url = new URL(API)

  /** @type {Record<string, string>} */
  const params = {
    action: 'parse',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'wikitext',
    page
  }

  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]))

  const res = await fetch(url, { method: 'GET' })

  if (!res.ok)
    throw new Error(`Wikipedia API error ${res.status}`)

  const json = await res.json()

  if (json.error)
    return ''

  return json?.parse?.wikitext ?? ''
}

/**
 * @type {import('./shared.js').Source}
 */
export const dyk = {
  id: 'dyk',
  label: 'Did you know?',
  lang: 'en',
  perBatch: 3,

  fetch: async (count, exclude) => {
    /** @type {Map<string, Fact>} */
    const picked = new Map()
    let attempts = 0

    while (picked.size < count && attempts < MAX_ATTEMPTS) {
      attempts++

      const wikitext = await fetchWikitext(randomArchivePage())

      shuffle(parseHooks(wikitext)).forEach((h) => {
        if (picked.size < count && !picked.has(h.key) && !exclude(h.key))
          picked.set(h.key, h)
      })
    }

    return Array.from(picked.values())
  }
}
