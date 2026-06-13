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
  return (
    <Tooltip title={`Open ${label}`}>
      <IconButton
        color="inherit"
        aria-label={`Open ${label}`}
        sx={{ mr: 1 }}
        onClick={() => window.open(sibling.publicUrl, '_blank', 'noopener,noreferrer')}
      >
        <AppsIcon />
      </IconButton>
    </Tooltip>
  )
}
