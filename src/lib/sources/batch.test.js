import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * @typedef {Parameters<import('./shared.js').Source['fetch']>} SourceFetchArgs
 */

const enFetch = vi.fn()
const ruFetch = vi.fn()

vi.mock('./dyk.js', () => {
  return {
    dyk: { id: 'dyk', label: 'Did you know?', lang: 'en', perBatch: 2, fetch: (/** @type {SourceFetchArgs} */ ...a) => enFetch(...a) }
  }
})

vi.mock('./til.js', () => {
  return {
    til: { id: 'til', label: 'Today I Learned', lang: 'en', perBatch: 2, fetch: async () => [] }
  }
})

vi.mock('./factroom.js', () => {
  return {
    factroom: { id: 'factroom', label: 'Factroom', lang: 'ru', perBatch: 2, fetch: (/** @type {SourceFetchArgs} */ ...a) => ruFetch(...a) }
  }
})

/**
 * @param {string} id
 * @param {string} lang
 */
const fact = (id, lang) => {
  return { key: id, title: 't', url: 'u', link: 'u', fact: `fact ${id}`, lang }
}

beforeEach(() => {
  vi.clearAllMocks()
  enFetch.mockResolvedValue([fact('a', 'en')])
  ruFetch.mockResolvedValue([fact('b', 'ru')])
})

describe('fetchBatch', () => {
  it('draws from every source when the reader can read them all', async () => {
    const { fetchBatch } = await import('./index.js')
    const { facts } = await fetchBatch(() => true, () => false)

    expect(facts.map(f => f.key).sort()).toEqual(['a', 'b'])
  })

  it('does not fetch a source the reader cannot read', async () => {
    const { fetchBatch } = await import('./index.js')
    const { facts } = await fetchBatch(lang => lang === 'en', () => false)

    expect(facts.map(f => f.key)).toEqual(['a'])
    expect(ruFetch).not.toHaveBeenCalled()
  })

  it('gates English by the same rule, with no fallback', async () => {
    const { fetchBatch } = await import('./index.js')
    const { facts } = await fetchBatch(lang => lang === 'ru', () => false)

    expect(facts.map(f => f.key)).toEqual(['b'])
    expect(enFetch).not.toHaveBeenCalled()
  })

  it('returns nothing when no source is readable, rather than falling back', async () => {
    const { fetchBatch } = await import('./index.js')
    const { facts } = await fetchBatch(() => false, () => false)

    expect(facts).toEqual([])
  })

  it('lets one failing source degrade to empty without taking the batch down', async () => {
    enFetch.mockRejectedValue(new Error('Wikipedia is down'))

    const { fetchBatch } = await import('./index.js')
    const { facts, perSource } = await fetchBatch(() => true, () => false)

    expect(facts.map(f => f.key)).toEqual(['b'])
    expect(perSource.dyk).toBe(0)
  })

  it('passes the dedup predicate through to each source', async () => {
    const { fetchBatch } = await import('./index.js')
    const exclude = (/** @type {string} */ key) => key === 'a'

    await fetchBatch(() => true, exclude)

    expect(enFetch).toHaveBeenCalledWith(2, exclude)
  })
})

describe('SOURCE_LANGS', () => {
  it('lists each source language once, derived from the registry', async () => {
    const { SOURCE_LANGS } = await import('./index.js')

    expect([...SOURCE_LANGS].sort()).toEqual(['en', 'ru'])
  })
})
