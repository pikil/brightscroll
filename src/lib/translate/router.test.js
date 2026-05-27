import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('$lib/capabilities/debug.js', () => {
  return { consoleLog: () => {}, enabled: () => false, setEnabled: () => {} }
})

vi.mock('./builtin.js', () => {
  return {
    name: 'builtin',
    possible: true,
    prepare: vi.fn(),
    translate: vi.fn(),
    availability: vi.fn()
  }
})

vi.mock('./opus.js', () => {
  return {
    name: 'opus',
    possible: true,
    prepare: vi.fn(),
    translate: vi.fn()
  }
})

const freshRouter = async () => {
  vi.resetModules()

  const builtin = await import('./builtin.js')
  const opus = await import('./opus.js')
  const router = await import('./index.js')

  return { builtin, opus, router }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('backend preference', () => {
  it('routes a pair to the built-in API when it can handle it, without touching opus-mt', async () => {
    const { builtin, opus, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(true)
    vi.mocked(builtin.translate).mockResolvedValue('Wusstest du schon')

    expect(await router.prepare('en', 'de')).toBe(true)
    expect(await router.translate('Did you know', 'en', 'de'))
      .toEqual({ text: 'Wusstest du schon', via: 'builtin' })

    expect(opus.prepare).not.toHaveBeenCalled()
  })

  it('falls back to opus-mt when the built-in API cannot handle the pair', async () => {
    const { builtin, opus, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(false)
    vi.mocked(opus.prepare).mockResolvedValue(true)
    vi.mocked(opus.translate).mockResolvedValue('Wusstest du schon')

    expect(await router.prepare('en', 'de')).toBe(true)
    expect(await router.translate('Did you know', 'en', 'de'))
      .toEqual({ text: 'Wusstest du schon', via: 'opus' })
  })

  it('reports a pair no backend can handle', async () => {
    const { builtin, opus, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(false)
    vi.mocked(opus.prepare).mockResolvedValue(false)

    expect(await router.prepare('ru', 'de')).toBe(false)
    expect(await router.translate('Знаете ли вы', 'ru', 'de')).toBeNull()
  })
})

describe('per-pair independence', () => {
  it('keeps one unroutable pair from disabling another', async () => {
    const { builtin, opus, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(false)
    vi.mocked(opus.prepare).mockImplementation(async source => source === 'en')

    const [en, ru] = await Promise.all([
      router.prepare('en', 'de'),
      router.prepare('ru', 'de')
    ])

    expect(en).toBe(true)
    expect(ru).toBe(false)
  })

  it('resolves each pair once and reuses the answer', async () => {
    const { builtin, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(true)

    await router.prepare('en', 'de')
    await router.prepare('en', 'de')

    expect(builtin.prepare).toHaveBeenCalledTimes(1)
    expect(router.backendFor('en', 'de')).toBe('builtin')
  })

  it('does not resolve twice when the same pair is requested concurrently', async () => {
    const { builtin, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(true)

    await Promise.all([router.prepare('ru', 'en'), router.prepare('ru', 'en')])

    expect(builtin.prepare).toHaveBeenCalledTimes(1)
  })
})

describe('degenerate input', () => {
  it('treats a post already in the reader language as needing nothing', async () => {
    const { builtin, router } = await freshRouter()

    expect(await router.prepare('en', 'en')).toBe(true)
    expect(await router.translate('Did you know', 'en', 'en')).toBeNull()
    expect(builtin.prepare).not.toHaveBeenCalled()
  })

  it('returns null when the backend yields nothing, leaving the fact as it is', async () => {
    const { builtin, router } = await freshRouter()

    vi.mocked(builtin.prepare).mockResolvedValue(true)
    vi.mocked(builtin.translate).mockResolvedValue(null)

    expect(await router.translate('Did you know', 'en', 'de')).toBeNull()
  })

  it('ignores empty text', async () => {
    const { router } = await freshRouter()

    expect(await router.translate('', 'en', 'de')).toBeNull()
  })
})
