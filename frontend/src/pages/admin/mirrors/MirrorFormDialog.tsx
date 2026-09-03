import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material'
import api from '../../../services/api'
import { queryKeys } from '../../../services/queryKeys'
import { getErrorMessage } from '../../../utils/errors'
import type { StatusMessage } from '../../../hooks/useStatusMessage'
import {
  type CreateMirrorConfigRequest,
  type MirrorConfiguration,
  parseMirrorConfig,
} from '../../../types/mirror'
import { KNOWN_PLATFORMS, emptyMirrorForm } from './constants'

/** Everything the create/edit mirror form needs; produced by `useMirrorFormFlow`. */
export interface MirrorFormFlow {
  open: boolean
  /** The mirror being edited, or null when the form is creating a new one. */
  editing: MirrorConfiguration | null
  form: Partial<CreateMirrorConfigRequest>
  setForm: React.Dispatch<React.SetStateAction<Partial<CreateMirrorConfigRequest>>>
  /** Comma-separated namespace/provider filters, and the version/platform filters. */
  namespaceFilter: string
  setNamespaceFilter: (value: string) => void
  providerFilter: string
  setProviderFilter: (value: string) => void
  versionFilter: string
  setVersionFilter: (value: string) => void
  platformFilter: string[]
  setPlatformFilter: (value: string[]) => void
  /** True when auto-approve rules are active but do not parse as JSON. */
  autoApproveInvalid: boolean
  /** Opens a blank create form (the Add Mirror button). */
  openCreate: () => void
  /** Opens the create form without discarding the current draft (the ?action=add deep link). */
  openCreateFromDeepLink: () => void
  openEdit: (mirror: MirrorConfiguration) => void
  close: () => void
  submit: () => void
}

/**
 * Owns the one dialog that both creates and edits a provider mirror: the draft,
 * its four filter inputs, the auto-approve validation and both mutations.
 *
 * Create and edit are a single flow rather than two modules because they are a
 * single dialog on screen — `editing` alone decides the title, the submit label
 * and which request runs, and the two share one draft, so splitting them would
 * mean handing the same form state to both halves as props.
 *
 * Each success clears only its own half (create clears the open flag, update
 * clears `editing`), as the page did; the other is already false on that path.
 */
export function useMirrorFormFlow(status: StatusMessage): MirrorFormFlow {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<MirrorConfiguration | null>(null)
  const [form, setForm] = useState<Partial<CreateMirrorConfigRequest>>(emptyMirrorForm)

  // The filter inputs are edited as text (or, for platforms, as chips) and only
  // become arrays at submit time, so they are kept beside the draft rather than
  // inside it.
  const [namespaceFilter, setNamespaceFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [versionFilter, setVersionFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string[]>([])

  const resetForm = () => {
    setForm(emptyMirrorForm())
    setNamespaceFilter('')
    setProviderFilter('')
    setVersionFilter('')
    setPlatformFilter([])
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateMirrorConfigRequest) => api.createMirror(data),
    onSuccess: () => {
      setCreateOpen(false)
      resetForm()
      status.showSuccess(t('admin.mirrors.msgCreated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.mirrors.errCreate')))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateMirror>[1] }) =>
      api.updateMirror(id, data),
    onSuccess: () => {
      setEditing(null)
      resetForm()
      status.showSuccess(t('admin.mirrors.msgUpdated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.mirrors.errUpdate')))
    },
  })

  // auto_approve_rules is a JSON string ({ rules: [...], mode: "any" | "all" }).
  // It is only meaningful — and only editable — when approval is required, so it
  // is "active" only when requires_approval is on and the field is non-empty.
  // Gating on that keeps a hidden field from ever blocking submit or leaking a
  // stale value into the payload. Validate it parses while active so an invalid
  // blob can't be saved and then fail silently at sync time.
  const autoApproveTrimmed = (form.auto_approve_rules ?? '').trim()
  const autoApproveActive = (form.requires_approval ?? false) && autoApproveTrimmed !== ''
  let autoApproveInvalid = false
  if (autoApproveActive) {
    try {
      JSON.parse(autoApproveTrimmed)
    } catch {
      autoApproveInvalid = true
    }
  }

  /** Splits a comma-separated filter box into the array the API expects. */
  const splitFilter = (value: string) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  const handleCreate = () => {
    status.setError(null)
    const data = {
      ...form,
      namespace_filter: splitFilter(namespaceFilter),
      provider_filter: splitFilter(providerFilter),
      version_filter: versionFilter.trim() || undefined,
      platform_filter: platformFilter.length > 0 ? platformFilter : undefined,
      auto_approve_rules: autoApproveActive ? autoApproveTrimmed : undefined,
    }
    createMutation.mutate(data as CreateMirrorConfigRequest)
  }

  // Update names every field it sends rather than spreading the draft. Today
  // the two are equivalent — the explicit filter assignments below already
  // override every key emptyMirrorForm() sets — so this is an allow-list, not
  // a fix: a field added to the create draft later is not silently sent on
  // update until someone adds it here deliberately.
  const handleUpdate = () => {
    if (!editing) return
    status.setError(null)
    const data = {
      name: form.name,
      description: form.description,
      upstream_registry_url: form.upstream_registry_url,
      namespace_filter: splitFilter(namespaceFilter),
      provider_filter: splitFilter(providerFilter),
      version_filter: versionFilter.trim() || undefined,
      platform_filter: platformFilter.length > 0 ? platformFilter : undefined,
      enabled: form.enabled,
      sync_interval_hours: form.sync_interval_hours,
      requires_approval: form.requires_approval,
      auto_approve_rules: autoApproveActive ? autoApproveTrimmed : undefined,
      pull_through_enabled: form.pull_through_enabled,
      pull_through_cache_ttl_hours: form.pull_through_cache_ttl_hours,
    }
    updateMutation.mutate({ id: editing.id, data })
  }

  return {
    open: createOpen || !!editing,
    editing,
    form,
    setForm,
    namespaceFilter,
    setNamespaceFilter,
    providerFilter,
    setProviderFilter,
    versionFilter,
    setVersionFilter,
    platformFilter,
    setPlatformFilter,
    autoApproveInvalid,
    openCreate: () => {
      resetForm()
      setCreateOpen(true)
    },
    // The ?action=add deep link only ever flipped the open flag, so it keeps
    // whatever draft is in hand. Preserved as its own entry point rather than
    // folded into openCreate (#783).
    openCreateFromDeepLink: () => setCreateOpen(true),
    openEdit: (mirror: MirrorConfiguration) => {
      setEditing(mirror)
      const parsed = parseMirrorConfig(mirror)
      setForm({
        name: mirror.name,
        description: mirror.description,
        upstream_registry_url: mirror.upstream_registry_url,
        enabled: mirror.enabled,
        sync_interval_hours: mirror.sync_interval_hours,
        requires_approval: mirror.requires_approval ?? false,
        auto_approve_rules: mirror.auto_approve_rules ?? '',
        pull_through_enabled: mirror.pull_through_enabled ?? false,
        pull_through_cache_ttl_hours: mirror.pull_through_cache_ttl_hours ?? 24,
      })
      setNamespaceFilter(parsed.namespaceFilters.join(', '))
      setProviderFilter(parsed.providerFilters.join(', '))
      setVersionFilter(mirror.version_filter || '')
      setPlatformFilter(parsed.platformFilters)
    },
    close: () => {
      setCreateOpen(false)
      setEditing(null)
      resetForm()
    },
    submit: () => (editing ? handleUpdate() : handleCreate()),
  }
}

/** The single Add/Edit mirror form; `flow.editing` decides which of the two it is. */
const MirrorFormDialog: React.FC<{ flow: MirrorFormFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  const {
    editing,
    form,
    setForm,
    namespaceFilter,
    setNamespaceFilter,
    providerFilter,
    setProviderFilter,
    versionFilter,
    setVersionFilter,
    platformFilter,
    setPlatformFilter,
    autoApproveInvalid,
  } = flow

  return (
    <Dialog open={flow.open} onClose={flow.close} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editing ? t('admin.mirrors.dialogTitleEdit') : t('admin.mirrors.dialogTitleAdd')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('admin.mirrors.labelName')}
            fullWidth
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            helperText={t('admin.mirrors.helpName')}
          />

          <TextField
            label={t('admin.mirrors.labelDescription')}
            fullWidth
            multiline
            rows={2}
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <TextField
            label={t('admin.mirrors.labelUpstreamUrl')}
            fullWidth
            value={form.upstream_registry_url}
            onChange={(e) => setForm({ ...form, upstream_registry_url: e.target.value })}
            required
            helperText={t('admin.mirrors.helpUpstreamUrl')}
          />

          <TextField
            label={t('admin.mirrors.labelNamespaceFilter')}
            fullWidth
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            helperText={t('admin.mirrors.helpNamespaceFilter')}
          />

          <TextField
            label={t('admin.mirrors.labelProviderFilter')}
            fullWidth
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            helperText={t('admin.mirrors.helpProviderFilter')}
          />

          <TextField
            label={t('admin.mirrors.labelVersionFilter')}
            fullWidth
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            helperText={t('admin.mirrors.helpVersionFilter')}
            placeholder={t('admin.mirrors.placeholderVersionFilter')}
          />

          <Autocomplete
            multiple
            options={KNOWN_PLATFORMS}
            value={platformFilter}
            onChange={(_event, newValue) => setPlatformFilter(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('admin.mirrors.labelPlatformFilter')}
                placeholder={
                  platformFilter.length === 0 ? t('admin.mirrors.placeholderAllPlatforms') : ''
                }
                helperText={t('admin.mirrors.helpPlatformFilter')}
              />
            )}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => (
                <Chip label={option} size="small" {...getItemProps({ index })} key={option} />
              ))
            }
          />

          <TextField
            label={t('admin.mirrors.labelSyncInterval')}
            type="number"
            fullWidth
            value={form.sync_interval_hours}
            onChange={(e) =>
              setForm({
                ...form,
                sync_interval_hours: parseInt(e.target.value) || 24,
              })
            }
            helperText={t('admin.mirrors.helpSyncInterval')}
            slotProps={{
              htmlInput: { min: 1 },
            }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
            }
            label={t('admin.mirrors.enabled')}
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.requires_approval ?? false}
                onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
              />
            }
            label={t('admin.mirrors.requiresApproval')}
          />

          {form.requires_approval && (
            <TextField
              label={t('admin.mirrors.labelAutoApproveRules')}
              fullWidth
              multiline
              minRows={3}
              value={form.auto_approve_rules ?? ''}
              onChange={(e) => setForm({ ...form, auto_approve_rules: e.target.value })}
              error={autoApproveInvalid}
              helperText={
                autoApproveInvalid
                  ? t('admin.mirrors.errAutoApproveRules')
                  : t('admin.mirrors.helpAutoApproveRules')
              }
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={form.pull_through_enabled ?? false}
                onChange={(e) => setForm({ ...form, pull_through_enabled: e.target.checked })}
              />
            }
            label={t('admin.mirrors.pullThroughEnabled')}
          />

          {form.pull_through_enabled && (
            <TextField
              label={t('admin.mirrors.labelPullThroughTtl')}
              type="number"
              fullWidth
              value={form.pull_through_cache_ttl_hours ?? 24}
              onChange={(e) =>
                setForm({
                  ...form,
                  pull_through_cache_ttl_hours: parseInt(e.target.value) || 24,
                })
              }
              helperText={t('admin.mirrors.helpPullThroughTtl')}
              slotProps={{
                htmlInput: { min: 1 },
              }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.close}>{t('admin.mirrors.cancel')}</Button>
        <Button
          variant="contained"
          onClick={flow.submit}
          disabled={!form.name || !form.upstream_registry_url || autoApproveInvalid}
        >
          {editing ? t('admin.mirrors.update') : t('admin.mirrors.create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default MirrorFormDialog
