import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Stack,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export type ConfirmDialogSeverity = 'info' | 'warning' | 'error';

export interface ConfirmDialogField {
  id: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  rows?: number;
  initialValue?: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when the confirm button is pressed. May return a Promise. */
  onConfirm?: () => void | Promise<void>;
  /** When `fields` is set, this is called with the collected values instead of onConfirm. */
  onSubmit?: (values: Record<string, string>) => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: ConfirmDialogSeverity;
  /** If set, require the user to type this exact string before confirm is enabled. */
  typeToConfirmText?: string;
  fields?: ConfirmDialogField[];
  /** External loading state (e.g., mutation in flight). */
  loading?: boolean;
  /** Optional test id for the dialog root. */
  'data-testid'?: string;
}

function SeverityIcon({ severity }: { severity: ConfirmDialogSeverity }) {
  const common = { fontSize: 'inherit' as const };
  if (severity === 'error')
    return <ErrorOutlineIcon color="error" {...common} data-testid="confirm-dialog-icon-error" />;
  if (severity === 'warning')
    return <WarningAmberIcon color="warning" {...common} data-testid="confirm-dialog-icon-warning" />;
  return <InfoOutlinedIcon color="info" {...common} data-testid="confirm-dialog-icon-info" />;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  onSubmit,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'info',
  typeToConfirmText,
  fields,
  loading: externalLoading,
  'data-testid': testId = 'confirm-dialog',
}) => {
  const [typed, setTyped] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = externalLoading || internalLoading;

  // Reset state each time the dialog opens
  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
      setFieldValues(
        (fields ?? []).reduce<Record<string, string>>((acc, f) => {
          acc[f.id] = f.initialValue ?? '';
          return acc;
        }, {}),
      );
    }
  }, [open, fields]);

  const typedMatches = useMemo(() => {
    if (!typeToConfirmText) return true;
    return typed === typeToConfirmText;
  }, [typed, typeToConfirmText]);

  const requiredFieldsFilled = useMemo(() => {
    if (!fields) return true;
    return fields.every((f) => !f.required || (fieldValues[f.id] ?? '').trim().length > 0);
  }, [fields, fieldValues]);

  const confirmDisabled = loading || !typedMatches || !requiredFieldsFilled;

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    try {
      setError(null);
      setInternalLoading(true);
      if (onSubmit) {
        await onSubmit(fieldValues);
      } else if (onConfirm) {
        await onConfirm();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setInternalLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const confirmColor = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'primary';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid={testId}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'inline-flex', fontSize: 24, lineHeight: 0 }}>
          <SeverityIcon severity={severity} />
        </Box>
        <span>{title}</span>
      </DialogTitle>
      <DialogContent>
        {description && (
          <Box sx={{ mb: 2 }}>
            {typeof description === 'string' ? (
              <DialogContentText component="div">{description}</DialogContentText>
            ) : (
              description
            )}
          </Box>
        )}

        {fields && fields.length > 0 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {fields.map((f) => (
              <TextField
                key={f.id}
                label={f.label}
                value={fieldValues[f.id] ?? ''}
                onChange={(e) =>
                  setFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                }
                placeholder={f.placeholder}
                helperText={f.helperText}
                required={f.required}
                multiline={f.multiline}
                rows={f.rows ?? (f.multiline ? 3 : undefined)}
                disabled={loading}
                fullWidth
                inputProps={{ 'data-testid': `confirm-dialog-field-${f.id}` }}
              />
            ))}
          </Stack>
        )}

        {typeToConfirmText && (
          <Box sx={{ mt: fields && fields.length > 0 ? 2 : 0 }}>
            <Typography variant="body2" sx={{ mb: 1 }} color="text.secondary">
              Type <code>{typeToConfirmText}</code> to confirm.
            </Typography>
            <TextField
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirmText}
              fullWidth
              autoFocus
              disabled={loading}
              error={typed.length > 0 && !typedMatches}
              helperText={
                typed.length > 0 && !typedMatches
                  ? 'Input does not match. The comparison is case-sensitive.'
                  : undefined
              }
              inputProps={{
                'aria-label': 'Type-to-confirm input',
                'data-testid': 'confirm-dialog-type-input',
              }}
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} data-testid="confirm-dialog-error">
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          color={confirmColor}
          variant="contained"
          disabled={confirmDisabled}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          data-testid="confirm-dialog-confirm"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
