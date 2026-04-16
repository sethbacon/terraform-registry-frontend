import React, { useCallback, useRef, useState } from 'react';
import { Box, Button, Stack, Typography, Alert } from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

export const HARD_MAX_BYTES = 100 * 1024 * 1024; // 100MB (backend limit)
export const SOFT_WARN_BYTES = 50 * 1024 * 1024; // 50MB

export interface FileDropZoneProps {
  /** Currently selected file (controlled). */
  file: File | null;
  /** Called when a valid file is selected. Invalid files invoke onError instead. */
  onFileSelected: (file: File) => void;
  /** Allowed extensions, leading dot required (e.g. ['.tar.gz', '.tgz']). */
  acceptedExtensions: string[];
  /** Optional callback fired on clear. */
  onClear?: () => void;
  /** Disables interaction (e.g., during upload). */
  disabled?: boolean;
  /** Visual label on idle state. Defaults to 'Drop file here or click to browse'. */
  idlePrompt?: string;
  /** Test id for the outer drop zone element. */
  'data-testid'?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesExtension(name: string, allowed: string[]): boolean {
  const lower = name.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext.toLowerCase()));
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  file,
  onFileSelected,
  onClear,
  acceptedExtensions,
  disabled,
  idlePrompt,
  'data-testid': testId = 'file-drop-zone',
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (candidate: File) => {
      setError(null);
      setWarning(null);
      if (!matchesExtension(candidate.name, acceptedExtensions)) {
        setError(
          `Invalid file type. Expected ${acceptedExtensions.join(' or ')}.`,
        );
        return;
      }
      if (candidate.size > HARD_MAX_BYTES) {
        setError(
          `File is too large (${formatBytes(candidate.size)}). Maximum allowed size is ${formatBytes(HARD_MAX_BYTES)}.`,
        );
        return;
      }
      if (candidate.size > SOFT_WARN_BYTES) {
        setWarning(
          `Large file (${formatBytes(candidate.size)}). Uploads may take a while.`,
        );
      }
      onFileSelected(candidate);
    },
    [acceptedExtensions, onFileSelected],
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSelect(dropped);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndSelect(picked);
    // Allow re-selecting the same file later
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleReplace = () => {
    setError(null);
    setWarning(null);
    onClear?.();
    if (!disabled) inputRef.current?.click();
  };

  const prompt = idlePrompt ?? `Drop ${acceptedExtensions.join(' / ')} file here or click to browse`;

  return (
    <Stack spacing={1}>
      <Box
        data-testid={testId}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label={file ? `Selected file ${file.name}. Activate to replace.` : prompt}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={file ? undefined : handleClick}
        onKeyDown={file ? undefined : handleKeyDown}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : error ? 'error.main' : 'divider',
          borderRadius: 1,
          p: 4,
          textAlign: 'center',
          cursor: file || disabled ? 'default' : 'pointer',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'border-color 120ms ease, background-color 120ms ease',
          outline: 'none',
          '&:focus-visible': {
            borderColor: 'primary.main',
            boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}33`,
          },
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedExtensions.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
          data-testid={`${testId}-input`}
        />
        {file ? (
          <Stack spacing={1} alignItems="center">
            <InsertDriveFileIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="body1" fontWeight={500}>
              {file.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatBytes(file.size)}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleReplace}
              disabled={disabled}
              data-testid={`${testId}-replace`}
            >
              Replace file
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1} alignItems="center">
            <CloudUpload color="action" sx={{ fontSize: 40 }} />
            <Typography variant="body1">{prompt}</Typography>
            <Typography variant="body2" color="text.secondary">
              Maximum {formatBytes(HARD_MAX_BYTES)}
            </Typography>
          </Stack>
        )}
      </Box>
      {error && (
        <Alert severity="error" data-testid={`${testId}-error`}>
          {error}
        </Alert>
      )}
      {warning && !error && (
        <Alert severity="warning" data-testid={`${testId}-warning`}>
          {warning}
        </Alert>
      )}
    </Stack>
  );
};

export default FileDropZone;
