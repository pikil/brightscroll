const api = () => globalThis.Translator

export const name = 'builtin'

export const possible = typeof api() !== 'undefined'

/**
 * @type {Map<string, Promise<TranslatorInstance>>}
 */
const instances = new Map()

/**
 * @param {string} source
 * @param {string} target
 */
const key = (source, target) => `${source}->${target}`

/**
 * @param {string} source
 * @param {string} target
 * @returns {Promise<TranslatorAvailability>}
 */
export const availability = async (source, target) => {
  const translator = api()

  if (!translator || source === target)
    return 'unavailable'

  try {
    return await translator.availability({ sourceLanguage: source, targetLanguage: target }) ?? 'unavailable'
  } catch {
    return 'unavailable'
  }
}

/**
 * @param {string} source
 * @param {string} target
 * @param {(p: { pct: number }) => void} [onProgress]
 * @returns {Promise<TranslatorInstance>}
 */
const instance = (source, target, onProgress) => {
  const translator = api()

  if (!translator)
    throw new Error('Built-in Translator API unavailable')

  const pair = key(source, target)
  const existing = instances.get(pair)

  if (existing)
    return existing

  const created = translator.create({
    sourceLanguage: source,
    targetLanguage: target,
    monitor: (m) => {
      m.addEventListener('downloadprogress', (e) => {
        onProgress?.({ pct: Math.round((e.loaded ?? 0) * 100) })
      })
    }
  }).catch((/** @type {unknown} */ err) => {
    instances.delete(pair)
    throw err
  })

  instances.set(pair, created)

  return created
}

/**
 * @param {string} source
 * @param {string} target
 * @param {(p: { pct: number }) => void} [onProgress]
 * @returns {Promise<boolean>}
 */
export const prepare = async (source, target, onProgress) => {
  if (!possible || source === target)
    return false

  if (await availability(source, target) === 'unavailable')
    return false

  try {
    await instance(source, target, onProgress)

    return true
  } catch {
    return false
  }
}

/**
 * @param {string} text
 * @param {string} source
 * @param {string} target
 * @returns {Promise<string | null>}
 */
export const translate = async (text, source, target) => {
  if (!possible || source === target || text.length === 0)
    return null

  try {
    const t = await instance(source, target)
    const out = await t.translate(text)

    return typeof out === 'string' && out.length > 0 ? out : null
  } catch {
    return null
  }
}
