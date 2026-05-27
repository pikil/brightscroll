import { describe, it, expect } from 'vitest'
import { parseHooks } from './dyk.js'
import { cleanTitle } from './til.js'
import { leadParagraph } from './factroom.js'

describe('dyk.parseHooks', () => {
  it('extracts a hook and its article, dropping "... that" and the trailing "?"', () => {
    const wikitext = "* ... that '''[[Tim Berners-Lee]]''' invented the World Wide Web in 1989?"
    const [hook] = parseHooks(wikitext)

    expect(hook).toMatchObject({
      key: 'Tim Berners-Lee',
      title: 'Tim Berners-Lee',
      fact: 'Tim Berners-Lee invented the World Wide Web in 1989',
      lang: 'en',
      url: 'https://en.wikipedia.org/wiki/Tim_Berners-Lee'
    })
  })

  it('resolves piped links to their display text', () => {
    const wikitext = "* ... that '''[[Aardvark]]''' eats [[Formicidae|ants]] every single night?"

    expect(parseHooks(wikitext)[0].fact).toBe('Aardvark eats ants every single night')
  })

  it('expands {{convert}} and strips "(pictured)"', () => {
    const wikitext = "* ... that '''[[Big Tree]]''' (pictured) stands {{convert|88.5|ft|m}} tall?"

    expect(parseHooks(wikitext)[0].fact).toBe('Big Tree stands 88.5 ft tall')
  })

  it('drops lines with markup the cleaner did not fully resolve', () => {
    const wikitext = "* ... that '''[[Thing]]''' has a {{weird|unclosed template that survives?"

    expect(parseHooks(wikitext)).toEqual([])
  })

  it('ignores lines that are not hooks', () => {
    expect(parseHooks('== Heading ==\nSome prose.\n* A plain bullet.')).toEqual([])
  })
})

describe('til.cleanTitle', () => {
  it('strips the TIL prefix and capitalises', () => {
    expect(cleanTitle('TIL that octopuses have three hearts and blue blood'))
      .toBe('Octopuses have three hearts and blue blood')
  })

  it('handles the punctuated prefix variants', () => {
    expect(cleanTitle('TIL: honey never spoils, not even after millennia'))
      .toBe('Honey never spoils, not even after millennia')
  })

  it('collapses runaway whitespace', () => {
    expect(cleanTitle('TIL   spaces    everywhere here')).toBe('Spaces everywhere here')
  })
})

describe('factroom.leadParagraph', () => {
  it('takes the opening paragraph, skipping the image and its caption', () => {
    const html = '<figure><img src="x.jpg" /><figcaption>Джимми Картер</figcaption></figure>'
      + '<p class="wp-block-paragraph">Мёд не портится никогда.</p>'

    expect(leadParagraph(html)).toBe('Мёд не портится никогда.')
  })

  it('keeps the whole fact, including a punchline past the old excerpt cut', () => {
    const html = '<p>Картер начал речь с шутки. «Как вам удалось передать американский юмор?» —'
      + ' поинтересовался Картер у переводчика после выступления. «Я сказал: „Президент рассказал'
      + ' смешную историю, все должны засмеяться!“» — признался находчивый переводчик.</p>'

    expect(leadParagraph(html)).toContain('все должны засмеяться')
  })

  it('drops the "Читайте также" trailer paragraph', () => {
    const html = '<p>Кошки спят по 16 часов в сутки.</p>'
      + '<p><big>Читайте также: <a href="/x">Нелепые высказывания</a></big></p>'

    expect(leadParagraph(html)).toBe('Кошки спят по 16 часов в сутки.')
  })

  it('yields nothing when the post opens with the trailer instead of a fact', () => {
    expect(leadParagraph('<p>Читайте также: Подборка ссылок</p>')).toBe('')
  })

  it('decodes entities so the translator is fed real characters', () => {
    const html = '<p>&laquo;Кавычки&raquo; и тире&nbsp;&mdash; вот так.</p>'

    expect(leadParagraph(html)).toBe('«Кавычки» и тире — вот так.')
  })

  it('yields nothing for a post with no paragraphs at all', () => {
    expect(leadParagraph('<figure><img src="puzzle.jpg" /></figure>')).toBe('')
  })
})
