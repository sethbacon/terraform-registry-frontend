import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import api from '../../../services/api'
import { queryKeys } from '../../../services/queryKeys'
import { getErrorMessage } from '../../../utils/errors'
import type { StatusMessage } from '../../../hooks/useStatusMessage'
import type { TerraformMirrorConfig } from '../../../types/terraform_mirror'

/** Everything the delete-mirror confirmation needs; produced by `useDeleteMirrorFlow`. */
export interface DeleteMirrorFlow {
  /** The config awaiting confirmation, or null when the dialog is closed. */
  config: TerraformMirrorConfig | null
  isPending: boolean
  openDialog: (config: TerraformMirrorConfig) => void
  close: () => void
  submit: () => void
}

/**
 * Owns the delete-mirror confirmation: which config is pending deletion and the
 * DELETE that removes it.
 *
 * On success the page's success banner is set with `setSuccess`, not
 * `showSuccess` — this page deliberately leaves a previous error banner on
 * screen (see TerraformMirrorPage).
 */
export function useDeleteMirrorFlow(status: StatusMessage): DeleteMirrorFlow {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<TerraformMirrorConfig | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('No config to delete')
      await api.deleteTerraformMirrorConfig(config.id)
    },
    onSuccess: () => {
      status.setSuccess(t('admin.terraformMirror.msgDeleted', { name: config?.name }))
      setConfig(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errDelete')))
    },
  })

  return {
    config,
    isPending: mutation.isPending,
    openDialog: setConfig,
    close: () => setConfig(null),
    submit: () => {
      if (!config) return
      mutation.mutate()
    },
  }
}

/** The "delete this mirror configuration?" confirmation. */
const DeleteMirrorDialog: React.FC<{ flow: DeleteMirrorFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  return (
    <Dialog open={!!flow.config} onClose={flow.close}>
      <DialogTitle>{t('admin.terraformMirror.deleteConfigTitle')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('admin.terraformMirror.deleteConfigTextBefore')}
          <strong>{flow.config?.name}</strong>
          {t('admin.terraformMirror.deleteConfigTextAfter')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.close}>{t('admin.terraformMirror.cancel')}</Button>
        <Button color="error" onClick={flow.submit} disabled={flow.isPending}>
          {flow.isPending ? <CircularProgress size={18} /> : t('admin.terraformMirror.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteMirrorDialog
