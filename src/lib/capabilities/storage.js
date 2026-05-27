export const supported = typeof navigator !== 'undefined'
  && 'storage' in navigator
  && typeof navigator.storage?.persist === 'function'

/**
 * @returns {Promise<{ persisted: boolean, supported: boolean }>}
 */
export const requestPersistence = async () => {
  if (!supported)
    return { persisted: false, supported: false }

  try {
    const supported = true
    const already = await navigator.storage.persisted()
    const persisted = already || await navigator.storage.persist()

    return { persisted, supported }
  } catch {
    return { persisted: false, supported }
  }
}
