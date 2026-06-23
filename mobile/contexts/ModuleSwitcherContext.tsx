import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ModuleSwitcherSheet from '@/components/ModuleSwitcherSheet';
import BackButtonContext from '@/contexts/BackButtonContext';

type ModuleSwitcherContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const ModuleSwitcherContext = createContext<ModuleSwitcherContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function ModuleSwitcherProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const backCtx = useContext(BackButtonContext);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleBack = () => {
      close();
      return true;
    };

    backCtx.registerHandler(handleBack);
    return () => backCtx.unregisterHandler(handleBack);
  }, [backCtx, close, isOpen]);

  const value = useMemo(
    () => ({ open, close, isOpen }),
    [close, isOpen, open],
  );

  return (
    <ModuleSwitcherContext.Provider value={value}>
      {children}
      <ModuleSwitcherSheet visible={isOpen} onClose={close} />
    </ModuleSwitcherContext.Provider>
  );
}

export function useModuleSwitcher() {
  return useContext(ModuleSwitcherContext);
}
