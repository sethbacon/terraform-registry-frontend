import React from 'react';
import { Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  children: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ children }) => (
  <Box
    sx={(theme) => ({
      '& h1': { fontSize: '2rem', fontWeight: 600, mt: 2, mb: 1 },
      '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 2, mb: 1 },
      '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
      '& p': { mb: 2 },
      '& code': {
        backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
        color: theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
        padding: '2px 6px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '0.875rem',
      },
      '& pre': {
        backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
        color: theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
        padding: 2,
        borderRadius: 1,
        overflow: 'auto',
      },
      '& pre code': {
        backgroundColor: 'transparent',
        padding: 0,
      },
      '& ul, & ol': { pl: 3, mb: 2 },
      '& li': { mb: 1 },
      '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
      '& th, & td': {
        border: theme.palette.mode === 'dark' ? '1px solid #444' : '1px solid #ddd',
        padding: '8px 12px',
        textAlign: 'left',
      },
      '& th': {
        backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
        fontWeight: 600,
      },
    })}
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {children}
    </ReactMarkdown>
  </Box>
);

export default MarkdownRenderer;
