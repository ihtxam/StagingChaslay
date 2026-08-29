// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { cn } from '@/lib/chaslay-pagebuilder/utils';
import { useBuilderLanguage } from '../BuilderLanguageContext';

interface TranslatableInputProps {
  label: string;
  propKey: string;
  value: string;
  onChange: (value: string) => void;
  nodeProps: Record<string, any>;
  setProp: (cb: (props: any) => void) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export const TranslatableInput: React.FC<TranslatableInputProps> = ({
  label,
  propKey,
  value,
  onChange,
  nodeProps,
  setProp,
  multiline = false,
  rows = 2,
  placeholder,
  className,
}) => {
  const { languages, defaultLanguage, isLoaded } = useBuilderLanguage();
  const [activeLang, setActiveLang] = useState(defaultLanguage);

  // If only one language or not loaded, render a simple input
  if (!isLoaded || languages.length <= 1) {
    return (
      <div className={cn('space-y-2', className)}>
        <Label>{label}</Label>
        {multiline ? (
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
        ) : (
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        )}
      </div>
    );
  }

  const isDefault = activeLang === defaultLanguage;
  const suffixedKey = `${propKey}_${activeLang}`;
  const currentValue = isDefault ? value : (nodeProps[suffixedKey] || '');
  const basePlaceholder = value || placeholder || '';

  const handleChange = (newValue: string) => {
    if (isDefault) {
      onChange(newValue);
    } else {
      setProp((props: any) => {
        props[suffixedKey] = newValue;
      });
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <div className="flex gap-1 mb-1">
        {languages.map((lang) => {
          const isActive = activeLang === lang.code;
          const langSuffix = `${propKey}_${lang.code}`;
          const hasContent = lang.code === defaultLanguage
            ? !!value
            : !!nodeProps[langSuffix];

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setActiveLang(lang.code)}
              className={cn(
                'relative px-2 py-1 text-xs font-medium rounded-md border transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
              )}
            >
              {lang.code.toUpperCase()}
              {hasContent && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
      {multiline ? (
        <Textarea
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          rows={rows}
          placeholder={isDefault ? placeholder : basePlaceholder}
        />
      ) : (
        <Input
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isDefault ? placeholder : basePlaceholder}
        />
      )}
    </div>
  );
};

// For array items — a simpler version that takes value/onChange directly per language
interface TranslatableArrayInputProps {
  propKey: string;
  arrayPropKey: string;
  index: number;
  nodeProps: Record<string, any>;
  setProp: (cb: (props: any) => void) => void;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export const TranslatableArrayInput: React.FC<TranslatableArrayInputProps> = ({
  propKey,
  arrayPropKey,
  index,
  nodeProps,
  setProp,
  value,
  onChange,
  multiline = false,
  rows = 2,
  placeholder,
  className,
}) => {
  const { languages, defaultLanguage, isLoaded } = useBuilderLanguage();
  const [activeLang, setActiveLang] = useState(defaultLanguage);

  // Suffixed key: e.g. "cards_0_title_de"
  const getSuffixedKey = (lang: string) => `${arrayPropKey}_${index}_${propKey}_${lang}`;

  if (!isLoaded || languages.length <= 1) {
    return multiline ? (
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={className} />
    ) : (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} />
    );
  }

  const isDefault = activeLang === defaultLanguage;
  const suffixedKey = getSuffixedKey(activeLang);
  const currentValue = isDefault ? value : (nodeProps[suffixedKey] || '');
  const basePlaceholder = value || placeholder || '';

  const handleChange = (newValue: string) => {
    if (isDefault) {
      onChange(newValue);
    } else {
      setProp((props: any) => {
        props[suffixedKey] = newValue;
      });
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-1">
        {languages.map((lang) => {
          const isActive = activeLang === lang.code;
          const langKey = getSuffixedKey(lang.code);
          const hasContent = lang.code === defaultLanguage ? !!value : !!nodeProps[langKey];

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setActiveLang(lang.code)}
              className={cn(
                'relative px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
              )}
            >
              {lang.code.toUpperCase()}
              {hasContent && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
      {multiline ? (
        <Textarea
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          rows={rows}
          placeholder={isDefault ? placeholder : basePlaceholder}
        />
      ) : (
        <Input
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isDefault ? placeholder : basePlaceholder}
        />
      )}
    </div>
  );
};
