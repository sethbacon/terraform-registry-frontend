import type { CreateMirrorConfigRequest } from '../../../types/mirror'

/**
 * The vocabulary and blank-form defaults shared by the mirror configuration
 * form, so the platform list and the "what a new mirror looks like" defaults
 * live in one place instead of being spelled out twice (once as the initial
 * `useState` value and once again inside `resetForm`).
 */

/** Known Terraform provider platform combinations (os/arch). */
export const KNOWN_PLATFORMS = [
  'linux/amd64',
  'linux/arm64',
  'linux/386',
  'linux/arm',
  'darwin/amd64',
  'darwin/arm64',
  'windows/amd64',
  'windows/386',
  'windows/arm64',
  'freebsd/amd64',
  'freebsd/386',
  'freebsd/arm',
] as const

/**
 * The blank create-form draft: a new provider mirror points at the public
 * Terraform registry, is enabled, syncs daily, and — unlike the Terraform
 * binary mirror next door, whose `emptyCreate` defaults `requires_approval`
 * to true — does NOT require approval. That divergence is deliberate and
 * predates #783; it is preserved here rather than harmonised.
 */
export const emptyMirrorForm = (): Partial<CreateMirrorConfigRequest> => ({
  name: '',
  description: '',
  upstream_registry_url: 'https://registry.terraform.io',
  namespace_filter: [],
  provider_filter: [],
  version_filter: '',
  enabled: true,
  sync_interval_hours: 24,
  requires_approval: false,
  auto_approve_rules: '',
  pull_through_enabled: false,
  pull_through_cache_ttl_hours: 24,
})
