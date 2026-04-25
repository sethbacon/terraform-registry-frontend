import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import frTranslation from './locales/fr/translation.json';
import deTranslation from './locales/de/translation.json';
import jaTranslation from './locales/ja/translation.json';

// Machine-translated locales are baseline placeholders flagged for human review.
// All non-English strings carry a // MACHINE_TRANSLATED marker in the contributing
// notes — see CONTRIBUTING.md §Translation workflow.

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
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'ja'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      // React already escapes output — no double-escaping needed.
      escapeValue: false,
    },
  });

export default i18n;

// Type augmentation for i18next. We intentionally use Record<string, unknown>
// rather than `typeof enTranslation` to avoid a TypeScript compiler crash
// ("Debug Failure. No error for last overload signature") that occurs when the
// key union grows large enough (140+ keys) to overflow TS overload resolution.
// Translation completeness is enforced via Crowdin rather than compile-time key
// checking.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: Record<string, unknown>;
    };
  }
}
