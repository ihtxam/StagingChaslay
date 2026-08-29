// @ts-nocheck
'use client';

import React from 'react';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Bold, Italic, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/chaslay-pagebuilder/utils';

interface TextFormatToolbarProps {
  label: string;
  fontSize: number;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  fontStyle: 'normal' | 'italic';
  onFontSizeChange: (size: number) => void;
  onFontWeightChange: (weight: 'normal' | 'medium' | 'semibold' | 'bold') => void;
  onFontStyleChange: (style: 'normal' | 'italic') => void;
  minSize?: number;
  maxSize?: number;
}

const fontSizePresets = [
  { label: 'S', value: 14 },
  { label: 'M', value: 18 },
  { label: 'L', value: 24 },
  { label: 'XL', value: 36 },
  { label: '2XL', value: 48 },
  { label: '3XL', value: 64 },
];

export const TextFormatToolbar: React.FC<TextFormatToolbarProps> = ({
  label,
  fontSize,
  fontWeight,
  fontStyle,
  onFontSizeChange,
  onFontWeightChange,
  onFontStyleChange,
  minSize = 12,
  maxSize = 96,
}) => {
  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(minSize, Math.min(maxSize, fontSize + delta));
    onFontSizeChange(newSize);
  };

  const toggleBold = () => {
    onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold');
  };

  const toggleItalic = () => {
    onFontStyleChange(fontStyle === 'italic' ? 'normal' : 'italic');
  };

  return (
    <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>

      {/* Bold & Italic toggles */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 w-8 p-0', fontWeight === 'bold' && 'bg-primary text-primary-foreground')}
          onClick={toggleBold}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 w-8 p-0', fontStyle === 'italic' && 'bg-primary text-primary-foreground')}
          onClick={toggleItalic}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Font size controls */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => adjustFontSize(-2)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value) || minSize)}
          className="h-8 w-14 text-center text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => adjustFontSize(2)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Font size presets */}
      <div className="flex flex-wrap gap-1">
        {fontSizePresets.map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            className={cn(
              'h-6 px-2 text-xs',
              fontSize === preset.value && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onFontSizeChange(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
