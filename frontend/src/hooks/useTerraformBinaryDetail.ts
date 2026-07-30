import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import { type TerraformVersion } from '../types/terraform_mirror'
import { useAuth } from '../contexts/AuthContext'

/** Minimal config shape returned by the public mirror-config endpoint. */
export interface PublicMirrorSummary {
  name: string
  description?: string | null
  tool: string
}

/**
 * Data fetching, mutation and UI state for TerraformBinaryDetailPage.
 *
 * Keeps the page component presentational: the public mirror/version lookups,
 * the `config_id` needed for admin actions, and the deprecate/undeprecate/delete
 * dialog state all live here.
 */
export function useTerraformBinaryDetail() {
  const { name } = useParams<{ name: string }>()
  const { isAuthenticated, allowedScopes } = useAuth()
  const canManage =
    isAuthenticated && (allowedScopes.includes('admin') || allowedScopes.includes('mirrors:manage'))

  const [config, setConfig] = useState<PublicMirrorSummary | null>(null)
  // configId is the UUID needed for admin actions (deprecate/delete)
  const [configId, setConfigId] = useState<string | null>(null)
  const [versions, setVersions] = useState<TerraformVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Deprecate dialog
  const [deprecateTarget, setDeprecateTarget] = useState<TerraformVersion | null>(null)
  const [deprecateMessage, setDeprecateMessage] = useState('')
  const [deprecating, setDeprecating] = useState(false)

  // Undeprecate
  const [undeprecating, setUndeprecating] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<TerraformVersion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    if (!name) return
    setLoading(true)
    setError(null)
    try {
      // Both endpoints are public — no auth required.
      // The versions response includes config_id (UUID) which we need for admin actions.
      const [publicConfigs, versionsData] = await Promise.all([
        api.listPublicTerraformMirrorConfigs(),
        api.listPublicTerraformVersions(name),
      ])
      const found = publicConfigs.find((c) => c.name === name)
      if (!found) {
        setError(`Mirror config "${name}" not found.`)
        return
      }
      setConfig(found)
      // Extract the config UUID from the first version record so we can call
      // admin actions (deprecate / delete / platforms) without hitting admin list.
      const versionRows = versionsData.versions ?? []
      if (versionRows.length > 0) {
        setConfigId(versionRows[0].config_id)
      }
      // Sort: latest first, then by version desc
      const sorted = [...versionRows].sort((a, b) => {
        if (a.is_latest !== b.is_latest) return a.is_latest ? -1 : 1
        return b.version.localeCompare(a.version, undefined, { numeric: true })
      })
      setVersions(sorted)
    } catch {
      setError(`Failed to load details for "${name}".`)
    } finally {
      setLoading(false)
    }
  }, [name])

  useEffect(() => {
    loadData()
  }, [loadData])

  const closeDeprecateDialog = () => {
    setDeprecateTarget(null)
    setDeprecateMessage('')
  }

  const handleDeprecate = async () => {
    if (!configId || !deprecateTarget) return
    setDeprecating(true)
    try {
      await api.deprecateTerraformVersion(configId, deprecateTarget.version)
      setActionSuccess(
        `Version ${deprecateTarget.version} marked as deprecated. It will not be re-synced.`,
      )
      closeDeprecateDialog()
      loadData()
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to deprecate version'))
    } finally {
      setDeprecating(false)
    }
  }

  const handleUndeprecate = async (version: TerraformVersion) => {
    if (!configId) return
    setUndeprecating(true)
    try {
      await api.undeprecateTerraformVersion(configId, version.version)
      setActionSuccess(`Deprecation removed from version ${version.version}.`)
      loadData()
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to remove deprecation'))
    } finally {
      setUndeprecating(false)
    }
  }

  const handleDelete = async () => {
    if (!configId || !deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteTerraformVersion(configId, deleteTarget.version)
      setActionSuccess(`Version ${deleteTarget.version} deleted.`)
      setDeleteTarget(null)
      loadData()
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to delete version'))
    } finally {
      setDeleting(false)
    }
  }

  return {
    // Route params
    name,
    // Auth
    canManage,
    // Core state
    config,
    versions,
    loading,
    error,
    actionError,
    setActionError,
    actionSuccess,
    setActionSuccess,
    // Deprecate dialog
    deprecateTarget,
    setDeprecateTarget,
    deprecateMessage,
    setDeprecateMessage,
    deprecating,
    undeprecating,
    closeDeprecateDialog,
    // Delete dialog
    deleteTarget,
    setDeleteTarget,
    deleting,
    // Handlers
    handleDeprecate,
    handleUndeprecate,
    handleDelete,
  }
}
