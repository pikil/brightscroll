import { translateClient } from './client.js'
import { consoleLog } from '$lib/capabilities/debug.js'

export const name = 'opus'

export const possible = typeof Worker !== 'undefined'

/**
 * @type {Set<string>}
 */
const failed = new Set()

/**
 * @type {Map<string, Promise<boolean>>}
 */
const prepared = new Map()

/**
 * @param {string} source
 * @param {string} target
 */
const key = (source, target) => `${source}->${target}`

/**
 * @param {string} source
 * @param {string} target
 * @param {(p: { pct: number }) => void} [onProgress]
 * @returns {Promise<boolean>}
 */
export const prepare = (source, target, onProgress) => {
  const pair = key(source, target)

  if (!possible || source === target || failed.has(pair))
    return Promise.resolve(false)

  const existing = prepared.get(pair)

  if (existing)
    return existing

  consoleLog('opus:prepare', { pair })

  const attempt = translateClient
    .prepare(source, target, (p) => {
      onProgress?.({ pct: p.total > 0 ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0 })
    })
    .then((dtype) => {
      consoleLog('opus:ready', { pair, dtype })

      return true
    })
    .catch((/** @type {unknown} */ err) => {
      consoleLog('opus:unavailable', {
        pair,
        message: err instanceof Error ? err.message : String(err)
      })

      failed.add(pair)
      prepared.delete(pair)

      return false
    })

  prepared.set(pair, attempt)

  return attempt
}

/**
 * @param {string} text
 * @param {string} source
 * @param {string} target
 * @returns {Promise<string | null>}
 */
export const translate = async (text, source, target) => {
  if (text.length === 0 || source === target)
    return null

  if (!await prepare(source, target))
    return null

  try {
    const out = await translateClient.translate([text], source, target)

    return out?.[0] || null
  } catch (err) {
    consoleLog('opus:failed', {
      pair: key(source, target),
      message: err instanceof Error ? err.message : String(err)
    })

    return null
  }
}
