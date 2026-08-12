import { useState, useEffect, useCallback } from 'react'
import type { SyntheticEvent } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import { captureError } from '../services/errorReporting'
import { Provider, ProviderVersion, ProviderDocEntry } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { REGISTRY_HOST } from '../config'
import { sortByVersionDesc } from '../utils/semver'

/** Page size used when walking the paginated provider doc index. */
const DOCS_PAGE_SIZE = 1000

/**
 * Data fetching, mutation and UI state for ProviderDetailPage.
 *
 * Keeps the page component presentational: everything that touches the API,
 * the route params or the `?tab=`/`?doc=` query state lives here.
 */
export function useProviderDetail() {
  const { namespace, type } = useParams<{
    namespace: string
    type: string
  }>()
  const navigate = useNavigate()
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

  const [provider, setProvider] = useState<Provider | null>(null)
  const [versions, setVersions] = useState<ProviderVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<ProviderVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedSource, setCopiedSource] = useState(false)
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null)
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false)
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false)
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false)
  const [deprecationMessage, setDeprecationMessage] = useState('')
  const [deprecating, setDeprecating] = useState(false)

  const [docs, setDocs] = useState<ProviderDocEntry[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  const loadProviderDetails = useCallback(async () => {
    if (!namespace || !type) return

    try {
      setLoading(true)
      setError(null)

      // Use searchProviders with namespace filter and then find by type
      const [providerData, versionsData] = await Promise.all([
        api.searchProviders({ query: type, limit: 100 }), // Search with type as query
        api.getProviderVersions(namespace, type),
      ])

      // Filter results to find exact match for namespace/type
      const matchingProvider = providerData.providers.find(
        (p: Provider) => p.namespace === namespace && p.type === type,
      )

      if (!matchingProvider) {
        setError('Provider not found')
        return
      }

      setProvider(matchingProvider)

      // Backend returns { versions: [...] } directly — sort by semver descending
      const sortedVersions = sortByVersionDesc(versionsData.versions || [])
      setVersions(sortedVersions)

      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0])
      }
    } catch (err) {
      console.error('Failed to load provider details:', err)
      // setError() here uses a plain hardcoded string, not getErrorMessage(), so
      // it doesn't get telemetry reporting for free -- report explicitly (#623).
      captureError(err instanceof Error ? err : new Error(String(err)), {
        context: 'Failed to load provider details',
      })
      setError('Failed to load provider details. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [namespace, type])

  useEffect(() => {
    loadProviderDetails()
  }, [loadProviderDetails])

  // Fetch doc index for mirrored providers when version is selected
  useEffect(() => {
    if (!provider?.source || !selectedVersion || !namespace || !type) return
    let cancelled = false
    const fetchAllDocs = async () => {
      let allDocs: ProviderDocEntry[] = []
      let offset = 0
      let total = Infinity

      while (offset < total) {
        const data = await api.getProviderDocs(
          namespace,
          type,
          selectedVersion.version,
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
    }

    setDocsLoading(true)
    fetchAllDocs()
      .then((allDocs) => {
        if (!cancelled) setDocs(allDocs)
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [provider?.source, selectedVersion, namespace, type])

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

  const handleDeleteProvider = async () => {
    if (!namespace || !type) return

    try {
      setDeleting(true)
      await api.deleteProvider(namespace, type)
      navigate('/providers')
    } catch (err: unknown) {
      console.error('Failed to delete provider:', err)
      setError(getErrorMessage(err, 'Failed to delete provider. Please try again.'))
    } finally {
      setDeleting(false)
      setDeleteProviderDialogOpen(false)
    }
  }

  const handleDeleteVersion = async () => {
    if (!namespace || !type || !versionToDelete) return

    try {
      setDeleting(true)
      await api.deleteProviderVersion(namespace, type, versionToDelete)
      // Reload the provider details
      await loadProviderDetails()
      setVersionToDelete(null)
    } catch (err: unknown) {
      console.error('Failed to delete version:', err)
      setError(getErrorMessage(err, 'Failed to delete version. Please try again.'))
    } finally {
      setDeleting(false)
      setDeleteVersionDialogOpen(false)
    }
  }

  const openDeleteVersionDialog = (version: string) => {
    setVersionToDelete(version)
    setDeleteVersionDialogOpen(true)
  }

  const handleDeprecateVersion = async () => {
    if (!namespace || !type || !selectedVersion) return

    try {
      setDeprecating(true)
      await api.deprecateProviderVersion(
        namespace,
        type,
        selectedVersion.version,
        deprecationMessage || undefined,
      )
      // Reload the provider details
      await loadProviderDetails()
      setDeprecationMessage('')
    } catch (err: unknown) {
      console.error('Failed to deprecate version:', err)
      setError(getErrorMessage(err, 'Failed to deprecate version. Please try again.'))
    } finally {
      setDeprecating(false)
      setDeprecateDialogOpen(false)
    }
  }

  const handlePublishNewVersion = () => {
    navigate('/admin/upload/provider', {
      state: {
        providerData: { namespace, type },
        method: 'upload' as const,
      },
    })
  }

  const handleUndeprecateVersion = async () => {
    if (!namespace || !type || !selectedVersion) return

    try {
      setDeprecating(true)
      await api.undeprecateProviderVersion(namespace, type, selectedVersion.version)
      // Reload the provider details
      await loadProviderDetails()
    } catch (err: unknown) {
      console.error('Failed to remove deprecation:', err)
      setError(getErrorMessage(err, 'Failed to remove deprecation. Please try again.'))
    } finally {
      setDeprecating(false)
    }
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
    deleting,
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
    deprecating,
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
