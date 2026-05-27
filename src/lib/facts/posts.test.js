import { describe, it, expect } from 'vitest'
import { buildPosts } from './posts.js'

/**
 * @param {Partial<import('$lib/sources/shared.js').Fact>} [over]
 * @returns {import('$lib/sources/shared.js').Fact}
 */
const fact = (over) => {
  return {
    key: 'Tim Berners-Lee',
    title: 'Tim Berners-Lee',
    url: 'https://en.wikipedia.org/wiki/Tim_Berners-Lee',
    link: 'https://en.wikipedia.org/wiki/Tim_Berners-Lee',
    fact: 'Tim Berners-Lee invented the World Wide Web in 1989',
    lang: 'en',
    ...over
  }
}

describe('buildPosts', () => {
  it('carries the fact text through untouched', () => {
    const text = 'Tim Berners-Lee invented the World Wide Web in 1989'

    expect(buildPosts([fact({ fact: text })])[0].fact).toBe(text)
  })

  it('keeps the source language, so the feed knows what needs translating', () => {
    expect(buildPosts([fact({ lang: 'ru' })])[0].lang).toBe('ru')
  })

  it('gives the same source item the same hash across batches', () => {
    const [a] = buildPosts([fact()])
    const [b] = buildPosts([fact()])

    expect(a.hash).toBe(b.hash)
  })

  it('distinguishes different source items', () => {
    const [a] = buildPosts([fact({ key: 'Aardvark' })])
    const [b] = buildPosts([fact({ key: 'Zebra' })])

    expect(a.hash).not.toBe(b.hash)
  })

  it('falls back to the canonical url when a source gives no outbound link', () => {
    const built = buildPosts([fact({ link: '', url: 'https://example.com/x' })])

    expect(built[0].link).toBe('https://example.com/x')
  })

  it('carries an image only when the source supplied one', () => {
    const [withImage] = buildPosts([fact({ image: 'https://example.com/i.jpg' })])
    const [without] = buildPosts([fact()])

    expect(withImage.image).toBe('https://example.com/i.jpg')
    expect(without).not.toHaveProperty('image')
  })

  it('handles a whole batch, giving each post a distinct id', () => {
    const built = buildPosts([fact({ key: 'a' }), fact({ key: 'b' }), fact({ key: 'c' })])

    expect(new Set(built.map(p => p.id)).size).toBe(3)
  })
})
