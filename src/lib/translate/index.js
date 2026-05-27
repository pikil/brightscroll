import * as builtin from './builtin.js'
import * as opus from './opus.js'
import { consoleLog } from '$lib/capabilities/debug.js'

/**
 * @typedef {Object} Backend
 * @property {string} name
 * @property {boolean} possible
 * @property {(source: string, target: string, onProgress?: (p: { pct: number }) => void) => Promise<boolean>} prepare
 * @property {(text: string, source: string, target: string) => Promise<string | null>} translate
 */

/**
 * @type {readonly Backend[]}
 */
const BACKENDS = Object.freeze([builtin, opus])

/**
 * @type {Map<string, Backend | null>}
 */
const routes = new Map()

/**
 * @type {Map<string, Promise<Backend | null>>}
 */
const pending = new Map()

/**
 * @param {string} source
 * @param {string} target
 */
const key = (source, target) => `${source}->${target}`

/**
 * @param {string} source
 * @param {string} target
 * @param {(p: { pct: number }) => void} [onProgress]
 * @returns {Promise<Backend | null>}
 */
const resolve = async (source, target, onProgress) => {
  const usable = BACKENDS.filter(b => b.possible)

  // Sequential on purpose: preparing every backend at once would download opus-mt weights even when the built-in API was about to win the pair.
  const winner = await usable.reduce(
    (chain, backend) => chain.then(async (found) => {
      if (found)
        return found

      return await backend.prepare(source, target, onProgress) ? backend : null
    }),
    /** @type {Promise<Backend | null>} */ (Promise.resolve(null))
  )

  consoleLog('translate:route', { pair: key(source, target), backend: winner?.name ?? 'none' })

  return winner
}

/**
 * @param {string} source
 * @param {string} target
 * @param {(p: { pct: number }) => void} [onProgress]
 * @returns {Promise<boolean>}
 */
export const prepare = async (source, target, onProgress) => {
  if (source === target)
    return true

  const pair = key(source, target)

  if (routes.has(pair))
    return routes.get(pair) !== null

  const existing = pending.get(pair)

  if (existing)
    return await existing !== null

  const attempt = resolve(source, target, onProgress)

  pending.set(pair, attempt)

  const backend = await attempt

  routes.set(pair, backend)
  pending.delete(pair)

  return backend !== null
}

/**
 * @param {string} text
 * @param {string} source
 * @param {string} target
 * @returns {Promise<{ text: string, via: string } | null>}
 */
export const translate = async (text, source, target) => {
  if (text.length === 0 || source === target)
    return null

  if (!await prepare(source, target))
    return null

  const backend = routes.get(key(source, target))

  if (!backend)
    return null

  const out = await backend.translate(text, source, target)

  return out ? { text: out, via: backend.name } : null
}

/**
 * @param {string} source
 * @param {string} target
 * @returns {string | null}
 */
export const backendFor = (source, target) =>
  routes.get(key(source, target))?.name ?? null
