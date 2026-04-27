import React from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import InboxOutlined from '@mui/icons-material/InboxOutlined'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

export interface EmptyStateProps {
  title: string
  description?: React.ReactNode
  icon?: React.ReactNode
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  'data-testid'?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  'data-testid': testId = 'empty-state',
}) => {
  return (
    <Box
      data-testid={testId}
      sx={{
        py: 6,
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          color: 'text.disabled',
          mb: 2,
          '& svg': { fontSize: 48 },
        }}
      >
        {icon ?? <InboxOutlined />}
      </Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mb: 2 }}>
          {description}
        </Typography>
      )}
      {(primaryAction || secondaryAction) && (
        <Stack direction="row" spacing={1} justifyContent="center">
          {primaryAction && (
            <Button
              variant="contained"
              onClick={primaryAction.onClick}
              startIcon={primaryAction.icon}
              data-testid={`${testId}-primary`}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="text"
              onClick={secondaryAction.onClick}
              startIcon={secondaryAction.icon}
              data-testid={`${testId}-secondary`}
            >
              {secondaryAction.label}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  )
}

export default EmptyState
