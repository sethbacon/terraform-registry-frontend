import React, { useState, useCallback, useMemo } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CategoryIcon from '@mui/icons-material/Category';
import api from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { Module } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ProviderIcon, providerDisplayName } from '../components/ProviderIcon';
import RegistryItemCard from '../components/RegistryItemCard';

type ViewMode = 'grid' | 'grouped';

/** Group an array of modules by their system (provider) field, alphabetically. */
function groupByProvider(modules: Module[]): [string, Module[]][] {
  const map = new Map<string, Module[]>();
  for (const m of modules) {
    const key = m.system || m.provider || 'unknown';
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

const ModulesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const limit = viewMode === 'grouped' ? 100 : 12;

  const { data: queryData, isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.modules.search({
      query: debouncedSearch || undefined,
      limit,
      offset: (page - 1) * limit,
      viewMode,
    }),
    queryFn: () => api.searchModules({
      query: debouncedSearch || undefined,
      limit,
      offset: (page - 1) * limit,
    }),
  });

  const modules = useMemo(() => queryData?.modules ?? [], [queryData]);
  const totalPages = queryData ? Math.ceil(queryData.meta.total / limit) : 1;
  const error = queryError ? 'Failed to load modules. Please try again.' : null;

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo(0, 0);
  }, []);

  const handleViewModeChange = useCallback((_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) {
      setViewMode(newMode);
      setPage(1);
    }
  }, []);

  /** Renders a single module card (shared between both view modes). */
  const renderModuleCard = useCallback((module: Module) => (
    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.id}>
      <RegistryItemCard
        title={module.name}
        subtitle={`${module.namespace}/${module.system}`}
        description={module.description}
        chips={
          <>
            <Chip
              label={`Latest: ${module.latest_version || 'N/A'}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`${module.download_count ?? 0} downloads`}
              size="small"
              sx={{ ml: 1 }}
            />
          </>
        }
        onClick={() => navigate(`/modules/${module.namespace}/${module.name}/${module.system}`)}
      />
    </Grid>
  ), [navigate]);

  const groupedModules = useMemo(() => groupByProvider(modules), [modules]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Terraform Modules
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse and discover Terraform modules in your organization
          </Typography>
        </Box>
        {isAuthenticated && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUpload />}
            onClick={() => navigate('/admin/upload/module')}
          >
            Publish Module
          </Button>
        )}
      </Box>
      <Box sx={{ mb: 4 }} />

      {/* Search Bar + View Toggle */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          placeholder="Search modules..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="view mode"
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="grid" aria-label="grid view">
            <ViewModuleIcon sx={{ mr: 0.5 }} />
            Grid
          </ToggleButton>
          <ToggleButton value="grouped" aria-label="grouped by provider">
            <CategoryIcon sx={{ mr: 0.5 }} />
            By Provider
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

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
      ) : modules.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No modules found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {searchQuery
              ? 'Try a different search query'
              : 'Upload your first module to get started'}
          </Typography>
        </Box>
      ) : viewMode === 'grouped' ? (
        /* ---- Grouped by provider ---- */
        <>
          {groupedModules.map(([provider, providerModules]) => (
            <Box key={provider} sx={{ mb: 5 }}>
              {/* Provider section header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ProviderIcon provider={provider} size={28} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {providerDisplayName(provider)}
                </Typography>
                <Chip label={providerModules.length} size="small" color="primary" variant="outlined" />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={3}>
                {providerModules.map(renderModuleCard)}
              </Grid>
            </Box>
          ))}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      ) : (
        /* ---- Flat paginated grid ---- */
        <>
          <Grid container spacing={3}>
            {modules.map(renderModuleCard)}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default ModulesPage;
