import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export interface ConsentPreferences {
  /** Essential cookies — always true, cannot be disabled */
  essential: true;
  /** Error reporting (e.g. Sentry) */
  errorReporting: boolean;
  /** Performance / Web Vitals reporting */
  performanceReporting: boolean;
  /** Analytics / usage tracking */
  analytics: boolean;
}

interface ConsentContextType {
  preferences: ConsentPreferences;
  hasConsented: boolean;
  updatePreferences: (prefs: Partial<Omit<ConsentPreferences, 'essential'>>) => void;
  acceptAll: () => void;
  rejectAll: () => void;
}

const CONSENT_KEY = 'terraform-registry-consent';

const defaultPreferences: ConsentPreferences = {
  essential: true,
  errorReporting: false,
  performanceReporting: false,
  analytics: false,
};

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

function loadPreferences(): { prefs: ConsentPreferences; consented: boolean } {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ConsentPreferences;
      return { prefs: { ...defaultPreferences, ...parsed, essential: true }, consented: true };
    }
  } catch {
    // Corrupted storage — treat as no consent
  }
  return { prefs: defaultPreferences, consented: false };
}

function savePreferences(prefs: ConsentPreferences): void {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
}

export const ConsentProvider = ({ children }: { children: ReactNode }) => {
  const [{ prefs, consented }, setState] = useState(loadPreferences);

  // Sync changes to localStorage
  useEffect(() => {
    if (consented) {
      savePreferences(prefs);
    }
  }, [prefs, consented]);

  const updatePreferences = useCallback(
    (partial: Partial<Omit<ConsentPreferences, 'essential'>>) => {
      setState((prev) => ({
        prefs: { ...prev.prefs, ...partial, essential: true },
        consented: true,
      }));
    },
    [],
  );

  const acceptAll = useCallback(() => {
    setState({
      prefs: { essential: true, errorReporting: true, performanceReporting: true, analytics: true },
      consented: true,
    });
  }, []);

  const rejectAll = useCallback(() => {
    setState({
      prefs: defaultPreferences,
      consented: true,
    });
  }, []);

  return (
    <ConsentContext.Provider
      value={{ preferences: prefs, hasConsented: consented, updatePreferences, acceptAll, rejectAll }}
    >
      {children}
    </ConsentContext.Provider>
  );
};

export const useConsent = (): ConsentContextType => {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return ctx;
};
