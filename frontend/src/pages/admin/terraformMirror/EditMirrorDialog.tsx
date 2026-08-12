import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material'
import api from '../../../services/api'
import { queryKeys } from '../../../services/queryKeys'
import { getErrorMessage } from '../../../utils/errors'
import type { StatusMessage } from '../../../hooks/useStatusMessage'
import {
  type TerraformMirrorConfig,
  type UpdateTerraformMirrorConfigRequest,
  parsePlatformFilter,
} from '../../../types/terraform_mirror'
import { KNOWN_PLATFORMS, SUPPORTED_TOOLS, toolDefaultUrl } from './constants'

/** Everything the edit-mirror dialog needs; produced by `useEditMirrorFlow`. */
export interface EditMirrorFlow {
  /** The config being edited, or null when the dialog is closed. */
  config: TerraformMirrorConfig | null
  form: UpdateTerraformMirrorConfigRequest
  setForm: React.Dispatch<React.SetStateAction<UpdateTerraformMirrorConfigRequest>>
  versionFilter: string
  setVersionFilter: (value: string) => void
  platformFilter: string[]
  setPlatformFilter: (value: string[]) => void
  isPending: boolean
  /** Opens the dialog seeded from the given config's current values. */
  openDialog: (config: TerraformMirrorConfig) => void
  close: () => void
  submit: () => void
}

/**
 * Owns the edit-mirror flow: which config is open, the form seeded from it and
 * the PUT that saves it back.
 *
 * On success the page's success banner is set with `setSuccess`, not
 * `showSuccess` — this page deliberately leaves a previous error banner on
 * screen (see TerraformMirrorPage).
 */
export function useEditMirrorFlow(status: StatusMessage): EditMirrorFlow {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<TerraformMirrorConfig | null>(null)
  const [form, setForm] = useState<UpdateTerraformMirrorConfigRequest>({})
  const [versionFilter, setVersionFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('No config to edit')
      await api.updateTerraformMirrorConfig(config.id, {
        ...form,
        platform_filter: platformFilter.length > 0 ? platformFilter : [],
        version_filter: versionFilter.trim() || '',
      })
    },
    onSuccess: () => {
      status.setSuccess(t('admin.terraformMirror.msgUpdated', { name: config?.name }))
      setConfig(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errUpdate')))
    },
  })

  return {
    config,
    form,
    setForm,
    versionFilter,
    setVersionFilter,
    platformFilter,
    setPlatformFilter,
    isPending: mutation.isPending,
    openDialog: (next: TerraformMirrorConfig) => {
      setConfig(next)
      setVersionFilter(next.version_filter ?? '')
      setPlatformFilter(parsePlatformFilter(next.platform_filter))
      setForm({
        name: next.name,
        description: next.description ?? '',
        tool: next.tool,
        enabled: next.enabled,
        upstream_url: next.upstream_url,
        gpg_verify: next.gpg_verify,
        stable_only: next.stable_only,
        sync_interval_hours: next.sync_interval_hours,
        requires_approval: next.requires_approval ?? false,
      })
    },
    close: () => setConfig(null),
    submit: () => {
      if (!config) return
      mutation.mutate()
    },
  }
}

/**
 * The "Edit mirror" form dialog. Deliberately not merged with
 * CreateMirrorDialog: create marks Name and Upstream URL as required and
 * explains Name in helper text, edit does neither, and the two forms are typed
 * against different request shapes.
 */
const EditMirrorDialog: React.FC<{ flow: EditMirrorFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  const {
    config,
    form,
    setForm,
    versionFilter,
    setVersionFilter,
    platformFilter,
    setPlatformFilter,
    isPending,
  } = flow

  return (
    <Dialog open={!!config} onClose={flow.close} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('admin.terraformMirror.dialogTitleEdit', { name: config?.name })}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('admin.terraformMirror.labelName')}
            value={form.name ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            fullWidth
          />
          <TextField
            label={t('admin.terraformMirror.labelDescription')}
            value={form.description ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            fullWidth
          />
          <TextField
            select
            label={t('admin.terraformMirror.labelTool')}
            value={form.tool ?? 'terraform'}
            onChange={(e) => {
              const newTool = e.target.value
              setForm((prev) => {
                const prevDefault = toolDefaultUrl(prev.tool ?? 'terraform')
                const shouldUpdate =
                  (prev.upstream_url ?? '') === prevDefault || (prev.upstream_url ?? '') === ''
                return {
                  ...prev,
                  tool: newTool,
                  upstream_url: shouldUpdate ? toolDefaultUrl(newTool) : prev.upstream_url,
                }
              })
            }}
            fullWidth
          >
            {SUPPORTED_TOOLS.map((toolOption) => (
              <MenuItem key={toolOption.value} value={toolOption.value}>
                {toolOption.label}
              </MenuItem>
            ))}
            <MenuItem value="custom">{t('admin.terraformMirror.menuCustom')}</MenuItem>
          </TextField>
          <TextField
            label={t('admin.terraformMirror.labelUpstreamUrl')}
            value={form.upstream_url ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, upstream_url: e.target.value }))}
            helperText={
              form.tool === 'opentofu'
                ? t('admin.terraformMirror.helpUrlOpentofu')
                : form.tool === 'terraform'
                  ? t('admin.terraformMirror.helpUrlTerraform')
                  : t('admin.terraformMirror.helpUrlCustom')
            }
            fullWidth
          />
          <TextField
            label={t('admin.terraformMirror.labelSyncInterval')}
            type="number"
            value={form.sync_interval_hours ?? 24}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                sync_interval_hours: parseInt(e.target.value, 10),
              }))
            }
            fullWidth
            slotProps={{
              htmlInput: { min: 1 },
            }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled ?? true}
                  onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
              }
              label={t('admin.terraformMirror.labelEnabled')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.gpg_verify ?? true}
                  onChange={(e) => setForm((prev) => ({ ...prev, gpg_verify: e.target.checked }))}
                />
              }
              label={t('admin.terraformMirror.labelGpgVerify')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.stable_only ?? false}
                  onChange={(e) => setForm((prev) => ({ ...prev, stable_only: e.target.checked }))}
                />
              }
              label={t('admin.terraformMirror.labelStableOnly')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.requires_approval ?? false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      requires_approval: e.target.checked,
                    }))
                  }
                />
              }
              label={t('admin.terraformMirror.labelRequiresApproval')}
            />
          </Box>
          <TextField
            label={t('admin.terraformMirror.labelVersionFilter')}
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            helperText={t('admin.terraformMirror.helpVersionFilter')}
            fullWidth
          />
          <Autocomplete
            multiple
            options={KNOWN_PLATFORMS}
            value={platformFilter}
            onChange={(_event, newValue) => setPlatformFilter(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('admin.terraformMirror.labelPlatformFilter')}
                placeholder={
                  platformFilter.length === 0
                    ? t('admin.terraformMirror.placeholderAllPlatforms')
                    : ''
                }
                helperText={t('admin.terraformMirror.helpPlatformFilter')}
                fullWidth
              />
            )}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => (
                <Chip label={option} size="small" {...getItemProps({ index })} key={option} />
              ))
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.close}>{t('admin.terraformMirror.cancel')}</Button>
        <Button onClick={flow.submit} variant="contained" disabled={isPending}>
          {isPending ? <CircularProgress size={18} /> : t('admin.terraformMirror.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default EditMirrorDialog
