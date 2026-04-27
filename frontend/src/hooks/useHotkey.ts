import { useEffect } from 'react'

/**
 * Normalised hotkey hook. Listens for a key combination on `window` and fires
 * the provided callback. The `combo` is a plus-separated list like `mod+k`
 * where `mod` maps to `meta` on macOS and `ctrl` elsewhere.
 */
export function useHotkey(
  combo: string,
  callback: (event: KeyboardEvent) => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {},
): void {
  const { enabled = true, preventDefault = true } = options

  useEffect(() => {
    if (!enabled) return

    const parts = combo
      .toLowerCase()
      .split('+')
      .map((p) => p.trim())
    const key = parts[parts.length - 1]
    const wantMod = parts.includes('mod')
    const wantShift = parts.includes('shift')
    const wantAlt = parts.includes('alt')

    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key) return
      const modDown = event.metaKey || event.ctrlKey
      if (wantMod && !modDown) return
      if (!wantMod && modDown) return
      if (wantShift !== event.shiftKey) return
      if (wantAlt !== event.altKey) return

      if (preventDefault) event.preventDefault()
      callback(event)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [combo, callback, enabled, preventDefault])
}

export default useHotkey
