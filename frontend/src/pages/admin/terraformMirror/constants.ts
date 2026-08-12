import type { CreateTerraformMirrorConfigRequest } from '../../../types/terraform_mirror'

/**
 * The upstream-tool vocabulary shared by the create and edit mirror dialogs, so
 * a new tool is added in exactly one place rather than in two dialog bodies.
 */

/** Known Terraform binary platform combinations (os/arch). */
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

const TOOL_DEFAULT_URLS: Record<string, string> = {
  terraform: 'https://releases.hashicorp.com',
  opentofu: 'https://github.com/opentofu/opentofu',
  packer: 'https://releases.hashicorp.com',
  sentinel: 'https://releases.hashicorp.com',
  opa: 'https://github.com/open-policy-agent/opa',
  'terraform-docs': 'https://github.com/terraform-docs/terraform-docs',
}

/** Returns the canonical upstream URL for a known tool, or '' for custom. */
export function toolDefaultUrl(tool: string): string {
  return TOOL_DEFAULT_URLS[tool] ?? ''
}

/**
 * SUPPORTED_TOOLS is the single source of truth for the selectable upstream
 * tools in both the create and edit dialogs, so a new tool is added in exactly
 * one place. "custom" is rendered separately because its label is translated.
 */
export const SUPPORTED_TOOLS: readonly { value: string; label: string }[] = [
  { value: 'terraform', label: 'Terraform (HashiCorp)' },
  { value: 'opentofu', label: 'OpenTofu' },
  { value: 'packer', label: 'Packer (HashiCorp)' },
  { value: 'sentinel', label: 'Sentinel (HashiCorp)' },
  { value: 'opa', label: 'OPA (Open Policy Agent)' },
  { value: 'terraform-docs', label: 'terraform-docs' },
]

/** The blank create-dialog form: a fresh mirror is stable-only and gated on approval. */
export const emptyCreate = (): CreateTerraformMirrorConfigRequest => ({
  name: '',
  description: '',
  tool: 'terraform',
  upstream_url: toolDefaultUrl('terraform'),
  gpg_verify: true,
  stable_only: true,
  enabled: true,
  sync_interval_hours: 24,
  requires_approval: true,
})
