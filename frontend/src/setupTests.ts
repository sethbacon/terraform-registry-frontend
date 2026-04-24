import '@testing-library/jest-dom'

// Initialise i18next so that useTranslation() returns English translations in
// every unit test — prevents react-i18next from suspending the render.
import './i18n'

// Node.js 22+/25+ provides a built-in globalThis.localStorage that has a different
// API from the Web Storage spec (no .getItem/.setItem/.removeItem/.clear methods).
// Vitest DOM environments (jsdom/happy-dom) set up a proper Web Storage on `window`,
// but `globalThis.localStorage` still points to Node's built-in.
// Replace it with a spec-compliant in-memory implementation.
const store: Record<string, string> = {}
const webStorage: Storage = {
  getItem(key: string) { return store[key] ?? null },
  setItem(key: string, value: string) { store[key] = String(value) },
  removeItem(key: string) { delete store[key] },
  clear() { Object.keys(store).forEach(k => delete store[k]) },
  key(index: number) { return Object.keys(store)[index] ?? null },
  get length() { return Object.keys(store).length },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: webStorage,
  writable: true,
  configurable: true,
})
