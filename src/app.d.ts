// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Chrome's built-in Translator API. Not in lib.dom yet, so we declare the
  // slice of it src/lib/translate/builtin.js uses.
  // https://developer.chrome.com/docs/ai/translator-api

  type TranslatorAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

  interface TranslatorLanguagePair {
    sourceLanguage: string
    targetLanguage: string
  }

  interface TranslatorDownloadMonitor {
    // `loaded` is a 0..1 fraction here, not a byte count.
    addEventListener(type: 'downloadprogress', listener: (event: ProgressEvent) => void): void
  }

  interface TranslatorInstance {
    translate(input: string): Promise<string>
  }

  interface TranslatorFactory {
    availability(pair: TranslatorLanguagePair): Promise<TranslatorAvailability>
    create(options: TranslatorLanguagePair & {
      monitor?: (monitor: TranslatorDownloadMonitor) => void
    }): Promise<TranslatorInstance>
  }

  // eslint-disable-next-line no-var, vars-on-top
  var Translator: TranslatorFactory | undefined
}

export {}
