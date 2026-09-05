// @ts-nocheck
'use client';

import React from 'react';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { SECTION_ANCHORS, type SectionAnchorKey } from '../utils/section-id';

type Props = {
  value?: string;
  defaultKey: SectionAnchorKey;
  onChange: (value: string) => void;
};

export function SectionPageIdField({ value, defaultKey, onChange }: Props) {
  const fallback = SECTION_ANCHORS[defaultKey];
  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
      <Label className="text-sm">Page ID</Label>
      <p className="text-xs text-muted-foreground">
        Anchor for navigation links (e.g. #{fallback}). Used as the section container id on the live site.
      </p>
      <Input
        value={value ?? fallback}
        onChange={(e) => onChange(e.target.value.replace(/^#/, '').trim())}
        className="h-8 font-mono text-sm"
        placeholder={fallback}
      />
    </div>
  );
}
