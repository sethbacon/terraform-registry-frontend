import React, { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloudUpload from '@mui/icons-material/CloudUpload';
import api from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { Provider } from '../types';
import { useAuth } from '../contexts/AuthContext';
import RegistryItemCard from '../components/RegistryItemCard';

const ProvidersPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: queryData, isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.providers.search({
      query: debouncedSearch || undefined,
      limit,
      offset: (page - 1) * limit,
    }),
    queryFn: () => api.searchProviders({
      query: debouncedSearch || undefined,
      limit,
      offset: (page - 1) * limit,
    }),
  });

  const providers: Provider[] = queryData?.providers ?? [];
  const totalPages = queryData ? Math.ceil(queryData.meta.total / limit) : 1;
  const error = queryError ? 'Failed to load providers. Please try again.' : null;

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo(0, 0);
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Terraform Providers
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse and discover Terraform providers in your organization
          </Typography>
        </Box>
        {isAuthenticated && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CloudUpload />}
            onClick={() => navigate('/admin/upload/provider')}
          >
            Publish Provider
          </Button>
        )}
      </Box>
      <Box sx={{ mb: 4 }} />

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search providers..."
        value={searchQuery}
        onChange={handleSearchChange}
        sx={{ mb: 4 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : providers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No providers found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {searchQuery
              ? 'Try a different search query'
              : 'Upload your first provider to get started'}
          </Typography>
        </Box>
      ) : (
        <>
          {/* Provider Grid */}
          <Grid container spacing={3}>
            {providers.map((provider) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={provider.id}>
                <RegistryItemCard
                  title={provider.type}
                  subtitle={provider.namespace}
                  description={provider.description}
                  badge={
                    provider.source ? (
                      <Chip
                        label="Network Mirrored"
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    ) : undefined
                  }
                  chips={
                    <>
                      <Chip
                        label={`Latest: ${provider.latest_version || 'N/A'}`}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                      <Chip
                        label={`${provider.download_count ?? 0} downloads`}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </>
                  }
                  actionColor="secondary"
                  onClick={() => navigate(`/providers/${provider.namespace}/${provider.type}`)}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="secondary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default ProvidersPage;
