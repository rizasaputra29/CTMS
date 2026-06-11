'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface PeriodSelectionContextType {
  isFinalized: boolean;
  setPeriodSelection: (isFinalized: boolean) => void;
}

const PeriodSelectionContext = createContext<PeriodSelectionContextType | undefined>(undefined);

export function PeriodSelectionProvider({ children }: { children: ReactNode }) {
  const [isFinalized, setIsFinalized] = useState(false);

  const setPeriodSelection = useCallback((finalized: boolean) => {
    setIsFinalized(finalized);
  }, []);

  return (
    <PeriodSelectionContext.Provider value={{ isFinalized, setPeriodSelection }}>
      {children}
    </PeriodSelectionContext.Provider>
  );
}

export function usePeriodSelection(): PeriodSelectionContextType {
  const ctx = useContext(PeriodSelectionContext);
  if (!ctx) {
    return {
      isFinalized: false,
      setPeriodSelection: () => {},
    };
  }
  return ctx;
}
