import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  CircularProgress,
  Button,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import WebhookIcon from '@mui/icons-material/Webhook'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SyncIcon from '@mui/icons-material/Sync'
import type { ModuleSCMLink, SCMWebhookEvent } from '../types/scm'

interface WebhookEventsPanelProps {
  isAuthenticated: boolean
  scmLink: ModuleSCMLink | null
  moduleId: string | undefined
  webhookEvents: SCMWebhookEvent[]
  webhookEventsLoaded: boolean
  webhookEventsLoading: boolean
  webhookEventsExpanded: boolean
  onToggleExpanded: () => void
  onLoadEvents: (moduleId: string) => Promise<void>
}

/**
 * The wire event carries no `state` field — derive a display status from the
 * processing flags (error wins even when processed, so failed retries read
 * as failures rather than successes).
 */
function eventStatus(event: SCMWebhookEvent): 'pending' | 'processing' | 'succeeded' | 'failed' {
  if (event.error) return 'failed'
  if (event.processed) return 'succeeded'
  if (event.processing_started_at) return 'processing'
  return 'pending'
}

const WebhookEventsPanel: React.FC<WebhookEventsPanelProps> = ({
  isAuthenticated,
  scmLink,
  moduleId,
  webhookEvents,
  webhookEventsLoaded,
  webhookEventsLoading,
  webhookEventsExpanded,
  onToggleExpanded,
  onLoadEvents,
}) => {
  const { t } = useTranslation()
  if (!isAuthenticated || !scmLink) return null

  const handleToggle = () => {
    if (!webhookEventsExpanded && !webhookEventsLoaded && moduleId) {
      onLoadEvents(moduleId)
    }
    onToggleExpanded()
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <WebhookIcon fontSize="small" color="action" />
          <Typography variant="h6">{t('webhookEvents.title')}</Typography>
        </Box>
        <IconButton size="small" aria-label={t('webhookEvents.toggleAria')}>
          {webhookEventsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={webhookEventsExpanded}>
        <Divider sx={{ my: 2 }} />
        {webhookEventsLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 2,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        ) : webhookEvents.length === 0 ? (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('webhookEvents.noEvents')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {webhookEvents.slice(0, 10).map((event) => {
              const status = eventStatus(event)
              return (
                <ListItem key={event.id} disableGutters sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Chip
                          label={status}
                          size="small"
                          color={
                            status === 'succeeded'
                              ? 'success'
                              : status === 'failed'
                                ? 'error'
                                : status === 'processing'
                                  ? 'info'
                                  : 'default'
                          }
                        />
                        <Typography variant="body2">
                          {/* `||`, not `??`: the backend serializes tag_name as ""
                              (never absent) on branch pushes, so nullish coalescing
                              would never fall back to ref. */}
                          {event.event_type} — {event.tag_name || event.ref || ''}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            display: 'block',
                          }}
                        >
                          {new Date(event.created_at).toLocaleString()}
                        </Typography>
                        {event.error && (
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{
                              display: 'block',
                            }}
                          >
                            {event.error}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              )
            })}
            {webhookEvents.length > 10 && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  pl: 0,
                  mt: 1,
                  display: 'block',
                }}
              >
                {t('webhookEvents.showingCount', { total: webhookEvents.length })}
              </Typography>
            )}
          </List>
        )}
        {webhookEventsLoaded && (
          <Box
            sx={{
              mt: 1,
            }}
          >
            <Button
              size="small"
              startIcon={<SyncIcon />}
              onClick={(e) => {
                e.stopPropagation()
                if (moduleId) onLoadEvents(moduleId)
              }}
              disabled={webhookEventsLoading}
            >
              {t('webhookEvents.refresh')}
            </Button>
          </Box>
        )}
      </Collapse>
    </Paper>
  )
}

export default WebhookEventsPanel
