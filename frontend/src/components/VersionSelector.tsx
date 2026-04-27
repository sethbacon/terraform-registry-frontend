import { useEffect, useMemo, useState } from 'react'
import {
  FormControl,
  FormControlLabel,
  Select,
  MenuItem,
  Switch,
  Stack,
  Alert,
} from '@mui/material'

export interface VersionSelectorItem {
  id: string
  version: string
  deprecated?: boolean
}

export interface VersionSelectorProps<V extends VersionSelectorItem> {
  versions: V[]
  selectedVersion: V | null
  onSelectVersion: (version: V) => void
  /** localStorage key for persisting the show-deprecated toggle. */
  storageKey?: string
  /** Optional test id for the selector root. */
  'data-testid'?: string
}

const DEFAULT_STORAGE_KEY = 'showDeprecatedVersions'

function readStoredPreference(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function writeStoredPreference(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false')
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

function VersionSelector<V extends VersionSelectorItem>({
  versions,
  selectedVersion,
  onSelectVersion,
  storageKey = DEFAULT_STORAGE_KEY,
  'data-testid': testId = 'version-selector',
}: VersionSelectorProps<V>) {
  const [showDeprecated, setShowDeprecated] = useState<boolean>(() =>
    readStoredPreference(storageKey),
  )

  useEffect(() => {
    writeStoredPreference(storageKey, showDeprecated)
  }, [showDeprecated, storageKey])

  const hasAnyNonDeprecated = useMemo(() => versions.some((v) => !v.deprecated), [versions])
  const allDeprecated = versions.length > 0 && !hasAnyNonDeprecated

  // When all versions are deprecated, always show them regardless of toggle.
  const effectiveShowDeprecated = showDeprecated || allDeprecated

  const visibleVersions = useMemo(
    () => (effectiveShowDeprecated ? versions : versions.filter((v) => !v.deprecated)),
    [versions, effectiveShowDeprecated],
  )

  // If the current selection is filtered out, fall back to the first visible version.
  useEffect(() => {
    if (!selectedVersion) return
    if (visibleVersions.some((v) => v.id === selectedVersion.id)) return
    const fallback = visibleVersions[0]
    if (fallback) onSelectVersion(fallback)
  }, [visibleVersions, selectedVersion, onSelectVersion])

  const latestNonDeprecated = useMemo(() => versions.find((v) => !v.deprecated), [versions])

  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" data-testid={testId}>
      <FormControl size="small" sx={{ minWidth: 220 }}>
        <Select
          value={
            selectedVersion && visibleVersions.some((v) => v.id === selectedVersion.id)
              ? selectedVersion.version
              : ''
          }
          onChange={(e) => {
            const next = versions.find((v) => v.version === e.target.value)
            if (next) onSelectVersion(next)
          }}
          displayEmpty
          inputProps={{ 'data-testid': `${testId}-select` }}
        >
          {visibleVersions.map((v) => (
            <MenuItem
              key={v.id}
              value={v.version}
              sx={{ color: v.deprecated ? 'text.disabled' : 'inherit' }}
            >
              v{v.version}
              {latestNonDeprecated?.id === v.id ? ' (latest)' : ''}
              {v.deprecated ? ' [DEPRECATED]' : ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showDeprecated}
            onChange={(e) => setShowDeprecated(e.target.checked)}
            inputProps={{
              'aria-label': 'Show deprecated versions',
              // @ts-expect-error data-testid is accepted by native input
              'data-testid': `${testId}-toggle`,
            }}
          />
        }
        label="Show deprecated"
      />
      {allDeprecated && (
        <Alert severity="warning" data-testid={`${testId}-all-deprecated`} sx={{ py: 0 }}>
          All versions of this module are deprecated.
        </Alert>
      )}
    </Stack>
  )
}

export default VersionSelector
