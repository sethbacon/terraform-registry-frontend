import React from 'react';
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
} from '@mui/material';
import ExtensionIcon from '@mui/icons-material/Extension';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <ExtensionIcon sx={{ fontSize: 40 }} />,
      title: 'Terraform Modules',
      description: 'Browse and download private Terraform modules for your infrastructure needs.',
      action: 'Browse Modules',
      path: '/modules',
      color: '#5C4EE5',
    },
    {
      icon: <CloudUploadIcon sx={{ fontSize: 40 }} />,
      title: 'Terraform Providers',
      description: 'Access custom Terraform providers for your cloud resources.',
      action: 'Browse Providers',
      path: '/providers',
      color: '#00D9C0',
    },
    {
      icon: <SearchIcon sx={{ fontSize: 40 }} />,
      title: 'Advanced Search',
      description: 'Find the exact module or provider you need with powerful search capabilities.',
      action: 'Search',
      path: '/modules',
      color: '#FF6B6B',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40 }} />,
      title: 'Secure & Private',
      description: 'Enterprise-grade security with role-based access control and authentication.',
      action: 'Learn More',
      path: '/about',
      color: '#4ECDC4',
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #5C4EE5 0%, #00D9C0 100%)',
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
            Host and manage your custom Terraform modules and providers
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/modules')}
              sx={{
                backgroundColor: 'white',
                color: '#5C4EE5',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
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
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              Browse Providers
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
          Features
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ color: feature.color, mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => navigate(feature.path)}
                    sx={{ color: feature.color }}
                  >
                    {feature.action}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Quick Stats Section */}
      <Box sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5', py: 6 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            Getting Started
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    1. Authenticate
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sign in with your OIDC or Azure AD credentials to access the registry.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    2. Configure Terraform
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Set up your Terraform CLI to use this registry with API key authentication.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    3. Start Using
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Browse modules and providers, then reference them in your Terraform code.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* API Information Section */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
          Registry Protocol Support
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This registry implements the official Terraform Registry Protocol for seamless integration.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip label="Module Registry API" color="primary" />
          <Chip label="Provider Registry API" color="secondary" />
          <Chip label="Service Discovery" />
          <Chip label="Authentication" />
        </Stack>
      </Container>
    </Box>
  );
};

export default HomePage;
