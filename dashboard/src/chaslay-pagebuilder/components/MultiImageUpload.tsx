// @ts-nocheck
'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Upload, X, Link as LinkIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/chaslay-pagebuilder/utils';

interface MultiImageUploadProps {
  label?: string;
  images: string[];
  onChange: (next: string[]) => void;
  maxPerUpload?: number;
  maxSizeKB?: number;
  className?: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  label = 'Images',
  images,
  onChange,
  maxPerUpload = 3,
  maxSizeKB = 500,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setError(null);

    let files = Array.from(fileList);
    let truncated = false;
    if (files.length > maxPerUpload) {
      files = files.slice(0, maxPerUpload);
      truncated = true;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not an image`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size / 1024 > maxSizeKB) {
        setError(`"${file.name}" is larger than ${maxSizeKB}KB`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    try {
      const base64s = await Promise.all(files.map(fileToBase64));
      onChange([...images, ...base64s]);
      if (truncated) {
        setError(`Only the first ${maxPerUpload} images were added (limit per upload).`);
      }
    } catch {
      setError('Failed to process one or more images');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    onChange([...images, url]);
    setUrlInput('');
  };

  const removeAt = (i: number) => {
    onChange(images.filter((_, idx) => idx !== i));
  };

  const replaceAt = (i: number, value: string) => {
    const next = [...images];
    next[i] = value;
    onChange(next);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Label>{label} <span className="text-xs text-muted-foreground font-normal">({images.length})</span></Label>
      </div>

      {/* Thumbnails grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Empty</div>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit existing URLs (in case user wants to swap) */}
      {images.length > 0 && images.some(src => src && !src.startsWith('data:')) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Edit URLs</summary>
          <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
            {images.map((src, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground w-6 text-center pt-1">{i + 1}</span>
                <Input
                  value={src.startsWith('data:') ? '(uploaded file)' : src}
                  onChange={(e) => replaceAt(i, e.target.value)}
                  className="h-7 text-xs"
                  placeholder="https://…"
                  disabled={src.startsWith('data:')}
                />
                <Button variant="ghost" size="sm" onClick={() => removeAt(i)} className="h-7 w-7 p-0 text-destructive shrink-0">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add new images */}
      {isUrlMode ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            />
            <Button onClick={handleAddUrl} size="sm" disabled={!urlInput.trim()}>Add</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsUrlMode(false)} className="text-xs">
            Back to upload
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors',
              isUploading && 'pointer-events-none opacity-50'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Uploading…
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload images</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Up to {maxPerUpload} per upload · Max {maxSizeKB}KB each · JPG/PNG/GIF/WebP
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Button variant="ghost" size="sm" onClick={() => setIsUrlMode(true)} className="text-xs w-full">
            <LinkIcon className="h-3 w-3 mr-1" /> Use URL instead
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
