import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import MarkdownRenderer from './MarkdownRenderer';
import api from '../services/api';

interface ProviderDocContentProps {
  namespace: string;
  type: string;
  version: string;
  category: string;
  slug: string;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  return content.slice(end + 4).trimStart();
}

const ProviderDocContent: React.FC<ProviderDocContentProps> = ({
  namespace,
  type,
  version,
  category,
  slug,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    api
      .getProviderDocContent(namespace, type, version, category, slug)
      .then((data) => {
        if (!cancelled) {
          setContent(stripFrontmatter(data.content));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load documentation.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [namespace, type, version, category, slug]);

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ pt: 2, pb: 4, pl: 2, pr: 5 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : (
        <Box sx={{ p: 2 }}>
          <MarkdownRenderer>{content ?? ''}</MarkdownRenderer>
        </Box>
      )}
    </Box>
  );
};

export default ProviderDocContent;
