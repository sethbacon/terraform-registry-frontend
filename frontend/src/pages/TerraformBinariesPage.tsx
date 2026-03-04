import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import api from '../services/api';
import RegistryItemCard from '../components/RegistryItemCard';

interface MirrorSummary {
  name: string;
  description?: string | null;
  tool: string;
}

interface MirrorStats {
  versionCount: number;
  latestVersion: string | null;
}

const ToolChip: React.FC<{ tool: string }> = ({ tool }) => {
  const color = tool === 'terraform' ? 'primary' : tool === 'opentofu' ? 'secondary' : 'default';
  return <Chip label={tool} size="small" color={color} variant="outlined" />;
};

const TerraformBinariesPage: React.FC = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<MirrorSummary[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, MirrorStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.listPublicTerraformMirrorConfigs()
      .then((data) => {
        if (cancelled) return;
        setConfigs(data);
        // Load public version lists per mirror to get count + latest
        data.forEach((cfg) => {
          api.listPublicTerraformVersions(cfg.name)
            .then((vd) => {
              if (cancelled) return;
              const versions = vd.versions ?? [];
              const latest = versions.find((v) => v.is_latest)?.version ?? null;
              setStatsMap((prev) => ({
                ...prev,
                [cfg.name]: { versionCount: versions.length, latestVersion: latest },
              }));
            })
            .catch(() => {
              if (cancelled) return;
              setStatsMap((prev) => ({
                ...prev,
                [cfg.name]: { versionCount: 0, latestVersion: null },
              }));
            });
        });
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load Terraform binary mirrors.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Terraform Binary Mirrors
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Download Terraform and OpenTofu binaries from your organisation's internal mirror.
          Configure your CLI or CI toolchain to point at the mirror URL shown on each detail page.
        </Typography>
      </Box>
      <Box sx={{ mb: 4 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : configs.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No binary mirrors configured
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Ask an administrator to set up a Terraform or OpenTofu binary mirror.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {configs.map((cfg) => {
            const stats = statsMap[cfg.name];
            return (
              <Grid item xs={12} sm={6} md={4} key={cfg.name}>
                <RegistryItemCard
                  title={cfg.name}
                  description={cfg.description ?? undefined}
                  badge={<ToolChip tool={cfg.tool} />}
                  chips={
                    stats ? (
                      <>
                        <Chip
                          label={`${stats.versionCount} version${stats.versionCount !== 1 ? 's' : ''}`}
                          size="small"
                          variant="outlined"
                        />
                        {stats.latestVersion && (
                          <Chip
                            label={`Latest: ${stats.latestVersion}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </>
                    ) : (
                      <Chip label="Loading…" size="small" variant="outlined" />
                    )
                  }
                  onClick={() => navigate(`/terraform-binaries/${cfg.name}`)}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default TerraformBinariesPage;
