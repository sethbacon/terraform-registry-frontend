import React from 'react'
import { Avatar, Box } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAws, faMicrosoft } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { siHashicorp, siVmware, siGooglecloud, siGoogle } from 'simple-icons'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimpleIconDef {
  path: string
  hex: string
  title: string
}

/** 'si'     → simple-icons SVG path
 *  'fa'     → Font Awesome brand icon (designed for small-size rendering)
 *  'avatar' → branded MUI Avatar with an abbreviation */
type IconStrategy =
  | { kind: 'si'; icon: SimpleIconDef }
  | { kind: 'fa'; icon: IconDefinition; color: string }
  | { kind: 'avatar'; abbrev: string; color: string }

interface ProviderConfig {
  displayName: string
  strategy: IconStrategy
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const PROVIDERS: Record<string, ProviderConfig> = {
  aws: {
    displayName: 'AWS',
    strategy: { kind: 'fa', icon: faAws, color: '#FF9900' },
  },
  azurerm: {
    displayName: 'Azure',
    strategy: { kind: 'fa', icon: faMicrosoft, color: '#0089D6' },
  },
  azure: {
    displayName: 'Azure',
    strategy: { kind: 'fa', icon: faMicrosoft, color: '#0089D6' },
  },
  hashicorp: {
    displayName: 'HashiCorp',
    strategy: { kind: 'si', icon: siHashicorp },
  },
  oci: {
    displayName: 'Oracle Cloud',
    strategy: { kind: 'avatar', abbrev: 'OCI', color: '#C74634' },
  },
  oracle: {
    displayName: 'Oracle',
    strategy: { kind: 'avatar', abbrev: 'OC', color: '#C74634' },
  },
  microsoft: {
    displayName: 'Microsoft',
    strategy: { kind: 'fa', icon: faMicrosoft, color: '#0089D6' },
  },
  google: {
    displayName: 'Google',
    strategy: { kind: 'si', icon: siGoogle },
  },
  googlecloud: {
    displayName: 'Google Cloud',
    strategy: { kind: 'si', icon: siGooglecloud },
  },
  vsphere: {
    displayName: 'VMware vSphere',
    strategy: { kind: 'si', icon: siVmware },
  },
  vcenter: {
    displayName: 'VMware vCenter',
    strategy: { kind: 'si', icon: siVmware },
  },
  vmware: {
    displayName: 'VMware',
    strategy: { kind: 'si', icon: siVmware },
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the human-readable display name for a provider slug. */
export function providerDisplayName(slug: string): string {
  return (
    PROVIDERS[slug.toLowerCase()]?.displayName ??
    // Fallback: title-case the raw slug for unknown providers
    slug.charAt(0).toUpperCase() + slug.slice(1)
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProviderIconProps {
  provider: string
  /** Icon size in px (default 28). */
  size?: number
}

/** Renders a recognisable icon for known Terraform providers.
 *  Returns null for unknown providers so the caller can decide whether to
 *  show a fallback itself. */
export const ProviderIcon: React.FC<ProviderIconProps> = ({ provider, size = 28 }) => {
  const config = PROVIDERS[provider.toLowerCase()]
  if (!config) return null

  const { strategy } = config

  if (strategy.kind === 'fa') {
    return (
      <Box
        component="span"
        aria-label={config.displayName}
        sx={{
          display: 'inline-flex',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: strategy.color,
        }}
      >
        <FontAwesomeIcon icon={strategy.icon} style={{ width: size, height: size }} />
      </Box>
    )
  }

  if (strategy.kind === 'si') {
    return (
      <Box
        component="svg"
        role="img"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-label={config.displayName}
        sx={{ fill: `#${strategy.icon.hex}`, flexShrink: 0 }}
      >
        <path d={strategy.icon.path} />
      </Box>
    )
  }

  // avatar fallback
  const fontSize = strategy.abbrev.length >= 3 ? `${size * 0.28}px` : `${size * 0.34}px`

  return (
    <Avatar
      aria-label={config.displayName}
      sx={{
        bgcolor: strategy.color,
        width: size,
        height: size,
        fontSize,
        fontWeight: 700,
        letterSpacing: strategy.abbrev.length > 2 ? '-0.03em' : undefined,
        flexShrink: 0,
      }}
    >
      {strategy.abbrev}
    </Avatar>
  )
}
