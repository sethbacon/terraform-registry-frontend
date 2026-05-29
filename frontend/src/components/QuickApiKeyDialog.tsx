import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import { useAnnouncer } from '../contexts/AnnouncerContext'

type ExpiryPreset = '7' | '30' | '90' | 'never'

interface QuickApiKeyDialogProps {
  open: boolean
  onClose: () => void
  /**
   * Organization the key will belong to. If null/empty, creation is blocked
   * and the user is told they need to be a member of an organization.
   */
  organizationId: string | null
  /**
   * Registry hostname used to build the Terraform credentials snippet.
   */
  hostname: string
  /**
   * Scopes requested on the new key. Defaults to read-only when omitted.
   */
  defaultScopes?: string[]
}

function buildSnippet(host: string, token: string): string {
  return `credentials "${host}" {\n  token = "${token}"\n}`
}

function expiryIsoFromPreset(preset: ExpiryPreset): string | undefined {
  if (preset === 'never') return undefined
  const days = Number(preset)
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

const QuickApiKeyDialog: React.FC<QuickApiKeyDialogProps> = ({
  open,
  onClose,
  organizationId,
  hostname,
  defaultScopes,
}) => {
  const { t } = useTranslation()
  const { announce } = useAnnouncer()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [expiry, setExpiry] = React.useState<ExpiryPreset>('30')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [confirmClose, setConfirmClose] = React.useState(false)

  // Reset state when dialog opens.
  React.useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setExpiry('30')
      setSubmitting(false)
      setError(null)
      setToken(null)
      setCopied(false)
      setConfirmClose(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('quickApiKey.nameRequired'))
      return
    }
    if (!organizationId) {
      setError(t('quickApiKey.orgRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const resp = await api.createAPIKey({
        name: name.trim(),
        organization_id: organizationId,
        description: description.trim() || undefined,
        scopes: defaultScopes ?? ['modules:read', 'providers:read'],
        expires_at: expiryIsoFromPreset(expiry),
      })
      setToken(resp.key)
      announce(t('quickApiKey.createdAnnounce'))
    } catch (err) {
      setError(getErrorMessage(err, t('quickApiKey.createFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!token) return
    const snippet = buildSnippet(hostname, token)
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      announce(t('quickApiKey.copiedAnnounce'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('quickApiKey.copyFailed'))
    }
  }

  const handleRequestClose = () => {
    // If a token was generated and the user has NOT copied it, warn first.
    if (token && !copied && !confirmClose) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleRequestClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('quickApiKey.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!token ? (
            <>
              <TextField
                label={t('quickApiKey.labelName')}
                required
                autoFocus
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                slotProps={{
                  htmlInput: { 'aria-label': t('quickApiKey.ariaName') },
                }}
              />
              <TextField
                label={t('quickApiKey.labelDescription')}
                fullWidth
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
              <FormControl fullWidth>
                <InputLabel id="quick-apikey-expiry-label">{t('quickApiKey.expiresIn')}</InputLabel>
                <Select
                  labelId="quick-apikey-expiry-label"
                  label={t('quickApiKey.expiresIn')}
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ExpiryPreset)}
                  disabled={submitting}
                  inputProps={{ 'data-testid': 'quick-apikey-expiry' }}
                >
                  <MenuItem value="7">{t('quickApiKey.expiry7')}</MenuItem>
                  <MenuItem value="30">{t('quickApiKey.expiry30')}</MenuItem>
                  <MenuItem value="90">{t('quickApiKey.expiry90')}</MenuItem>
                  <MenuItem value="never">{t('quickApiKey.expiryNever')}</MenuItem>
                </Select>
              </FormControl>
              {!organizationId && <Alert severity="warning">{t('quickApiKey.orgRequired')}</Alert>}
            </>
          ) : (
            <>
              <Alert severity="warning">{t('quickApiKey.tokenWarning')}</Alert>
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 1,
                  backgroundColor: (t) => (t.palette.mode === 'dark' ? 'grey.900' : 'grey.100'),
                }}
                data-testid="quick-apikey-snippet"
              >
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    pr: 6,
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    overflowX: 'auto',
                  }}
                >
                  {buildSnippet(hostname, token)}
                </Box>
                <Tooltip
                  title={copied ? t('quickApiKey.copied') : t('quickApiKey.copySnippet')}
                  placement="top"
                >
                  <IconButton
                    aria-label={t('quickApiKey.copyAria')}
                    size="small"
                    onClick={handleCopy}
                    sx={{ position: 'absolute', top: 4, right: 4 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          )}

          {confirmClose && (
            <Alert severity="warning" data-testid="quick-apikey-confirm-close">
              {t('quickApiKey.confirmCloseText')}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setConfirmClose(false)}>
                  {t('quickApiKey.keepOpen')}
                </Button>
                <Button size="small" color="warning" onClick={onClose}>
                  {t('quickApiKey.closeWithoutCopying')}
                </Button>
              </Stack>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!token ? (
          <>
            <Button onClick={handleRequestClose} disabled={submitting}>
              {t('quickApiKey.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !organizationId || !name.trim()}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              {t('quickApiKey.create')}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleRequestClose}>
            {t('quickApiKey.done')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default QuickApiKeyDialog
