/**
 * Global keyboard shortcuts for veteran workflows.
 * Skips when focus is in an editable field (except Ctrl+F which always focuses search).
 */
import { useEffect, type RefObject } from 'react';
import type { InputRef } from 'antd';
import { toggleControlDrawer } from '../utils/controlDrawer';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useAppKeyboardShortcuts(searchInputRef: RefObject<InputRef | null>): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const input = searchInputRef.current?.input;
        input?.focus();
        input?.select();
        return;
      }

      if (isEditableTarget(e.target)) return;

      if (e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        toggleControlDrawer();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchInputRef]);
}
