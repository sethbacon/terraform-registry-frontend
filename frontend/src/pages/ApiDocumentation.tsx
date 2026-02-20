import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';

declare global {
  interface Window {
    Redoc: any;
  }
}

const REDOC_SCRIPT = 'https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js';

// Module-level shared promise so the script is loaded exactly once — even
// when React StrictMode mounts the component twice in development.  The first
// mount appends the <script> tag and stores the pending promise here; the
// second mount reuses the same promise and waits for the same load event
// instead of resolving immediately on an in-flight (not yet executed) tag.
let _redocPromise: Promise<void> | null = null;

function ensureRedocLoaded(): Promise<void> {
  if (window.Redoc) return Promise.resolve();
  if (_redocPromise) return _redocPromise;
  _redocPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = REDOC_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      _redocPromise = null; // allow retry on failure
      reject(new Error(`Failed to load ReDoc from ${REDOC_SCRIPT}`));
    };
    document.head.appendChild(script);
  });
  return _redocPromise;
}

const FONT = '"Inter", "Roboto", "Helvetica", "Arial", sans-serif';
const MONO = '"Roboto Mono", "Courier New", monospace';

const DARK_THEME = {
  colors: {
    primary: { main: '#9c8df5' },
    text: { primary: '#ffffff', secondary: '#cccccc' },
    gray: { 50: '#1e1e1e', 100: '#2d2d2d' },
    border: { dark: '#555555', light: '#444444' },
    responses: {
      success:  { color: '#66bb6a', backgroundColor: 'rgba(102,187,106,0.1)', tabTextColor: '#66bb6a' },
      error:    { color: '#f44336', backgroundColor: 'rgba(244,67,54,0.1)',   tabTextColor: '#f44336' },
      redirect: { color: '#ffa726', backgroundColor: 'rgba(255,167,38,0.1)',  tabTextColor: '#ffa726' },
      info:     { color: '#29b6f6', backgroundColor: 'rgba(41,182,246,0.1)',  tabTextColor: '#29b6f6' },
    },
    http: {
      get:    '#61affe',
      post:   '#49cc90',
      put:    '#fca130',
      delete: '#f93e3e',
      patch:  '#50e3c2',
      head:   '#9012fe',
      options:'#0d5aa7',
    },
  },
  // schema controls schema field rendering — override defaults designed for light mode
  schema: {
    nestedBackground: '#1a1a1a',  // default is #fafafa (near-white) — must be dark
    linesColor: '#555555',
    typeNameColor: '#81b3d2',     // "string", "integer", etc.
    typeTitleColor: '#e0e0e0',    // property field names
    requireLabelColor: '#ff5252',
    arrow: { color: '#9c8df5', size: '1.1em' },
  },
  sidebar: {
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    activeTextColor: '#9c8df5',
    separatorLineColor: '#444444',
    arrow: { color: '#9c8df5' },
  },
  rightPanel: { backgroundColor: '#0a0a0a', textColor: '#ffffff' },
  codeBlock: { backgroundColor: '#0a0a0a' },
  typography: {
    fontFamily: FONT,
    fontSize: '14px',
    lineHeight: '1.6em',
    headings: { fontFamily: FONT },
    code: { color: '#e0e0e0', backgroundColor: '#0a0a0a', fontFamily: MONO },
    links: { color: '#9c8df5', visited: '#c5bbff', hover: '#ddd9ff' },
  },
};

const LIGHT_THEME = {
  colors: {
    primary: { main: '#5C4EE5' },
    text: { primary: '#1a1a1a', secondary: '#3d3d3d' },
    gray: { 50: '#f5f5f5', 100: '#ebebeb' },
    border: { dark: '#aaaaaa', light: '#d0d0d0' },
    responses: {
      success:  { color: '#2e7d32', backgroundColor: 'rgba(46,125,50,0.08)',   tabTextColor: '#2e7d32' },
      error:    { color: '#c62828', backgroundColor: 'rgba(198,40,40,0.08)',   tabTextColor: '#c62828' },
      redirect: { color: '#e65100', backgroundColor: 'rgba(230,81,0,0.08)',    tabTextColor: '#e65100' },
      info:     { color: '#01579b', backgroundColor: 'rgba(1,87,155,0.08)',    tabTextColor: '#01579b' },
    },
    http: {
      get:    '#1565c0',
      post:   '#2e7d32',
      put:    '#e65100',
      delete: '#c62828',
      patch:  '#00695c',
      head:   '#6a1b9a',
      options:'#37474f',
    },
  },
  schema: {
    nestedBackground: '#f5f5f5',
    linesColor: '#aaaaaa',
    typeNameColor: '#476582',
    typeTitleColor: '#1a1a1a',
    requireLabelColor: '#c62828',
    arrow: { color: '#5C4EE5', size: '1.1em' },
  },
  sidebar: {
    backgroundColor: '#f7f7f7',
    textColor: '#1a1a1a',
    activeTextColor: '#5C4EE5',
    separatorLineColor: '#cccccc',
    arrow: { color: '#5C4EE5' },
  },
  rightPanel: { backgroundColor: '#2d2550', textColor: '#ffffff' },
  codeBlock: { backgroundColor: '#1e1a40' },
  typography: {
    fontFamily: FONT,
    fontSize: '14px',
    lineHeight: '1.6em',
    headings: { fontFamily: FONT },
    code: { color: '#e0e0e0', backgroundColor: '#1e1a40', fontFamily: MONO },
    links: { color: '#5C4EE5', visited: '#3d2fd4', hover: '#7b6ef0' },
  },
};

// "AUTHORIZATIONS >" and "RESPONSE SCHEMA:" are ReDoc internal labels that
// don't respond to the theme object — their styled-components colors are
// hard-coded.  A narrow scoped override is the documented approach for these.
const DARK_LABEL_FIX = `
  #redoc-container button,
  #redoc-container [role="button"],
  #redoc-container label { color: #9e9e9e !important; }
`;

const ApiDocumentation: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        await ensureRedocLoaded();

        if (cancelled || !containerRef.current || !window.Redoc) return;

        // Clear previous render before re-initialising (e.g. after theme change)
        containerRef.current.innerHTML = '';

        window.Redoc.init(
          '/swagger.json',
          {
            scrollYOffset: 64,
            hideDownloadButton: false,
            expandResponses: '200,201',
            theme: isDark ? DARK_THEME : LIGHT_THEME,
          },
          containerRef.current,
          // Called by ReDoc when the spec has been fetched and the UI is painted.
          // Only then do we hide the spinner so users never see an empty frame.
          () => { if (!cancelled) setLoading(false); },
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load API documentation');
          setLoading(false);
        }
      }
    };

    init();

    return () => { cancelled = true; };
  }, [isDark]); // Re-render ReDoc when the user toggles light/dark mode

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        API Documentation
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Interactive API reference for the Terraform Registry
      </Typography>

      {/* Scoped override for the few ReDoc labels that ignore the theme object */}
      {isDark && <style>{DARK_LABEL_FIX}</style>}

      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}
      <Box ref={containerRef} id="redoc-container" sx={{ minHeight: '80vh' }} />
    </Box>
  );
};

export default ApiDocumentation;
