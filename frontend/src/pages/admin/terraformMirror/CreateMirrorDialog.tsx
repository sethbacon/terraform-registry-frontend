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
import type { CreateTerraformMirrorConfigRequest } from '../../../types/terraform_mirror'
import { KNOWN_PLATFORMS, SUPPORTED_TOOLS, emptyCreate, toolDefaultUrl } from './constants'

/** Everything the create-mirror dialog needs; produced by `useCreateMirrorFlow`. */
export interface CreateMirrorFlow {
  open: boolean
  form: CreateTerraformMirrorConfigRequest
  setForm: React.Dispatch<React.SetStateAction<CreateTerraformMirrorConfigRequest>>
  versionFilter: string
  setVersionFilter: (value: string) => void
  platformFilter: string[]
  setPlatformFilter: (value: string[]) => void
  isPending: boolean
  /** Opens the dialog on a blank form, discarding anything a cancelled run left behind. */
  openDialog: () => void
  close: () => void
  submit: () => void
}

/**
 * Owns the create-mirror flow: the draft form, its version/platform filters and
 * the POST that turns them into a config.
 *
 * On success the page's success banner is set with `setSuccess`, not
 * `showSuccess` — this page deliberately leaves a previous error banner on
 * screen (see TerraformMirrorPage).
 */
export function useCreateMirrorFlow(status: StatusMessage): CreateMirrorFlow {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateTerraformMirrorConfigRequest>(emptyCreate())
  const [versionFilter, setVersionFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: async () => {
      await api.createTerraformMirrorConfig({
        ...form,
        platform_filter: platformFilter.length > 0 ? platformFilter : undefined,
        version_filter: versionFilter.trim() || undefined,
      })
    },
    onSuccess: () => {
      status.setSuccess(t('admin.terraformMirror.msgCreated', { name: form.name }))
      setOpen(false)
      setForm(emptyCreate())
      setVersionFilter('')
      setPlatformFilter([])
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errCreate')))
    },
  })

  return {
    open,
    form,
    setForm,
    versionFilter,
    setVersionFilter,
    platformFilter,
    setPlatformFilter,
    isPending: mutation.isPending,
    openDialog: () => {
      setForm(emptyCreate())
      setVersionFilter('')
      setPlatformFilter([])
      setOpen(true)
    },
    close: () => setOpen(false),
    submit: () => {
      mutation.mutate()
    },
  }
}

/** The "Add mirror" form dialog. */
const CreateMirrorDialog: React.FC<{ flow: CreateMirrorFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  const {
    form,
    setForm,
    versionFilter,
    setVersionFilter,
    platformFilter,
    setPlatformFilter,
    isPending,
  } = flow

  return (
    <Dialog open={flow.open} onClose={flow.close} maxWidth="sm" fullWidth>
      <DialogTitle>{t('admin.terraformMirror.dialogTitleCreate')}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('admin.terraformMirror.labelName')}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            helperText={t('admin.terraformMirror.helpName')}
            required
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
            value={form.tool}
            onChange={(e) => {
              const newTool = e.target.value
              setForm((prev) => {
                // Auto-update upstream URL only if it still matches the previous tool's default
                const prevDefault = toolDefaultUrl(prev.tool)
                const shouldUpdate = prev.upstream_url === prevDefault || prev.upstream_url === ''
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
            value={form.upstream_url}
            onChange={(e) => setForm((prev) => ({ ...prev, upstream_url: e.target.value }))}
            helperText={
              form.tool === 'opentofu'
                ? t('admin.terraformMirror.helpUrlOpentofu')
                : form.tool === 'terraform'
                  ? t('admin.terraformMirror.helpUrlTerraform')
                  : t('admin.terraformMirror.helpUrlCustom')
            }
            required
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
        <Button
          onClick={flow.submit}
          variant="contained"
          disabled={isPending || !form.name || !form.upstream_url}
        >
          {isPending ? <CircularProgress size={18} /> : t('admin.terraformMirror.create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateMirrorDialog
