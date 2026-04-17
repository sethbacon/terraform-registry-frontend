import React from 'react';
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
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { useAnnouncer } from '../contexts/AnnouncerContext';

type ExpiryPreset = '7' | '30' | '90' | 'never';

interface QuickApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Organization the key will belong to. If null/empty, creation is blocked
   * and the user is told they need to be a member of an organization.
   */
  organizationId: string | null;
  /**
   * Registry hostname used to build the Terraform credentials snippet.
   */
  hostname: string;
  /**
   * Scopes requested on the new key. Defaults to read-only when omitted.
   */
  defaultScopes?: string[];
}

function buildSnippet(host: string, token: string): string {
  return `credentials "${host}" {\n  token = "${token}"\n}`;
}

function expiryIsoFromPreset(preset: ExpiryPreset): string | undefined {
  if (preset === 'never') return undefined;
  const days = Number(preset);
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

const QuickApiKeyDialog: React.FC<QuickApiKeyDialogProps> = ({
  open,
  onClose,
  organizationId,
  hostname,
  defaultScopes,
}) => {
  const { announce } = useAnnouncer();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [expiry, setExpiry] = React.useState<ExpiryPreset>('30');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);

  // Reset state when dialog opens.
  React.useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setExpiry('30');
      setSubmitting(false);
      setError(null);
      setToken(null);
      setCopied(false);
      setConfirmClose(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!organizationId) {
      setError('You must be a member of an organization to create an API key.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await api.createAPIKey({
        name: name.trim(),
        organization_id: organizationId,
        description: description.trim() || undefined,
        scopes: defaultScopes ?? ['modules:read', 'providers:read'],
        expires_at: expiryIsoFromPreset(expiry),
      });
      setToken(resp.key);
      announce('API key created. Credentials snippet is now visible.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create API key.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    const snippet = buildSnippet(hostname, token);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      announce('API key credentials copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy to clipboard. Select the text manually.');
    }
  };

  const handleRequestClose = () => {
    // If a token was generated and the user has NOT copied it, warn first.
    if (token && !copied && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleRequestClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create API key</DialogTitle>
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
                label="Name"
                required
                autoFocus
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputProps={{ 'aria-label': 'API key name' }}
                disabled={submitting}
              />
              <TextField
                label="Description (optional)"
                fullWidth
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
              <FormControl fullWidth>
                <InputLabel id="quick-apikey-expiry-label">Expires in</InputLabel>
                <Select
                  labelId="quick-apikey-expiry-label"
                  label="Expires in"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ExpiryPreset)}
                  disabled={submitting}
                  inputProps={{ 'data-testid': 'quick-apikey-expiry' }}
                >
                  <MenuItem value="7">7 days</MenuItem>
                  <MenuItem value="30">30 days</MenuItem>
                  <MenuItem value="90">90 days</MenuItem>
                  <MenuItem value="never">Never</MenuItem>
                </Select>
              </FormControl>
              {!organizationId && (
                <Alert severity="warning">
                  You must be a member of an organization to create an API key.
                </Alert>
              )}
            </>
          ) : (
            <>
              <Alert severity="warning">
                This is the only time this token will be displayed. Copy it and store it securely.
              </Alert>
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 1,
                  backgroundColor: (t) => t.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                }}
                data-testid="quick-apikey-snippet"
              >
                <Box
                  component="pre"
                  sx={{ m: 0, p: 2, pr: 6, fontSize: '0.85rem', lineHeight: 1.6, overflowX: 'auto' }}
                >
                  {buildSnippet(hostname, token)}
                </Box>
                <Tooltip title={copied ? 'Copied!' : 'Copy snippet'} placement="top">
                  <IconButton
                    aria-label="Copy credentials snippet"
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
              You haven't copied the token yet. Close anyway?
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setConfirmClose(false)}>
                  Keep open
                </Button>
                <Button size="small" color="warning" onClick={onClose}>
                  Close without copying
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
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !organizationId || !name.trim()}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              Create
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleRequestClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default QuickApiKeyDialog;
