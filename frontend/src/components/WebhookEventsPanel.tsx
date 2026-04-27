import React from 'react'
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
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{ cursor: 'pointer' }}
        onClick={handleToggle}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <WebhookIcon fontSize="small" color="action" />
          <Typography variant="h6">Webhook Events</Typography>
        </Box>
        <IconButton size="small" aria-label="Toggle webhook events">
          {webhookEventsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={webhookEventsExpanded}>
        <Divider sx={{ my: 2 }} />
        {webhookEventsLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : webhookEvents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No webhook events recorded yet.
          </Typography>
        ) : (
          <List dense disablePadding>
            {webhookEvents.slice(0, 10).map((event) => (
              <ListItem key={event.id} disableGutters sx={{ py: 0.5 }}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={event.state}
                        size="small"
                        color={
                          event.state === 'succeeded'
                            ? 'success'
                            : event.state === 'failed'
                              ? 'error'
                              : event.state === 'processing'
                                ? 'info'
                                : 'default'
                        }
                      />
                      <Typography variant="body2">
                        {event.event_type} — {event.ref_name}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {new Date(event.created_at).toLocaleString()}
                      </Typography>
                      {event.error_message && (
                        <Typography variant="caption" color="error" display="block">
                          {event.error_message}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
            {webhookEvents.length > 10 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ pl: 0, mt: 1, display: 'block' }}
              >
                Showing 10 of {webhookEvents.length} events
              </Typography>
            )}
          </List>
        )}
        {webhookEventsLoaded && (
          <Box mt={1}>
            <Button
              size="small"
              startIcon={<SyncIcon />}
              onClick={(e) => {
                e.stopPropagation()
                if (moduleId) onLoadEvents(moduleId)
              }}
              disabled={webhookEventsLoading}
            >
              Refresh
            </Button>
          </Box>
        )}
      </Collapse>
    </Paper>
  )
}

export default WebhookEventsPanel
