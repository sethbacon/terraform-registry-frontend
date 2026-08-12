import { useState, useEffect, useMemo } from 'react'
import type { SyntheticEvent } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import { captureError } from '../services/errorReporting'
import { Provider, ProviderVersion, ProviderDocEntry } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { REGISTRY_HOST } from '../config'
import { queryKeys } from '../services/queryKeys'
import { sortByVersionDesc } from '../utils/semver'

/** Page size used when walking the paginated provider doc index. */
const DOCS_PAGE_SIZE = 1000

/**
 * Stable empty list for the docs query's default, so the auto-select effect
 * below doesn't see a new array identity on every render.
 */
const NO_DOCS: ProviderDocEntry[] = []

// Route params, narrowed once from possibly-undefined useParams() values. Query
// and mutation functions take this instead of asserting namespace!/type!
// individually, so a query's `enabled` flag and its queryFn can't drift out of
// sync -- the same narrowed object gates both. Mirrors ModuleRouteParams in
// useModuleDetail.
interface ProviderRouteParams {
  namespace: string
  type: string
}

/**
 * Data fetching, mutation and UI state for ProviderDetailPage.
 *
 * Keeps the page component presentational: everything that touches the API,
 * the route params or the `?tab=`/`?doc=` query state lives here.
 *
 * Reads go through React Query and writes through useMutation with cache
 * invalidation, matching useModuleDetail (#674) -- the two hooks serve the same
 * page shape and had diverged into two different data-fetching architectures.
 */
export function useProviderDetail() {
  const { namespace, type } = useParams<{
    namespace: string
    type: string
  }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, allowedScopes } = useAuth()
  const canManage =
    isAuthenticated &&
    (allowedScopes.includes('admin') || allowedScopes.includes('providers:write'))

  const activeTab = searchParams.get('tab') === 'docs' ? 1 : 0
  const docParam = searchParams.get('doc')
  const docParts = docParam ? docParam.split('/') : []
  const selectedDocCategory = docParts[0] ?? null
  const selectedDocSlug = docParts[1] ?? null

  // Use 'type' as the name for display
  const name = type

  // UI-only state (not server data)
  const [selectedVersion, setSelectedVersion] = useState<ProviderVersion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedSource, setCopiedSource] = useState(false)
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null)
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false)
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false)
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null)
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false)
  const [deprecationMessage, setDeprecationMessage] = useState('')

  // =========================================================================
  // 1. Provider + versions query (primary)
  // =========================================================================
  const routeParams: ProviderRouteParams | null = useMemo(
    () => (namespace && type ? { namespace, type } : null),
    [namespace, type],
  )
  const providerQueryEnabled = !!routeParams

  const {
    data: providerData,
    isLoading: loading,
    error: providerQueryError,
  } = useQuery({
    queryKey: queryKeys.providers.detail(namespace ?? '', type ?? ''),
    queryFn: async () => {
      if (!routeParams) throw new Error('Provider route params missing')

      // Use searchProviders with the type as the query, then find the exact
      // namespace/type match in the results.
      const [providerResults, versionsData] = await Promise.all([
        api.searchProviders({ query: routeParams.type, limit: 100 }),
        api.getProviderVersions(routeParams.namespace, routeParams.type),
      ])

      const matchingProvider =
        providerResults.providers.find(
          (p: Provider) => p.namespace === routeParams.namespace && p.type === routeParams.type,
        ) ?? null

      // A miss is a cacheable answer, not a transport failure: returning it as
      // data (rather than throwing) keeps it off the retry path and out of the
      // telemetry report below, exactly as the previous hand-rolled early
      // return did.
      if (!matchingProvider) return { provider: null, versions: [] as ProviderVersion[] }

      // Backend returns { versions: [...] } directly -- sort by semver descending
      return { provider: matchingProvider, versions: sortByVersionDesc(versionsData.versions || []) }
    },
    enabled: providerQueryEnabled,
  })

  const provider = providerData?.provider ?? null
  const versions = useMemo(() => providerData?.versions ?? [], [providerData?.versions])

  // Derive the page-level error string from the query
  useEffect(() => {
    if (providerQueryError) {
      console.error('Failed to load provider details:', providerQueryError)
      // setError() here uses a plain hardcoded string, not getErrorMessage(), so
      // it doesn't get telemetry reporting for free -- report explicitly (#623).
      captureError(providerQueryError, { context: 'Failed to load provider details' })
      setError('Failed to load provider details. Please try again.')
      return
    }
    if (!providerData) return
    setError(providerData.provider ? null : 'Provider not found')
  }, [providerQueryError, providerData])

  // Auto-select latest version (or preserve current selection on refetch)
  useEffect(() => {
    if (versions.length === 0) return
    setSelectedVersion((prev) => {
      const current = prev?.version
      const match = current ? versions.find((v) => v.version === current) : null
      return match || versions[0]
    })
  }, [versions])

  // =========================================================================
  // 2. Doc index for mirrored providers (depends on selectedVersion)
  // =========================================================================
  const docsVersion = selectedVersion?.version ?? ''

  const { data: docs = NO_DOCS, isLoading: docsLoading } = useQuery<ProviderDocEntry[]>({
    queryKey: queryKeys.providers.docs(namespace ?? '', type ?? '', docsVersion),
    queryFn: async () => {
      if (!routeParams) return []
      let allDocs: ProviderDocEntry[] = []
      let offset = 0
      let total = Infinity

      while (offset < total) {
        const data = await api.getProviderDocs(
          routeParams.namespace,
          routeParams.type,
          docsVersion,
          undefined,
          'hcl',
          DOCS_PAGE_SIZE,
          offset,
        )
        allDocs = allDocs.concat(data.docs)
        total = data.total
        offset += data.docs.length
        if (data.docs.length === 0) break
      }
      return allDocs
    },
    enabled: providerQueryEnabled && !!provider?.source && !!docsVersion,
  })

  // Auto-select first doc when Documentation tab is opened with no selection
  useEffect(() => {
    if (activeTab !== 1 || docParam || docs.length === 0) return
    const overview = docs.find((d) => d.category === 'overview')
    const first = overview ?? docs[0]
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('doc', `${first.category}/${first.slug}`)
        return next
      },
      { replace: true },
    )
  }, [activeTab, docParam, docs, setSearchParams])

  // =========================================================================
  // Mutations
  // =========================================================================

  const deleteProviderMutation = useMutation({
    mutationFn: (params: ProviderRouteParams) => api.deleteProvider(params.namespace, params.type),
    onSuccess: () => {
      navigate('/providers')
    },
    onError: (err: unknown) => {
      console.error('Failed to delete provider:', err)
      setError(getErrorMessage(err, 'Failed to delete provider. Please try again.'))
    },
    onSettled: () => {
      setDeleteProviderDialogOpen(false)
    },
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (args: ProviderRouteParams & { version: string }) =>
      api.deleteProviderVersion(args.namespace, args.type, args.version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.detail(namespace ?? '', type ?? ''),
      })
      setVersionToDelete(null)
    },
    onError: (err: unknown) => {
      console.error('Failed to delete version:', err)
      setError(getErrorMessage(err, 'Failed to delete version. Please try again.'))
    },
    onSettled: () => {
      setDeleteVersionDialogOpen(false)
    },
  })

  const deprecateVersionMutation = useMutation({
    mutationFn: (args: ProviderRouteParams & { version: string; message?: string }) =>
      api.deprecateProviderVersion(args.namespace, args.type, args.version, args.message),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.detail(namespace ?? '', type ?? ''),
      })
      setDeprecationMessage('')
    },
    onError: (err: unknown) => {
      console.error('Failed to deprecate version:', err)
      setError(getErrorMessage(err, 'Failed to deprecate version. Please try again.'))
    },
    onSettled: () => {
      setDeprecateDialogOpen(false)
    },
  })

  const undeprecateVersionMutation = useMutation({
    mutationFn: (args: ProviderRouteParams & { version: string }) =>
      api.undeprecateProviderVersion(args.namespace, args.type, args.version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.detail(namespace ?? '', type ?? ''),
      })
    },
    onError: (err: unknown) => {
      console.error('Failed to remove deprecation:', err)
      setError(getErrorMessage(err, 'Failed to remove deprecation. Please try again.'))
    },
  })

  // =========================================================================
  // Handler wrappers (preserve existing call signatures for the page)
  // =========================================================================

  const handleCopySource = () => {
    if (!provider || !selectedVersion) return

    const source = `${namespace}/${name}`
    navigator.clipboard.writeText(source)
    setCopiedSource(true)
    setTimeout(() => setCopiedSource(false), 2000)
  }

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum)
    setCopiedChecksum(checksum)
    setTimeout(() => setCopiedChecksum(null), 2000)
  }

  const handleDeleteProvider = () => {
    if (!routeParams) return
    deleteProviderMutation.mutate(routeParams)
  }

  const handleDeleteVersion = () => {
    if (!routeParams || !versionToDelete) return
    deleteVersionMutation.mutate({ ...routeParams, version: versionToDelete })
  }

  const openDeleteVersionDialog = (version: string) => {
    setVersionToDelete(version)
    setDeleteVersionDialogOpen(true)
  }

  const handleDeprecateVersion = () => {
    if (!routeParams || !selectedVersion) return
    deprecateVersionMutation.mutate({
      ...routeParams,
      version: selectedVersion.version,
      message: deprecationMessage || undefined,
    })
  }

  const handlePublishNewVersion = () => {
    navigate('/admin/upload/provider', {
      state: {
        providerData: { namespace, type },
        method: 'upload' as const,
      },
    })
  }

  const handleUndeprecateVersion = () => {
    if (!routeParams || !selectedVersion) return
    undeprecateVersionMutation.mutate({ ...routeParams, version: selectedVersion.version })
  }

  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (newValue === 1) {
          next.set('tab', 'docs')
        } else {
          next.delete('tab')
          next.delete('doc')
        }
        return next
      },
      { replace: true },
    )
  }

  const handleDocSelect = (category: string, slug: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', 'docs')
        next.set('doc', `${category}/${slug}`)
        return next
      },
      { replace: true },
    )
  }

  const getTerraformExample = () => {
    if (!provider || !selectedVersion) return ''

    const v = selectedVersion.version
    const majorMinor = v.split('.').slice(0, 2).join('.')

    // Mirrored providers use the upstream source (e.g. hashicorp/aws) because
    // Terraform resolves the mirror transparently via CLI network mirror config.
    if (provider.source) {
      return `terraform {
  required_version = ">= 1.0.0"

  required_providers {
    ${name} = {
      source  = "${namespace}/${name}"
      version = ">=${majorMinor}"
    }
  }
}`
    }

    return `terraform {
  required_providers {
    ${name} = {
      source  = "${REGISTRY_HOST}/${namespace}/${name}"
      version = "${selectedVersion.version}"
    }
  }
}

provider "${name}" {
  # Configure provider settings here
}`
  }

  const hasDocs = Boolean(provider?.source && selectedVersion)

  // Derive GitHub repo URL from namespace/type convention for mirrored providers
  const githubUrl = provider?.source
    ? `https://github.com/${namespace}/terraform-provider-${type}`
    : null
  const changelogUrl =
    githubUrl && selectedVersion ? `${githubUrl}/releases/tag/v${selectedVersion.version}` : null

  return {
    // Route params
    namespace,
    type,
    name,
    // Auth
    canManage,
    // Core provider state
    provider,
    versions,
    selectedVersion,
    setSelectedVersion,
    loading,
    error,
    copiedSource,
    copiedChecksum,
    // Delete provider dialog
    deleteProviderDialogOpen,
    setDeleteProviderDialogOpen,
    deleting: deleteProviderMutation.isPending || deleteVersionMutation.isPending,
    // Delete version dialog
    deleteVersionDialogOpen,
    setDeleteVersionDialogOpen,
    versionToDelete,
    openDeleteVersionDialog,
    // Deprecate version dialog
    deprecateDialogOpen,
    setDeprecateDialogOpen,
    deprecationMessage,
    setDeprecationMessage,
    deprecating: deprecateVersionMutation.isPending || undeprecateVersionMutation.isPending,
    // Documentation tab
    activeTab,
    hasDocs,
    docs,
    docsLoading,
    selectedDocCategory,
    selectedDocSlug,
    handleTabChange,
    handleDocSelect,
    // Derived links
    githubUrl,
    changelogUrl,
    getTerraformExample,
    // Handlers
    handleCopySource,
    handleCopyChecksum,
    handleDeleteProvider,
    handleDeleteVersion,
    handleDeprecateVersion,
    handleUndeprecateVersion,
    handlePublishNewVersion,
  }
}
