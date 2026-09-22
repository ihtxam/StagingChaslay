// @ts-nocheck
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditor } from '@craftjs/core';
import { isEffectivelyEmptyEditorState } from '@/lib/chaslay-pagebuilder/editor-state';

/** Warn when leaving the editor with an empty canvas that previously had content. */
export function useEmptyCanvasNavGuard(initialState?: string | null) {
  const hadContentRef = useRef(false);
  const { query } = useEditor();

  useEffect(() => {
    if (initialState && !isEffectivelyEmptyEditorState(initialState)) {
      hadContentRef.current = true;
    }
  }, [initialState]);

  const canvasIsEmpty = useCallback(() => {
    try {
      return isEffectivelyEmptyEditorState(query.serialize());
    } catch {
      return false;
    }
  }, [query]);

  const shouldWarnOnLeave = useCallback(() => {
    return hadContentRef.current && canvasIsEmpty();
  }, [canvasIsEmpty]);

  const confirmLeaveIfEmpty = useCallback(() => {
    if (!shouldWarnOnLeave()) return true;
    return window.confirm(
      'Your homepage canvas is empty but previously had content. Leave without restoring or saving?'
    );
  }, [shouldWarnOnLeave]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnOnLeave()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [shouldWarnOnLeave]);

  return { confirmLeaveIfEmpty, shouldWarnOnLeave };
}
