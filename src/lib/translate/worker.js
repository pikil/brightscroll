import { pipeline, env } from '@huggingface/transformers'
import { consoleLog, setEnabled } from '$lib/capabilities/debug.js'

env.allowLocalModels = false

/**
 * @typedef {import('./protocol.js').WorkerRequest} WorkerRequest
 * @typedef {import('./protocol.js').WorkerResponse} WorkerResponse
 * @typedef {import('@huggingface/transformers').DataType} DataType
 * @typedef {import('@huggingface/transformers').TranslationPipeline} TranslationPipeline
 */

/**
 * @type {DataType[]}
 */
const DTYPES = ['q8', 'q4f16']

/**
 * @type {Map<string, Promise<TranslationPipeline>>}
 */
const pipelines = new Map()

let workingDtype = ''

/**
 * @param {string} source
 * @param {string} target
 */
const repoFor = (source, target) => `Xenova/opus-mt-${source}-${target}`

/**
 * @param {WorkerResponse} msg
 */
const post = (msg) => {
  self.postMessage(msg)
}

/**
 * @param {string} message
 */
const isMissingModel = message => /could not locate|404|unauthorized|not found/i.test(message)

/**
 * @param {string} [value]
 * @returns {DataType | undefined}
 */
const knownDtype = value => DTYPES.find(d => d === value)

/**
 * @param {number} id
 * @param {string} repo
 * @param {DataType} dtype
 * @returns {Promise<TranslationPipeline>}
 */
const build = async (id, repo, dtype) => {
  consoleLog('worker:try-dtype', { repo, dtype })

  const p = await pipeline('translation', repo, {
    device: 'wasm',
    dtype,
    progress_callback: (progress) => {
      if (progress.status !== 'progress_total')
        return

      post({ type: 'progress', id, loaded: progress.loaded ?? 0, total: progress.total ?? 0 })
    }
  })

  consoleLog('worker:session-ready', { repo, dtype })
  workingDtype = dtype

  return p
}

/**
 * @param {number} id
 * @param {string} source
 * @param {string} target
 * @param {string} [preferred]
 * @returns {Promise<TranslationPipeline>}
 */
const load = (id, source, target, preferred) => {
  const pair = `${source}-${target}`
  const existing = pipelines.get(pair)

  if (existing)
    return existing

  const repo = repoFor(source, target)
  const first = knownDtype(preferred)
  const order = first
    ? [first, ...DTYPES.filter(d => d !== first)]
    : DTYPES

  consoleLog('worker:load-begin', { repo, order })

  const created = order.reduce(
    (chain, dtype) => chain.catch((/** @type {unknown} */ err) => {
      if (err !== null) {
        const message = err instanceof Error ? err.message : String(err)

        consoleLog('worker:dtype-failed', { repo, message })

        if (isMissingModel(message))
          throw err
      }

      return build(id, repo, dtype)
    }),
    /** @type {Promise<TranslationPipeline>} */ (Promise.reject(null))
  ).catch((/** @type {unknown} */ err) => {
    consoleLog('worker:load-failed', {
      repo,
      message: err instanceof Error ? err.message : String(err)
    })

    pipelines.delete(pair)
    throw err
  })

  pipelines.set(pair, created)

  return created
}

/**
 * @param {WorkerRequest} req
 */
const handle = async (req) => {
  if (req.type === 'prepare') {
    await load(req.id, req.source, req.target, req.dtype)
    post({ type: 'ready', id: req.id, dtype: workingDtype })

    return
  }

  const translator = await load(req.id, req.source, req.target, req.dtype)
  const output = await translator(req.texts)
  const list = Array.isArray(output) ? output : [output]

  post({
    type: 'result',
    id: req.id,
    texts: list.map(o => String(o?.translation_text ?? ''))
  })
}

self.addEventListener('message', (/** @type {MessageEvent<WorkerRequest>} */ event) => {
  const req = event.data

  setEnabled(req.debug)

  handle(req).catch((/** @type {unknown} */ err) => {
    const message = err instanceof Error ? err.message : 'Translation failed'

    post({ type: 'error', id: req.id, message })
  })
})
