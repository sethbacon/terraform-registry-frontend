import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloudUpload from '@mui/icons-material/CloudUpload';
import api from '../services/api';
import { Provider } from '../types';
import { useAuth } from '../contexts/AuthContext';

const ProvidersPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 12;

  useEffect(() => {
    loadProviders();
  }, [page, searchQuery]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.searchProviders({
        query: searchQuery || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setProviders(response.providers);
      setTotalPages(Math.ceil(response.meta.total / limit));
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError('Failed to load providers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(1);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo(0, 0);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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
            Upload Provider
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
              <Grid item xs={12} sm={6} md={4} key={provider.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                      cursor: 'pointer',
                    },
                  }}
                  onClick={() => navigate(`/providers/${provider.namespace}/${provider.type}`)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom noWrap>
                      {provider.type}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {provider.namespace}
                    </Typography>
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
                      {provider.description || 'No description available'}
                    </Typography>
                    <Box sx={{ mt: 'auto' }}>
                      {provider.source && (
                        <Chip
                          label="Network Mirrored"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      )}
                      <Box>
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
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button size="small" color="secondary">
                      View Details
                    </Button>
                  </CardActions>
                </Card>
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
