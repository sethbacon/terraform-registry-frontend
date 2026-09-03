import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
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
import type { MirrorConfiguration } from '../../../types/mirror'

/** Everything the delete-mirror confirmation needs; produced by `useDeleteMirrorFlow`. */
export interface DeleteMirrorFlow {
  open: boolean
  /** The mirror named in the prompt; kept after a cancel so the name survives the exit transition. */
  mirror: MirrorConfiguration | null
  openDialog: (mirror: MirrorConfiguration) => void
  close: () => void
  submit: () => void
}

/**
 * Owns the delete-mirror confirmation: which mirror is being confirmed and the
 * DELETE that removes it.
 *
 * `open` is a flag separate from `mirror` on purpose: cancelling closes the
 * dialog without forgetting the mirror, so the "delete X?" prompt keeps its
 * name while MUI plays the exit transition. A successful delete clears both.
 *
 * Unlike the sibling Terraform binary mirror's delete dialog, the confirm
 * button is not disabled while the request is in flight — pre-existing, and
 * preserved rather than harmonised (#783).
 */
export function useDeleteMirrorFlow(status: StatusMessage): DeleteMirrorFlow {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mirror, setMirror] = useState<MirrorConfiguration | null>(null)

  const mutation = useMutation({
    mutationFn: (id: string) => api.deleteMirror(id),
    onSuccess: () => {
      setOpen(false)
      setMirror(null)
      status.showSuccess(t('admin.mirrors.msgDeleted'))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.mirrors.errDelete')))
    },
  })

  return {
    open,
    mirror,
    openDialog: (next: MirrorConfiguration) => {
      setMirror(next)
      setOpen(true)
    },
    close: () => setOpen(false),
    submit: () => {
      if (!mirror) return
      status.setError(null)
      mutation.mutate(mirror.id)
    },
  }
}

/** The "delete this mirror configuration?" confirmation. */
const DeleteMirrorDialog: React.FC<{ flow: DeleteMirrorFlow }> = ({ flow }) => {
  const { t } = useTranslation()

  return (
    <Dialog open={flow.open} onClose={flow.close}>
      <DialogTitle>{t('admin.mirrors.confirmDeleteTitle')}</DialogTitle>
      <DialogContent>
        <Typography>{t('admin.mirrors.confirmDeleteText', { name: flow.mirror?.name })}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.close}>{t('admin.mirrors.cancel')}</Button>
        <Button variant="contained" color="error" onClick={flow.submit}>
          {t('admin.mirrors.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteMirrorDialog
