/**
 * @typedef {Object} PrepareRequest
 * @property {'prepare'} type
 * @property {number} id
 * @property {string} source
 * @property {string} target
 * @property {boolean} debug
 * @property {string} [dtype]
 */

/**
 * @typedef {Object} TranslateRequest
 * @property {'translate'} type
 * @property {number} id
 * @property {string[]} texts
 * @property {string} source
 * @property {string} target
 * @property {boolean} debug
 * @property {string} [dtype]
 */

/**
 * @typedef {PrepareRequest | TranslateRequest} WorkerRequest
 */

/**
 * @typedef {Omit<PrepareRequest, 'id' | 'debug' | 'dtype'>
 *   | Omit<TranslateRequest, 'id' | 'debug' | 'dtype'>} WorkerRequestInit
 */

/**
 * @typedef {Object} ReadyMessage
 * @property {'ready'} type
 * @property {number} id
 * @property {string} dtype
 */

/**
 * @typedef {Object} ResultMessage
 * @property {'result'} type
 * @property {number} id
 * @property {string[]} texts
 */

/**
 * @typedef {Object} ProgressMessage
 * @property {'progress'} type
 * @property {number} id
 * @property {number} loaded
 * @property {number} total
 */

/**
 * @typedef {Object} ErrorMessage
 * @property {'error'} type
 * @property {number} id
 * @property {string} message
 */

/**
 * @typedef {ReadyMessage | ResultMessage | ProgressMessage | ErrorMessage} WorkerResponse
 */

export {}
