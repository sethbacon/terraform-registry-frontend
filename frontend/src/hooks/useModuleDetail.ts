import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { ModuleVersion, ModuleScan, ModuleDoc } from '../types'
import type { ModuleSCMLink, SCMWebhookEvent } from '../types/scm'
import { useAuth } from '../contexts/AuthContext'
import { REGISTRY_HOST } from '../config'
import { getErrorMessage, getErrorStatus } from '../utils/errors'
import { queryKeys } from '../services/queryKeys'

// ---------------------------------------------------------------------------
// Semver sort helper (shared by query & version selection)
// ---------------------------------------------------------------------------
function sortVersionsDesc(raw: ModuleVersion[]): ModuleVersion[] {
  return [...raw].sort((a, b) => {
    const parseParts = (v: string): [number, number, number] => {
      const clean = v.replace(/^v/, '').split('-')[0]
      const [maj = 0, min = 0, pat = 0] = clean.split('.').map(Number)
      return [maj, min, pat]
    }
    const [aMaj, aMin, aPat] = parseParts(a.version)
    const [bMaj, bMin, bPat] = parseParts(b.version)
    return bMaj !== aMaj ? bMaj - aMaj : bMin !== aMin ? bMin - aMin : bPat - aPat
  })
}

export function useModuleDetail() {
  const { namespace, name, system } = useParams<{
    namespace: string
    name: string
    system: string
  }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated, allowedScopes } = useAuth()
  const canManage =
    isAuthenticated && (allowedScopes.includes('admin') || allowedScopes.includes('modules:write'))

  // UI-only state (not server data)
  const [selectedVersion, setSelectedVersion] = useState<ModuleVersion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedSource, setCopiedSource] = useState(false)
  const [deleteModuleDialogOpen, setDeleteModuleDialogOpen] = useState(false)
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false)
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null)
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false)
  const [deprecationMessage, setDeprecationMessage] = useState('')
  const [deprecationReplacementSource, setDeprecationReplacementSource] = useState('')

  // Module-level deprecation UI state
  const [deprecateModuleDialogOpen, setDeprecateModuleDialogOpen] = useState(false)
  const [moduleDeprecationMessage, setModuleDeprecationMessage] = useState('')
  const [successorModuleId, setSuccessorModuleId] = useState('')
  const [undeprecateModuleDialogOpen, setUndeprecateModuleDialogOpen] = useState(false)
  // SCM linking UI state
  const [scmWizardOpen, setScmWizardOpen] = useState(false)

  // Webhook events UI state
  const [webhookEventsExpanded, setWebhookEventsExpanded] = useState(false)

  // =========================================================================
  // 1. Module + versions query (primary)
  // =========================================================================
  const moduleQueryEnabled = !!(namespace && name && system)

  const {
    data: moduleData,
    isLoading: loading,
    error: moduleQueryError,
  } = useQuery({
    queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
    queryFn: async () => {
      const [mod, versionsData] = await Promise.all([
        api.getModule(namespace!, name!, system!),
        api.getModuleVersions(namespace!, name!, system!),
      ])
      if (!mod) throw new Error('Module not found')

      const protocolVersions = Array.isArray(versionsData?.modules?.[0]?.versions)
        ? versionsData.modules[0].versions
        : []
      const moduleVersions = Array.isArray(mod?.versions) ? mod.versions : []
      const rawVersions: ModuleVersion[] =
        protocolVersions.length > 0 ? protocolVersions : moduleVersions
      const mergedVersions = sortVersionsDesc(rawVersions)

      return { module: mod, versions: mergedVersions }
    },
    enabled: moduleQueryEnabled,
  })

  const module = moduleData?.module ?? null
  const versions = useMemo(() => moduleData?.versions ?? [], [moduleData?.versions])

  // Derive error from query
  useEffect(() => {
    if (moduleQueryError) {
      if (getErrorStatus(moduleQueryError) === 404) {
        setError('Module not found')
      } else {
        setError(getErrorMessage(moduleQueryError, 'Failed to load module details'))
      }
    }
  }, [moduleQueryError])

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
  // 2. SCM Link query (depends on module.id)
  // =========================================================================
  const { data: scmLink = null, isSuccess: scmLinkLoaded } = useQuery<ModuleSCMLink | null>({
    queryKey: queryKeys.modules.scm(module?.id ?? ''),
    queryFn: async () => {
      try {
        return await api.getModuleSCMInfo(module!.id)
      } catch {
        return null // 404 = not linked, which is fine
      }
    },
    enabled: !!module?.id && isAuthenticated,
  })

  // =========================================================================
  // 3. Module scan query (depends on selectedVersion)
  // =========================================================================
  const scanVersion = selectedVersion?.version ?? ''

  const { data: scanData, isLoading: scanLoading } = useQuery({
    queryKey: queryKeys.modules.scan(namespace ?? '', name ?? '', system ?? '', scanVersion),
    queryFn: async () => {
      try {
        const scan = await api.getModuleScan(namespace!, name!, system!, scanVersion)
        return { scan, notFound: false }
      } catch (err: unknown) {
        if (getErrorStatus(err) === 404) {
          return { scan: null, notFound: true }
        }
        throw err
      }
    },
    enabled: moduleQueryEnabled && !!scanVersion && canManage,
  })

  const moduleScan: ModuleScan | null = scanData?.scan ?? null
  const scanNotFound = scanData?.notFound ?? false

  // =========================================================================
  // 4. Module docs query (depends on selectedVersion)
  // =========================================================================
  const { data: moduleDocs = null, isLoading: docsLoading } = useQuery<ModuleDoc | null>({
    queryKey: queryKeys.modules.docs(namespace ?? '', name ?? '', system ?? '', scanVersion),
    queryFn: async () => {
      try {
        return await api.getModuleDocs(namespace!, name!, system!, scanVersion)
      } catch {
        return null
      }
    },
    enabled: moduleQueryEnabled && !!scanVersion,
  })

  // =========================================================================
  // 5. Version info / capabilities (global, stale 5 min)
  // =========================================================================
  const { data: versionInfo } = useQuery({
    queryKey: queryKeys.versionInfo.get(),
    queryFn: () => api.getVersionInfo(),
    staleTime: 5 * 60 * 1000,
  })

  const ociEnabled = versionInfo?.oci === true

  // =========================================================================
  // 6. Webhook events (on-demand via loadWebhookEvents)
  // =========================================================================
  const [webhookEventsLoaded, setWebhookEventsLoaded] = useState(false)
  const [webhookEventsLoading, setWebhookEventsLoading] = useState(false)
  const [webhookEvents, setWebhookEvents] = useState<SCMWebhookEvent[]>([])

  const loadWebhookEvents = async (moduleId: string) => {
    try {
      setWebhookEventsLoading(true)
      const events = await api.getWebhookEvents(moduleId)
      setWebhookEvents(Array.isArray(events) ? events : [])
    } catch {
      setWebhookEvents([])
    } finally {
      setWebhookEventsLoading(false)
      setWebhookEventsLoaded(true)
    }
  }

  // =========================================================================
  // Mutations
  // =========================================================================

  const deleteModuleMutation = useMutation({
    mutationFn: () => api.deleteModule(namespace!, name!, system!),
    onSuccess: () => {
      navigate('/modules')
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to delete module. Please try again.'))
    },
    onSettled: () => {
      setDeleteModuleDialogOpen(false)
    },
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (version: string) => api.deleteModuleVersion(namespace!, name!, system!, version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
      })
      setVersionToDelete(null)
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to delete version. Please try again.'))
    },
    onSettled: () => {
      setDeleteVersionDialogOpen(false)
    },
  })

  const deprecateVersionMutation = useMutation({
    mutationFn: (args: { version: string; message?: string; replacementSource?: string }) =>
      api.deprecateModuleVersion(
        namespace!,
        name!,
        system!,
        args.version,
        args.message,
        args.replacementSource,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
      })
      setDeprecationMessage('')
      setDeprecationReplacementSource('')
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to deprecate version. Please try again.'))
    },
    onSettled: () => {
      setDeprecateDialogOpen(false)
    },
  })

  const undeprecateVersionMutation = useMutation({
    mutationFn: (version: string) =>
      api.undeprecateModuleVersion(namespace!, name!, system!, version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
      })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to remove deprecation. Please try again.'))
    },
  })

  const deprecateModuleMutation = useMutation({
    mutationFn: (args: { message: string; successor_module_id?: string }) =>
      api.deprecateModule(namespace!, name!, system!, args),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
      })
      setModuleDeprecationMessage('')
      setSuccessorModuleId('')
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to deprecate module. Please try again.'))
    },
    onSettled: () => {
      setDeprecateModuleDialogOpen(false)
    },
  })

  const undeprecateModuleMutation = useMutation({
    mutationFn: () => api.undeprecateModule(namespace!, name!, system!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
      })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to remove module deprecation. Please try again.'))
    },
    onSettled: () => {
      setUndeprecateModuleDialogOpen(false)
    },
  })

  const updateDescriptionMutation = useMutation({
    mutationFn: (newDescription: string) =>
      api.updateModule(module!.id, { description: newDescription }),
    onSuccess: (_data, newDescription) => {
      // Optimistically update the cached module
      queryClient.setQueryData(
        queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
        (old: typeof moduleData) =>
          old ? { ...old, module: { ...old.module, description: newDescription } } : old,
      )
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to update description'))
    },
  })

  const scmUnlinkMutation = useMutation({
    mutationFn: () => api.unlinkModuleFromSCM(module!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.scm(module?.id ?? ''),
      })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to unlink repository'))
    },
  })

  const rescanMutation = useMutation({
    mutationFn: () =>
      api.reanalyzeModuleVersion(namespace!, name!, system!, selectedVersion!.version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.scan(
          namespace ?? '',
          name ?? '',
          system ?? '',
          selectedVersion?.version ?? '',
        ),
      });
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to queue re-scan. Please try again.'));
    },
  });

  const scmSyncMutation = useMutation({
    mutationFn: () => api.triggerManualSync(module!.id),
    onSuccess: () => {
      setError(null)
      // Poll for updated versions after an async sync (202) at 2s, 5s, and 12s.
      ;[2000, 5000, 12000].forEach((delay) => {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
          })
        }, delay)
      })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to trigger sync'))
    },
  })

  // =========================================================================
  // Handler wrappers (preserve existing call signatures for the page)
  // =========================================================================

  const loadSCMLink = useCallback(
    (_moduleId: string) => {
      // SCM link is now loaded via React Query; this is a no-op kept for
      // backward compatibility with the page component.
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.scm(_moduleId) })
    },
    [queryClient],
  )

  const pollForVersions = useCallback(() => {
    ;[2000, 5000, 12000].forEach((delay) => {
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.modules.detail(namespace ?? '', name ?? '', system ?? ''),
        })
      }, delay)
    })
  }, [queryClient, namespace, name, system])

  const handleRescan = () => {
    if (!namespace || !name || !system || !selectedVersion) return;
    rescanMutation.mutate();
  };

  const handleSCMSync = () => {
    if (!module?.id) {
      console.error('Cannot sync: module.id is not available')
      return
    }
    scmSyncMutation.mutate()
  }

  const handleSCMUnlink = () => {
    if (!module?.id) return
    scmUnlinkMutation.mutate()
  }

  const handleCopySource = () => {
    if (!module || !selectedVersion) return
    const source = `${namespace}/${name}/${system}`
    navigator.clipboard.writeText(source)
    setCopiedSource(true)
    setTimeout(() => setCopiedSource(false), 2000)
  }

  const handlePublishNewVersion = () => {
    navigate('/admin/upload/module', {
      state: {
        moduleData: {
          namespace,
          name,
          provider: system,
        },
      },
    })
  }

  const handleDeleteModule = () => {
    if (!namespace || !name || !system) return
    deleteModuleMutation.mutate()
  }

  const handleDeleteVersion = () => {
    if (!namespace || !name || !system || !versionToDelete) return
    deleteVersionMutation.mutate(versionToDelete)
  }

  const openDeleteVersionDialog = (version: string) => {
    setVersionToDelete(version)
    setDeleteVersionDialogOpen(true)
  }

  const handleDeprecateVersion = () => {
    if (!namespace || !name || !system || !selectedVersion) return
    deprecateVersionMutation.mutate({
      version: selectedVersion.version,
      message: deprecationMessage || undefined,
      replacementSource: deprecationReplacementSource || undefined,
    })
  }

  const handleUndeprecateVersion = () => {
    if (!namespace || !name || !system || !selectedVersion) return
    undeprecateVersionMutation.mutate(selectedVersion.version)
  }

  const handleUpdateDescription = (newDescription: string) => {
    if (!module?.id) return
    updateDescriptionMutation.mutate(newDescription)
  }

  const handleDeprecateModule = () => {
    if (!namespace || !name || !system) return
    deprecateModuleMutation.mutate({
      message: moduleDeprecationMessage,
      successor_module_id: successorModuleId || undefined,
    })
  }

  const handleUndeprecateModule = () => {
    if (!namespace || !name || !system) return
    undeprecateModuleMutation.mutate()
  }

  const getTerraformExample = () => {
    if (!module || !selectedVersion) return ''

    const v = selectedVersion.version
    const majorMinor = v.split('.').slice(0, 2).join('.')

    return `module "${name}" {
  source  = "${REGISTRY_HOST}/${namespace}/${name}/${system}"
  version = ">=${majorMinor}"
}`
  }

  return {
    // Route params
    namespace,
    name,
    system,
    // Auth
    isAuthenticated,
    canManage,
    // Core module state
    module,
    versions,
    selectedVersion,
    setSelectedVersion,
    loading,
    error,
    copiedSource,
    // Delete module dialog
    deleteModuleDialogOpen,
    setDeleteModuleDialogOpen,
    deleting: deleteModuleMutation.isPending || deleteVersionMutation.isPending,
    // Delete version dialog
    deleteVersionDialogOpen,
    setDeleteVersionDialogOpen,
    versionToDelete,
    // Deprecate dialog
    deprecateDialogOpen,
    setDeprecateDialogOpen,
    deprecationMessage,
    setDeprecationMessage,
    deprecationReplacementSource,
    setDeprecationReplacementSource,
    deprecating: deprecateVersionMutation.isPending || undeprecateVersionMutation.isPending,
    // Module-level deprecation
    deprecateModuleDialogOpen,
    setDeprecateModuleDialogOpen,
    moduleDeprecationMessage,
    setModuleDeprecationMessage,
    successorModuleId,
    setSuccessorModuleId,
    undeprecateModuleDialogOpen,
    setUndeprecateModuleDialogOpen,
    deprecatingModule: deprecateModuleMutation.isPending || undeprecateModuleMutation.isPending,
    // SCM linking
    scmLink,
    scmLinkLoaded,
    scmWizardOpen,
    setScmWizardOpen,
    scmSyncing: scmSyncMutation.isPending,
    scmUnlinking: scmUnlinkMutation.isPending,
    // Webhook events
    webhookEvents,
    webhookEventsLoaded,
    webhookEventsLoading,
    webhookEventsExpanded,
    setWebhookEventsExpanded,
    // Security scan
    moduleScan,
    scanLoading,
    scanNotFound,
    rescanPending: rescanMutation.isPending,
    handleRescan,
    // Module docs
    moduleDocs,
    docsLoading,
    // OCI distribution
    ociEnabled,
    // Handlers
    loadSCMLink,
    loadWebhookEvents,
    pollForVersions,
    handleSCMSync,
    handleSCMUnlink,
    handleCopySource,
    handlePublishNewVersion,
    handleDeleteModule,
    handleDeleteVersion,
    openDeleteVersionDialog,
    handleDeprecateVersion,
    handleUndeprecateVersion,
    handleDeprecateModule,
    handleUndeprecateModule,
    handleUpdateDescription,
    getTerraformExample,
  }
}
