'use client';

import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onSearchFocus?: () => void;
  onRefresh?: () => void;
  onTabChange?: (tabIndex: number) => void;
  onExport?: () => void;
  onHelp?: () => void;
}

export function useKeyboardShortcuts({
  onSearchFocus,
  onRefresh,
  onTabChange,
  onExport,
  onHelp,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        // Allow Escape to close modals even when typing
        if (event.key === 'Escape') {
          return;
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      switch (event.key.toLowerCase()) {
        case 'f':
          if (ctrlOrCmd) {
            event.preventDefault();
            onSearchFocus?.();
          }
          break;

        case 'r':
          if (ctrlOrCmd) {
            event.preventDefault();
            onRefresh?.();
          }
          break;

        case 'e':
          if (ctrlOrCmd) {
            event.preventDefault();
            onExport?.();
          }
          break;

        case '?':
          if (!event.shiftKey) {
            event.preventDefault();
            onHelp?.();
          }
          break;

        case '1':
        case '2':
        case '3':
          if (ctrlOrCmd) {
            event.preventDefault();
            const tabIndex = parseInt(event.key, 10) - 1;
            onTabChange?.(tabIndex);
          }
          break;
      }
    },
    [onSearchFocus, onRefresh, onTabChange, onExport, onHelp]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Helper to focus search input
export function focusSearchInput(inputRef: React.RefObject<HTMLInputElement | null>) {
  if (inputRef.current) {
    inputRef.current.focus();
    inputRef.current.select();
  }
}
