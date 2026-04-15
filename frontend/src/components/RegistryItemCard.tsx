import React from 'react';
import {
  Card,
  CardActions,
  CardContent,
  Button,
  Typography,
  Box,
  Chip,
  type SxProps,
  type Theme,
} from '@mui/material';

export interface RegistryItemCardProps {
  /** Primary title displayed at the top of the card (e.g. module name, provider type). */
  title: string;
  /** Secondary line shown below the title (e.g. namespace/system). */
  subtitle?: string;
  /** Body text, clamped to 3 lines. Falls back to "No description available". */
  description?: string;
  /**
   * Optional badge rendered above the chips row (e.g. a "Network Mirrored" Chip).
   * Displayed with mb:1 spacing beneath the description.
   */
  badge?: React.ReactNode;
  /** Chip(s) rendered in the bottom chip row (e.g. version + download count). */
  chips?: React.ReactNode;
  /** Label for the CardActions button. Defaults to "View Details". */
  actionLabel?: string;
  /** MUI button color for the action button. Defaults to "primary". */
  actionColor?: 'primary' | 'secondary';
  /** Click handler attached to both the card and the action button. */
  onClick: () => void;
  /** Whether this item is deprecated. Adds a visual indicator. */
  deprecated?: boolean;
  /** Additional sx overrides for the root Card element. */
  sx?: SxProps<Theme>;
}

const cardHoverSx: SxProps<Theme> = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: 4,
    cursor: 'pointer',
  },
};

const RegistryItemCard: React.FC<RegistryItemCardProps> = ({
  title,
  subtitle,
  description,
  badge,
  chips,
  actionLabel = 'View Details',
  actionColor = 'primary',
  onClick,
  deprecated,
  sx,
}) => (
  <Card sx={[cardHoverSx, ...(deprecated ? [{ opacity: 0.7 } as const] : []), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} onClick={onClick}>
    <CardContent sx={{ flexGrow: 1 }}>
      <Typography variant="h6" gutterBottom noWrap>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {subtitle}
        </Typography>
      )}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 2,
          mb: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          minHeight: '3.6em',
        }}
      >
        {description || 'No description available'}
      </Typography>
      <Box sx={{ mt: 'auto' }}>
        {badge && <Box sx={{ mb: 1 }}>{badge}</Box>}
        {deprecated && <Chip label="Deprecated" color="warning" size="small" sx={{ mr: 1 }} />}
        {chips}
      </Box>
    </CardContent>
    <CardActions>
      <Button size="small" color={actionColor}>
        {actionLabel}
      </Button>
    </CardActions>
  </Card>
);

export default React.memo(RegistryItemCard);
