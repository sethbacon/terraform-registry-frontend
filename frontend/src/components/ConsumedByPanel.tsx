import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { ModuleConsumer } from '../services/api'

interface ConsumedByPanelProps {
  active: boolean
  siblingUrl?: string
  consumers: ModuleConsumer[]
}

// Cap the rendered rows so a heavily-consumed module can't produce an unbounded
// list; the count chip still reflects the true total.
const MAX_ROWS = 50

const ConsumedByPanel: React.FC<ConsumedByPanelProps> = ({ active, siblingUrl, consumers }) => {
  const { t } = useTranslation()

  // Hidden entirely when the suite is inactive or nothing consumes the module —
  // this keeps standalone deployments free of an empty suite panel.
  if (!active || consumers.length === 0) return null

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountTreeIcon fontSize="small" color="action" />
        <Typography variant="h6">{t('consumedBy.title')}</Typography>
        <Chip label={consumers.length} size="small" />
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {t('consumedBy.subtitle')}
      </Typography>
      <List dense disablePadding>
        {consumers.slice(0, MAX_ROWS).map((c) => (
          <ListItem key={`${c.source_id}:${c.state_key}`} disableGutters sx={{ py: 0.5 }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    {c.source_name || c.source_id} — {c.state_key}
                  </Typography>
                  {c.module_version ? (
                    <Chip label={c.module_version} size="small" color="info" />
                  ) : (
                    <Chip label={t('consumedBy.constraintOnly')} size="small" variant="outlined" />
                  )}
                </Box>
              }
              secondary={
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {new Date(c.observed_at).toLocaleString()}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
      {consumers.length > MAX_ROWS && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          {t('consumedBy.showingCount', { shown: MAX_ROWS, total: consumers.length })}
        </Typography>
      )}
      {siblingUrl && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={() =>
              window.open(
                `${siblingUrl.replace(/\/$/, '')}/sources`,
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            {t('consumedBy.openInStateManager')}
          </Button>
        </Box>
      )}
    </Paper>
  )
}

export default ConsumedByPanel
