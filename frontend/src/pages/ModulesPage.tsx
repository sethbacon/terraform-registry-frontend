import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '../hooks/useDebounce'
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Grid,
  Button,
  Chip,
  Alert,
  Pagination,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloudUpload from '@mui/icons-material/CloudUpload'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import CategoryIcon from '@mui/icons-material/Category'
import api from '../services/api'
import { queryKeys } from '../services/queryKeys'
import { Module } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { ProviderIcon, providerDisplayName } from '../components/ProviderIcon'
import RegistryItemCard from '../components/RegistryItemCard'
import { RegistryItemGridSkeleton } from '../components/skeletons/RegistryItemCardSkeleton'

type ViewMode = 'grid' | 'grouped'

/** Parse a combined sort value into separate sort/order strings for the API. */
function parseSortValue(value: string): { sort?: string; order?: string } {
  if (value === 'relevance') return {}
  const [sort, order] = value.split(':')
  return { sort, order }
}

/** Build a combined sort value from separate sort/order URL params. */
function buildSortValue(sort?: string | null, order?: string | null): string {
  if (!sort) return 'name:asc'
  if (sort === 'relevance') return 'relevance'
  return order ? `${sort}:${order}` : sort
}

/** Parse a URL ?view= value into a validated ViewMode (grouped is the default). */
function parseViewMode(value: string | null): ViewMode {
  return value === 'grid' ? 'grid' : 'grouped'
}

/** Group an array of modules by their system (provider) field, alphabetically. */
function groupByProvider(modules: Module[]): [string, Module[]][] {
  const map = new Map<string, Module[]>()
  for (const m of modules) {
    const key = m.system || m.provider || 'unknown'
    const list = map.get(key) ?? []
    list.push(m)
    map.set(key, list)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

const ModulesPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  /** Sort option value encodes both API sort field and order, separated by a colon. */
  const sortOptions = useMemo(
    () => [
      { value: 'relevance', label: t('modules.sortRelevance') },
      { value: 'name:asc', label: t('modules.sortNameAsc') },
      { value: 'name:desc', label: t('modules.sortNameDesc') },
      { value: 'downloads:desc', label: t('modules.sortDownloads') },
      { value: 'created_at:desc', label: t('modules.sortNewest') },
      { value: 'updated_at:desc', label: t('modules.sortRecentlyUpdated') },
    ],
    [t],
  )

  // Derive state from URL params
  const urlQuery = searchParams.get('q') ?? ''
  const urlPage = Math.max(1, Number(searchParams.get('page')) || 1)
  const urlSort = searchParams.get('sort')
  const urlOrder = searchParams.get('order')
  const sortValue = buildSortValue(urlSort, urlOrder)

  // Local input state for the text field (debounced before syncing to URL)
  const [inputValue, setInputValue] = useState(urlQuery)
  const debouncedInput = useDebounce(inputValue, 300)

  // Ref to suppress debounce-to-URL sync after programmatic URL changes (e.g. Clear Search)
  const skipDebounceSyncRef = useRef(false)

  // Sync debounced input back to URL params
  useEffect(() => {
    if (skipDebounceSyncRef.current) {
      skipDebounceSyncRef.current = false
      return
    }
    // Only update if the debounced value differs from the current URL q param
    const currentQ = searchParams.get('q') ?? ''
    if (debouncedInput === currentQ) return

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debouncedInput) {
          next.set('q', debouncedInput)
        } else {
          next.delete('q')
        }
        // Reset to page 1 when search changes
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [debouncedInput, searchParams, setSearchParams])

  // Keep local input in sync when URL changes externally (e.g. back/forward)
  useEffect(() => {
    setInputValue(urlQuery)
  }, [urlQuery])

  // View mode is URL-backed (?view=grid|grouped) so it survives reload and is shareable.
  // Grouped is the default — only grid is persisted as a query param to keep URLs tidy.
  const viewMode: ViewMode = parseViewMode(searchParams.get('view'))
  const limit = viewMode === 'grouped' ? 100 : 12

  const { sort: apiSort, order: apiOrder } = parseSortValue(sortValue)

  const {
    data: queryData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.modules.search({
      query: urlQuery || undefined,
      limit,
      offset: (urlPage - 1) * limit,
      viewMode,
      sort: apiSort,
      order: apiOrder,
    }),
    queryFn: () =>
      api.searchModules({
        query: urlQuery || undefined,
        limit,
        offset: (urlPage - 1) * limit,
        sort: apiSort,
        order: apiOrder,
      }),
  })

  const modules = useMemo(() => queryData?.modules ?? [], [queryData])
  const totalPages = queryData ? Math.ceil(queryData.meta.total / limit) : 1
  const error = queryError ? t('modules.loadError') : null

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }, [])

  const handlePageChange = useCallback(
    (_event: React.ChangeEvent<unknown>, value: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value > 1) {
            next.set('page', String(value))
          } else {
            next.delete('page')
          }
          return next
        },
        { replace: true },
      )
      window.scrollTo(0, 0)
    },
    [setSearchParams],
  )

  const handleSortChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const newValue = event.target.value
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (newValue === 'relevance') {
            // Default is name:asc, so Relevance must be persisted explicitly.
            next.set('sort', 'relevance')
            next.delete('order')
          } else {
            const { sort, order } = parseSortValue(newValue)
            if (sort) next.set('sort', sort)
            else next.delete('sort')
            if (order) next.set('order', order)
            else next.delete('order')
          }
          // Reset to page 1 when sort changes
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const handleViewModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
      if (newMode) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (newMode === 'grouped') {
              next.delete('view')
            } else {
              next.set('view', newMode)
            }
            // Reset to page 1 when view mode changes
            next.delete('page')
            return next
          },
          { replace: true },
        )
      }
    },
    [setSearchParams],
  )

  const handleClearSearch = useCallback(() => {
    setInputValue('')
    // Prevent the stale debounced value from writing 'q' back to the URL
    skipDebounceSyncRef.current = true
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('q')
        next.delete('page')
        next.delete('sort')
        next.delete('order')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  /** Renders a single module card (shared between both view modes). */
  const renderModuleCard = useCallback(
    (module: Module) => (
      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.id}>
        <RegistryItemCard
          title={module.name}
          subtitle={`${module.namespace}/${module.system}`}
          description={module.description}
          deprecated={module.deprecated}
          chips={
            <>
              <Chip
                label={t('modules.latestVersion', {
                  version: module.latest_version || t('modules.latestVersionUnknown'),
                })}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={t('modules.downloadsCount', { count: module.download_count ?? 0 })}
                size="small"
                sx={{ ml: 1 }}
              />
            </>
          }
          onClick={() => navigate(`/modules/${module.namespace}/${module.name}/${module.system}`)}
        />
      </Grid>
    ),
    [navigate, t],
  )

  const groupedModules = useMemo(() => groupByProvider(modules), [modules])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('modules.pageTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('modules.pageSubtitle')}
          </Typography>
        </Box>
        {isAuthenticated && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUpload />}
            onClick={() => navigate('/admin/upload/module')}
          >
            {t('modules.publishModule')}
          </Button>
        )}
      </Box>
      <Box sx={{ mb: 4 }} />

      {/* Search Bar + Sort + View Toggle */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          placeholder={t('modules.searchPlaceholder')}
          value={inputValue}
          onChange={handleInputChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl sx={{ minWidth: 180 }} size="medium">
          <InputLabel id="modules-sort-label">{t('modules.sortBy')}</InputLabel>
          <Select
            labelId="modules-sort-label"
            id="modules-sort-select"
            value={sortValue}
            label={t('modules.sortBy')}
            onChange={handleSortChange}
          >
            {sortOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label={t('modules.viewModeAriaLabel')}
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="grid" aria-label={t('modules.viewGridAriaLabel')}>
            <ViewModuleIcon sx={{ mr: 0.5 }} />
            {t('modules.viewGrid')}
          </ToggleButton>
          <ToggleButton value="grouped" aria-label={t('modules.viewByProviderAriaLabel')}>
            <CategoryIcon sx={{ mr: 0.5 }} />
            {t('modules.viewByProvider')}
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
        <RegistryItemGridSkeleton />
      ) : modules.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {t('modules.noResultsTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {urlQuery || urlSort
              ? t('modules.noResultsTryDifferent')
              : t('modules.noResultsUploadFirst')}
          </Typography>
          {(urlQuery || urlSort) && (
            <Button variant="outlined" sx={{ mt: 2 }} onClick={handleClearSearch}>
              {t('modules.clearFilters')}
            </Button>
          )}
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
                <Chip
                  label={providerModules.length}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
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
                page={urlPage}
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
                page={urlPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  )
}

export default ModulesPage
