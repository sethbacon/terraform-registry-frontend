import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslation from './locales/en/translation.json'
import esTranslation from './locales/es/translation.json'
import frTranslation from './locales/fr/translation.json'
import deTranslation from './locales/de/translation.json'
import jaTranslation from './locales/ja/translation.json'
import ptTranslation from './locales/pt/translation.json'
import nlTranslation from './locales/nl/translation.json'
import nbTranslation from './locales/nb/translation.json'
import zhTranslation from './locales/zh/translation.json'
import itTranslation from './locales/it/translation.json'

// Non-English locales are machine-translated via DeepL. The translation
// script (scripts/translate.mjs) tracks source hashes to detect stale
// translations when English strings change.

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      es: { translation: esTranslation },
      fr: { translation: frTranslation },
      de: { translation: deTranslation },
      ja: { translation: jaTranslation },
      pt: { translation: ptTranslation },
      nl: { translation: nlTranslation },
      nb: { translation: nbTranslation },
      zh: { translation: zhTranslation },
      it: { translation: itTranslation },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'ja', 'pt', 'nl', 'nb', 'zh', 'it'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      // React already escapes output — no double-escaping needed.
      //
      // SAFETY INVARIANT (issue #478): escapeValue:false is only safe while
      // every translated string is rendered through React JSX, which escapes
      // for us. That holds today: locale resources are statically bundled,
      // there is no <Trans> usage, and dangerouslySetInnerHTML is banned by
      // lint (no-restricted-syntax in eslint.config.js). If a <Trans>-based
      // rich-text pattern or any HTML sink for translated/interpolated values
      // is ever introduced, re-enable escaping for user-supplied interpolation
      // values (or sanitize them explicitly) as part of that change.
      escapeValue: false,
    },
  })

export default i18n

// Type augmentation for i18next. We intentionally use Record<string, unknown>
// rather than `typeof enTranslation` to avoid a TypeScript compiler crash
// ("Debug Failure. No error for last overload signature") that occurs when the
// key union grows large enough (140+ keys) to overflow TS overload resolution.
// Translation completeness is enforced by the translation script rather than
// compile-time key checking.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: Record<string, unknown>
    }
  }
}
