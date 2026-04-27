import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloudUpload from '@mui/icons-material/CloudUpload'
import api from '../services/api'
import { queryKeys } from '../services/queryKeys'
import { Provider } from '../types'
import { useAuth } from '../contexts/AuthContext'
import RegistryItemCard from '../components/RegistryItemCard'
import { RegistryItemGridSkeleton } from '../components/skeletons/RegistryItemCardSkeleton'

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

const ProvidersPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  /** Sort option value encodes both API sort field and order, separated by a colon. */
  const sortOptions = useMemo(
    () => [
      { value: 'relevance', label: t('providers.sortRelevance') },
      { value: 'name:asc', label: t('providers.sortNameAsc') },
      { value: 'name:desc', label: t('providers.sortNameDesc') },
      { value: 'created_at:desc', label: t('providers.sortNewest') },
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
  const limit = 12

  // Ref to suppress debounce-to-URL sync after programmatic URL changes (e.g. Clear Search)
  const skipDebounceSyncRef = useRef(false)

  // Sync debounced input back to URL params
  useEffect(() => {
    if (skipDebounceSyncRef.current) {
      skipDebounceSyncRef.current = false
      return
    }
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

  const { sort: apiSort, order: apiOrder } = parseSortValue(sortValue)

  const {
    data: queryData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.providers.search({
      query: urlQuery || undefined,
      limit,
      offset: (urlPage - 1) * limit,
      sort: apiSort,
      order: apiOrder,
    }),
    queryFn: () =>
      api.searchProviders({
        query: urlQuery || undefined,
        limit,
        offset: (urlPage - 1) * limit,
        sort: apiSort,
        order: apiOrder,
      }),
  })

  const providers: Provider[] = queryData?.providers ?? []
  const totalPages = queryData ? Math.ceil(queryData.meta.total / limit) : 1
  const error = queryError ? t('providers.loadError') : null

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
          next.delete('page')
          return next
        },
        { replace: true },
      )
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('providers.pageTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('providers.pageSubtitle')}
          </Typography>
        </Box>
        {isAuthenticated && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CloudUpload />}
            onClick={() => navigate('/admin/upload/provider')}
          >
            {t('providers.publishProvider')}
          </Button>
        )}
      </Box>
      <Box sx={{ mb: 4 }} />

      {/* Search Bar + Sort */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          placeholder={t('providers.searchPlaceholder')}
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
          <InputLabel id="providers-sort-label">{t('providers.sortBy')}</InputLabel>
          <Select
            labelId="providers-sort-label"
            id="providers-sort-select"
            value={sortValue}
            label={t('providers.sortBy')}
            onChange={handleSortChange}
          >
            {sortOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
      ) : providers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {t('providers.noResultsTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {urlQuery || urlSort
              ? t('providers.noResultsTryDifferent')
              : t('providers.noResultsUploadFirst')}
          </Typography>
          {(urlQuery || urlSort) && (
            <Button variant="outlined" sx={{ mt: 2 }} onClick={handleClearSearch}>
              {t('providers.clearFilters')}
            </Button>
          )}
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
                        label={t('providers.networkMirroredBadge')}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    ) : undefined
                  }
                  chips={
                    <>
                      <Chip
                        label={t('providers.latestVersion', {
                          version: provider.latest_version || t('providers.latestVersionUnknown'),
                        })}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                      <Chip
                        label={t('providers.downloadsCount', {
                          count: provider.download_count ?? 0,
                        })}
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
                page={urlPage}
                onChange={handlePageChange}
                color="secondary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  )
}

export default ProvidersPage
