import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Box } from '@mui/material';

export type AnnouncerPriority = 'polite' | 'assertive';

interface AnnouncerContextType {
  announce: (message: string, priority?: AnnouncerPriority) => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | undefined>(undefined);

// How long an announcement stays in the live region before being cleared.
// Clearing allows identical consecutive messages to re-trigger a screen-reader readout.
const CLEAR_AFTER_MS = 3000;

const srOnlySx = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: 0,
};

export const AnnouncerProvider = ({ children }: { children: ReactNode }) => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const politeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string, priority: AnnouncerPriority = 'polite') => {
    if (!message) return;
    if (priority === 'assertive') {
      if (assertiveTimerRef.current) clearTimeout(assertiveTimerRef.current);
      // Toggle through empty string first so identical consecutive messages re-announce.
      setAssertiveMessage('');
      setTimeout(() => setAssertiveMessage(message), 0);
      assertiveTimerRef.current = setTimeout(() => setAssertiveMessage(''), CLEAR_AFTER_MS);
    } else {
      if (politeTimerRef.current) clearTimeout(politeTimerRef.current);
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 0);
      politeTimerRef.current = setTimeout(() => setPoliteMessage(''), CLEAR_AFTER_MS);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (politeTimerRef.current) clearTimeout(politeTimerRef.current);
      if (assertiveTimerRef.current) clearTimeout(assertiveTimerRef.current);
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <Box
        component="div"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="announcer-polite"
        sx={srOnlySx}
      >
        {politeMessage}
      </Box>
      <Box
        component="div"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="announcer-assertive"
        sx={srOnlySx}
      >
        {assertiveMessage}
      </Box>
    </AnnouncerContext.Provider>
  );
};

export const useAnnouncer = (): AnnouncerContextType => {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) {
    throw new Error('useAnnouncer must be used within an AnnouncerProvider');
  }
  return ctx;
};

// Exported for tests only.
export const __ANNOUNCER_CLEAR_MS = CLEAR_AFTER_MS;
