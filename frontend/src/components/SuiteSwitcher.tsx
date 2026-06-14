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
        onClick={() => window.open(sibling.publicUrl, '_blank', 'noopener,noreferrer')}
      >
        <AppsIcon />
      </IconButton>
    </Tooltip>
  )
}
