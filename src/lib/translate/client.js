import { enabled } from '$lib/capabilities/debug.js'

/**
 * @typedef {import('./protocol.js').WorkerResponse} WorkerResponse
 * @typedef {import('./protocol.js').WorkerRequestInit} WorkerRequestInit
 */

const DTYPE_KEY = 'brightscroll:translate-dtype'

/**
 * @returns {string | undefined}
 */
const savedDtype = () => {
  try {
    return localStorage.getItem(DTYPE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * @param {string} dtype
 */
const rememberDtype = (dtype) => {
  try {
    if (dtype)
      localStorage.setItem(DTYPE_KEY, dtype)
  } catch {
    // Private mode — the ladder just runs again next visit.
  }
}

/**
 * @typedef {Object} Pending
 * @property {(value: string | string[]) => void} resolve
 * @property {(reason: Error) => void} reject
 * @property {(p: { loaded: number, total: number }) => void} [onProgress]
 */

class TranslateClient {
  /** @type {Worker | null} */
  #worker = null

  /** @type {Map<number, Pending>} */
  #pending = new Map()

  #nextId = 1

  /**
   * @type {Promise<unknown>}
   */
  #queue = Promise.resolve()

  #ensureWorker() {
    if (this.#worker)
      return this.#worker

    this.#worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    this.#worker.addEventListener('message', (/** @type {MessageEvent<WorkerResponse>} */ e) => {
      this.#onMessage(e.data)
    })

    return this.#worker
  }

  /**
   * @param {WorkerResponse} msg
   */
  #onMessage(msg) {
    const entry = this.#pending.get(msg.id)

    if (!entry)
      return

    if (msg.type === 'progress') {
      entry.onProgress?.({ loaded: msg.loaded, total: msg.total })
      return
    }

    this.#pending.delete(msg.id)

    if (msg.type === 'error') {
      entry.reject(new Error(msg.message))
      return
    }

    if (msg.type === 'ready') {
      rememberDtype(msg.dtype)
      entry.resolve(msg.dtype)
      return
    }

    entry.resolve(msg.texts)
  }

  /**
   * @template {string | string[]} T
   * @param {WorkerRequestInit} req
   * @param {Pending['onProgress']} [onProgress]
   * @returns {Promise<T>}
   */
  #send(req, onProgress) {
    /**
     * @returns {Promise<string | string[]>}
     */
    const run = () => new Promise((resolve, reject) => {
      const worker = this.#ensureWorker()
      const id = this.#nextId++

      this.#pending.set(id, { resolve, reject, onProgress })
      worker.postMessage({ ...req, id, debug: enabled(), dtype: savedDtype() })
    })

    const result = this.#queue.then(run, run)

    this.#queue = result.catch(() => {})

    return /** @type {Promise<T>} */ (result)
  }

  /**
   * @param {string} source
   * @param {string} target
   * @param {Pending['onProgress']} [onProgress]
   * @returns {Promise<string>}
   */
  prepare(source, target, onProgress) {
    return this.#send({ type: 'prepare', source, target }, onProgress)
  }

  /**
   * @param {string[]} texts
   * @param {string} source
   * @param {string} target
   * @returns {Promise<string[]>}
   */
  translate(texts, source, target) {
    return this.#send({ type: 'translate', texts, source, target })
  }
}

export const translateClient = new TranslateClient()
