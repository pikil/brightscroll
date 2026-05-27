/**
 * @typedef {Object} Language
 * @property {string} code
 * @property {string} label
 * @property {string} name
 * @property {boolean} [rtl]
 */

/**
 * @type {readonly Language[]}
 */
export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English', name: 'English' },
  { code: 'zh', label: '中文', name: 'Simplified Chinese' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
  { code: 'es', label: 'Español', name: 'Spanish' },
  { code: 'fr', label: 'Français', name: 'French' },
  { code: 'ar', label: 'العربية', name: 'Arabic', rtl: true },
  { code: 'pt', label: 'Português', name: 'Portuguese' },
  { code: 'ru', label: 'Русский', name: 'Russian' },
  { code: 'id', label: 'Bahasa Indonesia', name: 'Indonesian' },
  { code: 'de', label: 'Deutsch', name: 'German' },
  { code: 'ja', label: '日本語', name: 'Japanese' },
  { code: 'ko', label: '한국어', name: 'Korean' },
  { code: 'it', label: 'Italiano', name: 'Italian' }
])

export const DEFAULT_LANGUAGE = 'en'

/**
 * @param {string} code
 * @returns {string}
 */
export const languageName = code =>
  LANGUAGES.find(l => l.code === code)?.name ?? 'English'

/**
 * @param {string} code
 * @returns {boolean}
 */
export const isRtl = code => LANGUAGES.find(l => l.code === code)?.rtl === true
