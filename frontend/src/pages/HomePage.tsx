import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  Chip,
  Skeleton,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExtensionIcon from '@mui/icons-material/Extension';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import GetAppIcon from '@mui/icons-material/GetApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import LoginIcon from '@mui/icons-material/Login';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useAnnouncer } from '../contexts/AnnouncerContext';
import QuickApiKeyDialog from '../components/QuickApiKeyDialog';

interface HomeStats {
  setupRequired: boolean;
  moduleCount: number | null;
  moduleNames: { namespace: string; name: string; system: string }[];
  providerCount: number | null;
  providerNames: { namespace: string; type: string }[];
  binaryTools: string[];
  loading: boolean;
}

const initialStats: HomeStats = {
  setupRequired: false,
  moduleCount: null,
  moduleNames: [],
  providerCount: null,
  providerNames: [],
  binaryTools: [],
  loading: true,
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated } = useAuth();
  const { announce } = useAnnouncer();
  const [stats, setStats] = useState<HomeStats>(initialStats);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'modules' | 'providers'>('modules');
  const [copied, setCopied] = useState(false);
  const [quickKeyOpen, setQuickKeyOpen] = useState(false);
  const [primaryOrgId, setPrimaryOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPrimaryOrgId(null);
      return;
    }
    let cancelled = false;
    api.getCurrentUserMemberships()
      .then((memberships: Array<{ organization_id: string }>) => {
        if (cancelled) return;
        setPrimaryOrgId(memberships?.[0]?.organization_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setPrimaryOrgId(null);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    Promise.allSettled([
      api.getSetupStatus(),
      api.searchModules({ limit: 3 }),
      api.searchProviders({ limit: 3 }),
      api.listPublicTerraformMirrorConfigs(),
    ]).then(([setup, mods, provs, bins]) => {
      setStats({
        loading: false,
        setupRequired: setup.status === 'fulfilled' ? (setup.value.setup_required ?? false) : false,
        moduleCount: mods.status === 'fulfilled' ? (mods.value.meta?.total ?? null) : null,
        moduleNames: mods.status === 'fulfilled' ? (mods.value.modules ?? []).slice(0, 3) : [],
        providerCount: provs.status === 'fulfilled' ? (provs.value.meta?.total ?? null) : null,
        providerNames: provs.status === 'fulfilled' ? (provs.value.providers ?? []).slice(0, 3) : [],
        binaryTools: bins.status === 'fulfilled'
          ? [...new Set((bins.value as { tool: string }[]).map((b) => b.tool))]
          : [],
      });
    });
  }, []);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      navigate(`/${searchType}?q=${encodeURIComponent(q)}`);
    } else {
      navigate(`/${searchType}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleCopyCredentials = () => {
    const snippet = `credentials "${window.location.hostname}" {\n  token = "<your-api-key>"\n}`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      announce('Credentials snippet copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Build hero summary line
  const summaryParts: string[] = [];
  if (stats.moduleCount !== null) summaryParts.push(`${stats.moduleCount} module${stats.moduleCount !== 1 ? 's' : ''}`);
  if (stats.providerCount !== null) summaryParts.push(`${stats.providerCount} provider${stats.providerCount !== 1 ? 's' : ''}`);
  if (stats.binaryTools.length > 0) {
    const toolLabel = stats.binaryTools.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ');
    summaryParts.push(`${toolLabel} binaries`);
  }

  return (
    <Box>

      {/* Setup banner — only shown when setup is required */}
      {stats.setupRequired && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/setup')} sx={{ fontWeight: 600 }}>
              Start Setup
            </Button>
          }
          sx={{ borderRadius: 0 }}
        >
          <AlertTitle>Setup Required</AlertTitle>
          This registry has not been configured yet. Complete the setup wizard to configure
          authentication, storage, and the initial admin account.
        </Alert>
      )}

      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #5C4EE5 0%, #00796B 100%)',
          color: 'white',
          py: 8,
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
            Private Terraform Registry
          </Typography>
          <Typography variant="h5" sx={{ mb: 4, opacity: 0.9 }}>
            Host and manage your custom Terraform modules, providers, and binaries
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/modules')}
              sx={{
                backgroundColor: 'white',
                color: '#5C4EE5',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
              }}
            >
              Browse Modules
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/providers')}
              sx={{
                backgroundColor: 'white',
                color: '#5C4EE5',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
              }}
            >
              Browse Providers
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/terraform-binaries')}
              sx={{
                borderColor: 'rgba(255,255,255,0.7)',
                color: 'white',
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Terraform Binaries
            </Button>
          </Stack>

          {/* Live summary line */}
          {stats.loading ? (
            <Skeleton variant="text" width={320} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
          ) : summaryParts.length > 0 ? (
            <Typography variant="body2">
              {summaryParts.join(' · ')} available
            </Typography>
          ) : null}
        </Container>
      </Box>

      {/* Quick Search */}
      <Container maxWidth="sm" sx={{ mb: 8, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Find What You Need
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Search across modules and providers in this registry
        </Typography>
        <Stack
          data-testid="quick-search-stack"
          direction={isXs ? 'column' : 'row'}
          spacing={1.5}
          alignItems={isXs ? 'stretch' : 'center'}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={searchType}
            onChange={(_e, val) => { if (val) setSearchType(val); }}
            aria-label="Search scope"
            data-testid="quick-search-toggle"
            sx={{ alignSelf: isXs ? 'center' : 'auto', flexShrink: 0 }}
          >
            <ToggleButton value="modules">Modules</ToggleButton>
            <ToggleButton value="providers">Providers</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            fullWidth
            placeholder={`Search ${searchType}…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            inputProps={{ 'aria-label': `Search ${searchType}` }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" onClick={handleSearch} variant="contained" disableElevation>
                    Search
                  </Button>
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </Container>

      {/* What's Available */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
          What's Available
        </Typography>
        <Grid container spacing={3}>

          {/* Modules */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ color: '#5C4EE5', mb: 2 }}>
                  <ExtensionIcon sx={{ fontSize: 40 }} />
                </Box>
                <Typography variant="h6" gutterBottom>
                  Modules
                  {stats.moduleCount !== null && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({stats.moduleCount})
                    </Typography>
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Browse and use private Terraform modules for your infrastructure.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 32 }}>
                  {stats.loading ? (
                    [1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" width={80} height={24} />)
                  ) : stats.moduleNames.length > 0 ? (
                    stats.moduleNames.map((m) => (
                      <Chip
                        key={`${m.namespace}/${m.name}/${m.system}`}
                        label={`${m.namespace}/${m.name}`}
                        size="small"
                        clickable
                        onClick={() => navigate(`/modules/${m.namespace}/${m.name}/${m.system}`)}
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      />
                    ))
                  ) : null}
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/modules')} sx={{ color: '#5C4EE5' }}>
                  Browse All Modules →
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* Providers */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ color: '#008577', mb: 2 }}>
                  <CloudUploadIcon sx={{ fontSize: 40 }} />
                </Box>
                <Typography variant="h6" gutterBottom>
                  Providers
                  {stats.providerCount !== null && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({stats.providerCount})
                    </Typography>
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Access custom and mirrored Terraform providers for your cloud resources.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 32 }}>
                  {stats.loading ? (
                    [1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" width={80} height={24} />)
                  ) : stats.providerNames.length > 0 ? (
                    stats.providerNames.map((p) => (
                      <Chip
                        key={`${p.namespace}/${p.type}`}
                        label={`${p.namespace}/${p.type}`}
                        size="small"
                        clickable
                        onClick={() => navigate(`/providers/${p.namespace}/${p.type}`)}
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      />
                    ))
                  ) : null}
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/providers')} sx={{ color: '#008577' }}>
                  Browse All Providers →
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* Terraform Binaries */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ color: '#D32F2F', mb: 2 }}>
                  <GetAppIcon sx={{ fontSize: 40 }} />
                </Box>
                <Typography variant="h6" gutterBottom>
                  Terraform Binaries
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Download Terraform and OpenTofu binaries from internal mirrors.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 32 }}>
                  {stats.loading ? (
                    [1, 2].map((i) => <Skeleton key={i} variant="rounded" width={90} height={24} />)
                  ) : stats.binaryTools.length > 0 ? (
                    stats.binaryTools.map((tool) => (
                      <Chip
                        key={tool}
                        label={tool}
                        size="small"
                        color={tool === 'terraform' ? 'primary' : tool === 'opentofu' ? 'secondary' : 'default'}
                        variant="outlined"
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No binary mirrors configured
                    </Typography>
                  )}
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/terraform-binaries')} sx={{ color: '#D32F2F' }}>
                  View Binaries →
                </Button>
              </CardActions>
            </Card>
          </Grid>

        </Grid>
      </Container>

      {/* Getting Started */}
      <Box sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5', py: 6 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
            Getting Started
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    1. Sign In
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Authenticate with your organization's OIDC or Azure AD credentials to access
                    the registry.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    2. Get an API Key
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {isAuthenticated
                      ? 'Generate an API key and add it to your Terraform CLI credentials file:'
                      : 'Sign in to generate an API key, then add it to your Terraform CLI credentials file:'}
                  </Typography>

                  {!isAuthenticated ? (
                    <Stack spacing={1.5}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<LoginIcon />}
                        component={RouterLink}
                        to="/login"
                        data-testid="getting-started-signin"
                      >
                        Sign in to generate a key
                      </Button>
                      <Box
                        sx={{
                          position: 'relative',
                          borderRadius: 1,
                          overflow: 'hidden',
                          opacity: 0.6,
                        }}
                      >
                        <Box
                          component="pre"
                          sx={{ m: 0, p: 1.5, fontSize: '0.75rem', lineHeight: 1.6, overflowX: 'auto' }}
                        >
                          {`credentials "${window.location.hostname}" {\n  token = "<your-api-key>"\n}`}
                        </Box>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<VpnKeyIcon />}
                          onClick={() => setQuickKeyOpen(true)}
                          data-testid="getting-started-create-key"
                        >
                          Create API key
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          component={RouterLink}
                          to="/admin/apikeys"
                          data-testid="getting-started-manage-keys"
                        >
                          Manage all keys →
                        </Button>
                      </Stack>
                      <Box
                        sx={{
                          position: 'relative',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1.5,
                            pr: 5,
                            fontSize: '0.75rem',
                            lineHeight: 1.6,
                            overflowX: 'auto',
                            borderRadius: 1,
                          }}
                        >
                          {`credentials "${window.location.hostname}" {\n  token = "<your-api-key>"\n}`}
                        </Box>
                        <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'} placement="top">
                          <IconButton
                            size="small"
                            aria-label="Copy usage example"
                            onClick={handleCopyCredentials}
                            sx={{ position: 'absolute', top: 4, right: 4, opacity: 0.6, '&:hover': { opacity: 1 } }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    3. Start Using
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Browse modules and providers, then reference them directly in your Terraform
                    configuration using this registry's hostname.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Protocol Support & API Docs */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
          Registry Protocol Support
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Full compatibility with Terraform Registry Protocol v1 — use this registry directly in
          Terraform CLI and provider configurations without any plugins or proxies.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          <Chip label="Module Registry API" color="primary" />
          <Chip label="Provider Registry API" color="secondary" />
          <Chip label="Service Discovery" />
          <Chip label="Authentication" />
        </Stack>
        <Button
          variant="outlined"
          startIcon={<MenuBookIcon />}
          onClick={() => navigate('/api-docs')}
        >
          View API Documentation
        </Button>
      </Container>

      <QuickApiKeyDialog
        open={quickKeyOpen}
        onClose={() => setQuickKeyOpen(false)}
        organizationId={primaryOrgId}
        hostname={typeof window !== 'undefined' ? window.location.hostname : ''}
      />

    </Box>
  );
};

export default HomePage;
