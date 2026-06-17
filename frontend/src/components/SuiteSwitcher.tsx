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
          // Claim this tab's name as our OWN app id before opening the sibling.
          // The suite has exactly two apps, so "self" is the other entry in
          // LABELS. Without this the original tab stays unnamed, so the sibling's
          // switcher can't find it by name and opens a *third* tab — the two apps
          // then ping-pong between two new tabs while the original is orphaned.
          // Naming this tab lets the sibling reuse it: only the original + one
          // sibling tab ever exist.
          const selfApp = Object.keys(LABELS).find((a) => a !== sibling.app)
          if (selfApp) window.name = selfApp
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
