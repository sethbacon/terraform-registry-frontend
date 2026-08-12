import React from 'react'
import { Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { syncStatusColor } from '../../../types/terraform_mirror'

/**
 * The two one-line chips the mirror admin UI repeats: a sync-status chip used by
 * the config card, the versions table and the history table, and a tool chip
 * used by the config card and the versions dialog title.
 */

export const SyncStatusChip: React.FC<{ status: string; size?: 'small' | 'medium' }> = ({
  status,
  size = 'small',
}) => (
  <Chip
    label={status}
    color={syncStatusColor(status)}
    size={size}
    icon={
      status === 'synced' || status === 'success' ? (
        <CheckCircleIcon />
      ) : status === 'failed' ? (
        <ErrorIcon />
      ) : undefined
    }
  />
)

export const ToolChip: React.FC<{ tool: string }> = ({ tool }) => {
  const color = tool === 'terraform' ? 'primary' : tool === 'opentofu' ? 'secondary' : 'default'
  return <Chip label={tool} size="small" color={color} variant="outlined" />
}
