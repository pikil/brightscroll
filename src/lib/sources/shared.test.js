import { describe, it, expect } from 'vitest'
import { decodeEntities, stripHtml, orEmpty, shuffle } from './shared.js'

describe('decodeEntities', () => {
  it('decodes the named entities the sources actually emit', () => {
    expect(decodeEntities('Tom &amp; Jerry &laquo;quoted&raquo; &mdash; done'))
      .toBe('Tom & Jerry «quoted» — done')
  })

  it('decodes decimal and hex numeric references', () => {
    expect(decodeEntities('caf&#233; &#x2014; bar')).toBe('café — bar')
  })
})

describe('stripHtml', () => {
  it('removes markup and collapses the whitespace it leaves behind', () => {
    expect(stripHtml('<p>A <b>bold</b>   claim</p>')).toBe('A bold claim')
  })

  it('decodes entities that were hiding behind tags', () => {
    expect(stripHtml('<p>Tom &amp; Jerry&nbsp;&mdash; again</p>')).toBe('Tom & Jerry — again')
  })

  it('leaves an unlisted named entity alone rather than mangling it', () => {
    expect(stripHtml('<p>Caf&eacute;</p>')).toBe('Caf&eacute;')
  })

  it('pulls punctuation back onto the word an inline tag detached it from', () => {
    expect(stripHtml('<p>Принадлежит <a href="/x">США</a>, второй — <a href="/y">России</a>.</p>'))
      .toBe('Принадлежит США, второй — России.')
  })

  it('does not strip the spacing around an em dash', () => {
    expect(stripHtml('<p>Один — <b>два</b> — три.</p>')).toBe('Один — два — три.')
  })
})

describe('orEmpty', () => {
  it('passes through a successful result', async () => {
    expect(await orEmpty(async () => [1, 2])).toEqual([1, 2])
  })

  it('turns a throwing source into an empty batch, so siblings still load', async () => {
    expect(await orEmpty(async () => { throw new Error('API down') })).toEqual([])
  })
})

describe('shuffle', () => {
  it('preserves every element and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input)

    expect(out).toHaveLength(5)
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
    expect(input).toEqual([1, 2, 3, 4, 5])
  })
})
