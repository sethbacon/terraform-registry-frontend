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

export type ReleasesGPGKeyStatus = 'ok' | 'warn' | 'expired' | 'unknown' | 'unsigned' | 'attested'

export interface ReleasesGPGKeyStatusView {
  tool: string
  cache: ReleasesGPGKeyCacheView | null
  embedded: ReleasesGPGKeyEmbeddedView | null
  // 'none' is used for configured binaries with no managed signing key. Tools
  // whose upstream publishes no release signature at all (e.g. opa — checksum
  // only) carry null cache/embedded, a 'none' source, and an 'unsigned' status;
  // genuinely unclassified tools keep 'unknown'. When such a tool has
  // verify_github_attestation enabled, it instead carries an 'attestation'
  // source and 'attested' status — checksum plus a pinned-identity GitHub
  // Artifact Attestation (Sigstore), distinct from checksum-only 'unsigned'.
  effective_source: 'cache' | 'embedded' | 'none' | 'attestation'
  expiry_warning_days: number
  status: ReleasesGPGKeyStatus
}

export interface ReleasesGPGKeysResponse {
  keys: ReleasesGPGKeyStatusView[]
}
