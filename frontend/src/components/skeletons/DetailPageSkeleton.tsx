import { Box, Container, Paper, Skeleton, Stack } from '@mui/material'

export interface DetailPageSkeletonProps {
  'data-testid'?: string
}

/** Skeleton matching the overall layout of ModuleDetailPage / ProviderDetailPage. */
export default function DetailPageSkeleton({
  'data-testid': testId = 'detail-page-skeleton',
}: DetailPageSkeletonProps) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }} data-testid={testId}>
      <Skeleton variant="text" width={220} height={20} sx={{ mb: 2 }} />
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="text" width={280} height={40} />
      </Stack>
      <Skeleton variant="text" width="60%" height={24} sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
        <Skeleton variant="rounded" width={140} height={32} />
        <Skeleton variant="rounded" width={220} height={32} />
        <Skeleton variant="rounded" width={120} height={32} />
      </Stack>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Skeleton variant="text" width="30%" height={28} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={110} sx={{ borderRadius: 1 }} />
          </Paper>
          <Paper sx={{ p: 3 }}>
            <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={260} sx={{ borderRadius: 1 }} />
          </Paper>
        </Box>
        <Box sx={{ width: { xs: '100%', md: 320 } }}>
          <Paper sx={{ p: 3 }}>
            <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="75%" />
          </Paper>
        </Box>
      </Box>
    </Container>
  )
}
