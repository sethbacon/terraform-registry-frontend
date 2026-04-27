import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Container, Typography, Box, Grid, Chip, CircularProgress, Alert } from '@mui/material'
import api from '../services/api'
import RegistryItemCard from '../components/RegistryItemCard'

interface MirrorSummary {
  name: string
  description?: string | null
  tool: string
}

interface MirrorStats {
  versionCount: number
  latestVersion: string | null
}

const ToolChip: React.FC<{ tool: string }> = ({ tool }) => {
  const color = tool === 'terraform' ? 'primary' : tool === 'opentofu' ? 'secondary' : 'default'
  return <Chip label={tool} size="small" color={color} variant="outlined" />
}

const TerraformBinariesPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<MirrorSummary[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, MirrorStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .listPublicTerraformMirrorConfigs()
      .then((data) => {
        if (cancelled) return
        setConfigs(data)
        // Load public version lists per mirror to get count + latest
        data.forEach((cfg) => {
          api
            .listPublicTerraformVersions(cfg.name)
            .then((vd) => {
              if (cancelled) return
              const versions = vd.versions ?? []
              const latest = versions.find((v) => v.is_latest)?.version ?? null
              setStatsMap((prev) => ({
                ...prev,
                [cfg.name]: { versionCount: versions.length, latestVersion: latest },
              }))
            })
            .catch(() => {
              if (cancelled) return
              setStatsMap((prev) => ({
                ...prev,
                [cfg.name]: { versionCount: 0, latestVersion: null },
              }))
            })
        })
      })
      .catch(() => {
        if (!cancelled) setError(t('terraformBinaries.loadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          {t('terraformBinaries.pageTitle')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('terraformBinaries.pageSubtitle')}
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
            {t('terraformBinaries.noMirrorsTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('terraformBinaries.noMirrorsBody')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {configs.map((cfg) => {
            const stats = statsMap[cfg.name]
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cfg.name}>
                <RegistryItemCard
                  title={cfg.name}
                  description={cfg.description ?? undefined}
                  badge={<ToolChip tool={cfg.tool} />}
                  chips={
                    stats ? (
                      <>
                        <Chip
                          label={t(
                            stats.versionCount === 1
                              ? 'terraformBinaries.versionCountOne'
                              : 'terraformBinaries.versionCountOther',
                            { count: stats.versionCount },
                          )}
                          size="small"
                          variant="outlined"
                        />
                        {stats.latestVersion && (
                          <Chip
                            label={t('terraformBinaries.latestVersion', {
                              version: stats.latestVersion,
                            })}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </>
                    ) : (
                      <Chip
                        label={t('terraformBinaries.loadingVersions')}
                        size="small"
                        variant="outlined"
                      />
                    )
                  }
                  onClick={() => navigate(`/terraform-binaries/${cfg.name}`)}
                />
              </Grid>
            )
          })}
        </Grid>
      )}
    </Container>
  )
}

export default TerraformBinariesPage
