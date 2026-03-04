import { createContext, useContext, useState, ReactNode } from 'react';

interface HelpContextType {
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

const STORAGE_KEY = 'help-panel-open';

export const HelpProvider = ({ children }: { children: ReactNode }) => {
  const [helpOpen, setHelpOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const openHelp = () => {
    setHelpOpen(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const closeHelp = () => {
    setHelpOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'false');
    } catch {
      // ignore
    }
  };

  return (
    <HelpContext.Provider value={{ helpOpen, openHelp, closeHelp }}>
      {children}
    </HelpContext.Provider>
  );
};

export const useHelp = (): HelpContextType => {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp must be used within a HelpProvider');
  return ctx;
};
