import { Box, Card, CardContent, Grid, Skeleton, Stack } from '@mui/material';

export interface RegistryItemCardSkeletonProps {
  'data-testid'?: string;
}

/** Skeleton placeholder that matches the dimensions of RegistryItemCard. */
export default function RegistryItemCardSkeleton({
  'data-testid': testId = 'registry-item-card-skeleton',
}: RegistryItemCardSkeletonProps) {
  return (
    <Card data-testid={testId} sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width="60%" height={28} />
        </Stack>
        <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={54} sx={{ mb: 1.5, borderRadius: 1 }} />
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
        </Stack>
      </CardContent>
    </Card>
  );
}

export interface RegistryItemGridSkeletonProps {
  count?: number;
  'data-testid'?: string;
}

/** Grid of RegistryItemCardSkeleton placeholders, matching the ModulesPage/ProvidersPage layout. */
export function RegistryItemGridSkeleton({
  count = 12,
  'data-testid': testId = 'registry-item-grid-skeleton',
}: RegistryItemGridSkeletonProps) {
  return (
    <Box data-testid={testId}>
      <Grid container spacing={3}>
        {Array.from({ length: count }).map((_, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
            <RegistryItemCardSkeleton />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
