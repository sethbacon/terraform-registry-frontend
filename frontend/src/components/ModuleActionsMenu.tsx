import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import Delete from '@mui/icons-material/Delete'
import Warning from '@mui/icons-material/Warning'
import Undo from '@mui/icons-material/Undo'
import Edit from '@mui/icons-material/Edit'
import Add from '@mui/icons-material/Add'

export interface ModuleActionsMenuProps {
  canManage: boolean
  deprecated: boolean
  /** When true, show "Publish new version" as the first item (mobile/narrow viewports). */
  includePublishAction?: boolean
  onPublishNewVersion?: () => void
  onEditDescription?: () => void
  onDeprecateModule?: () => void
  onUndeprecateModule?: () => void
  onDeleteModule?: () => void
  'data-testid'?: string
}

export default function ModuleActionsMenu({
  canManage,
  deprecated,
  includePublishAction = false,
  onPublishNewVersion,
  onEditDescription,
  onDeprecateModule,
  onUndeprecateModule,
  onDeleteModule,
  'data-testid': testId = 'module-actions-menu',
}: ModuleActionsMenuProps) {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)

  if (!canManage) return null

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)
  const wrap = (handler?: () => void) => () => {
    handleClose()
    handler?.()
  }

  return (
    <>
      <Tooltip title={t('moduleActionsMenu.moreActions')}>
        <IconButton
          size="small"
          onClick={handleOpen}
          aria-label={t('moduleActionsMenu.moduleActions')}
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          data-testid={`${testId}-button`}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        data-testid={`${testId}-menu`}
        slotProps={{
          list: { 'aria-label': t('moduleActionsMenu.moduleActions') },
        }}
      >
        {includePublishAction && onPublishNewVersion && (
          <MenuItem onClick={wrap(onPublishNewVersion)} data-testid={`${testId}-publish`}>
            <ListItemIcon>
              <Add fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('moduleActionsMenu.publishNewVersion')}</ListItemText>
          </MenuItem>
        )}
        {onEditDescription && (
          <MenuItem onClick={wrap(onEditDescription)} data-testid={`${testId}-edit-description`}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('moduleActionsMenu.editDescription')}</ListItemText>
          </MenuItem>
        )}
        {(includePublishAction || onEditDescription) && <Divider />}
        {!deprecated && onDeprecateModule && (
          <MenuItem onClick={wrap(onDeprecateModule)} data-testid={`${testId}-deprecate`}>
            <ListItemIcon>
              <Warning fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>{t('moduleActionsMenu.deprecateModule')}</ListItemText>
          </MenuItem>
        )}
        {deprecated && onUndeprecateModule && (
          <MenuItem onClick={wrap(onUndeprecateModule)} data-testid={`${testId}-undeprecate`}>
            <ListItemIcon>
              <Undo fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('moduleActionsMenu.undeprecateModule')}</ListItemText>
          </MenuItem>
        )}
        {onDeleteModule && (
          <MenuItem
            onClick={wrap(onDeleteModule)}
            data-testid={`${testId}-delete`}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <Delete fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('moduleActionsMenu.deleteModule')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  )
}
