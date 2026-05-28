export interface ReleasesGPGKeyCacheView {
  armored_present: boolean
  fingerprint: string
  fetched_at: string
  source_url: string
  key_expires_at?: string | null
  days_until_expiry?: number | null
}

export interface ReleasesGPGKeyEmbeddedView {
  fingerprint: string
  key_expires_at?: string | null
  days_until_expiry?: number | null
}

export type ReleasesGPGKeyStatus = 'ok' | 'warn' | 'expired' | 'unknown'

export interface ReleasesGPGKeyStatusView {
  tool: string
  cache: ReleasesGPGKeyCacheView | null
  embedded: ReleasesGPGKeyEmbeddedView | null
  effective_source: 'cache' | 'embedded'
  expiry_warning_days: number
  status: ReleasesGPGKeyStatus
}

export interface ReleasesGPGKeysResponse {
  keys: ReleasesGPGKeyStatusView[]
}
