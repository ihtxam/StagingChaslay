// @ts-nocheck
'use client';

import React from 'react';
import { Label } from '@/chaslay-pagebuilder/ui/label';

/** Settings sidebar row — keeps toggle switches visible inside the narrow panel. */
export function SettingsToggleRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <Label className="min-w-0 flex-1 leading-snug">{label}</Label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
