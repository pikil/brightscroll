const KEY = 'brightscroll:debug'
const PREFIX = '[bs]'

/**
 * @returns {string}
 */
const elapsed = () => {
  const ms = typeof performance !== 'undefined' ? performance.now() : 0

  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * @returns {boolean}
 */
const resolveEnabled = () => {
  if (typeof location === 'undefined')
    return import.meta.env.DEV

  try {
    const param = new URLSearchParams(location.search).get('debug')

    if (param === '1') {
      localStorage.setItem(KEY, '1')
      return true
    }

    if (param === '0') {
      localStorage.removeItem(KEY)
      return false
    }

    return import.meta.env.DEV || localStorage.getItem(KEY) === '1'
  } catch {
    return import.meta.env.DEV
  }
}

let active = resolveEnabled()

export const enabled = () => active

/**
 * @param {boolean} value
 */
export const setEnabled = (value) => {
  active = value
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export const consoleLog = (event, data) => {
  if (!active)
    return

  // eslint-disable-next-line no-console
  console.log(`${PREFIX} ${elapsed()} ${event}`, data ?? '')
}
