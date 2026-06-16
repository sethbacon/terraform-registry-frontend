import AppsIcon from '@mui/icons-material/Apps'
import { IconButton, Tooltip } from '@mui/material'
import { useSuite } from '../hooks/useSuite'

const LABELS: Record<string, string> = {
  'terraform-registry': 'Terraform Registry',
  'terraform-state-manager': 'Terraform State Manager',
}

export function SuiteSwitcher() {
  const { sibling, active } = useSuite()
  if (!active || !sibling?.publicUrl) return null
  const label = LABELS[sibling.app] ?? sibling.app
  // Until both apps are confirmed to share one identity store + IdP
  // (sibling.sharedStore), opening the sibling in a new tab may require a
  // separate sign-in. Set that expectation honestly rather than implying SSO.
  const title = sibling.sharedStore
    ? `Open ${label}`
    : `Open ${label} (opens in a new tab; you may need to sign in)`
  return (
    <Tooltip title={title}>
      <IconButton
        color="inherit"
        aria-label={title}
        sx={{ mr: 1 }}
        onClick={() => {
          // Reuse one sibling tab across clicks: a stable window name (the
          // sibling's app id) re-navigates and refocuses the same tab instead of
          // spawning a new one each time. The sibling is a trusted first-party
          // suite app, so we intentionally omit noopener/noreferrer here — those
          // force a fresh browsing context and would defeat the tab reuse.
          window.open(sibling.publicUrl, sibling.app)?.focus()
        }}
      >
        <AppsIcon />
      </IconButton>
    </Tooltip>
  )
}
