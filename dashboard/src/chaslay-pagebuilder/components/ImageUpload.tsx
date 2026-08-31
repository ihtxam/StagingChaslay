// @ts-nocheck
'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Upload, X, Link } from 'lucide-react';
import { cn } from '@/lib/chaslay-pagebuilder/utils';
import { uploadPageBuilderImage } from '@/lib/chaslay-pagebuilder/upload-image';

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'wide' | 'auto';
  maxSizeKB?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  label = 'Image',
  className,
  aspectRatio = 'video',
  maxSizeKB = 500,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[21/9]',
    auto: '',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      setIsLoading(false);
      return;
    }

    // Hard cap — phone photos are often 5–15 MB and freeze the editor if embedded as base64.
    const hardMaxBytes = Math.max(maxSizeKB, 800) * 1024;
    if (file.size > hardMaxBytes) {
      setError(`Image too large. Please use a file under ${Math.round(hardMaxBytes / 1024)}KB or paste a URL.`);
      setIsLoading(false);
      return;
    }

    try {
      const url = await uploadPageBuilderImage(file, {
        maxBytes: maxSizeKB * 1024,
        targetBytes: Math.min(maxSizeKB * 1024, 320 * 1024),
        maxWidth: aspectRatio === 'auto' ? 1200 : 1800,
      });
      onChange(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image';
      setError(message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setIsUrlMode(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError(null);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}

      {value ? (
        <div className="relative group">
          <div className={cn('relative overflow-hidden rounded-lg border bg-muted', aspectRatioClass[aspectRatio])}>
            <img
              src={value}
              alt="Uploaded"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setError('Failed to load image')}
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {isUrlMode ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1"
                />
                <Button onClick={handleUrlSubmit} size="sm">
                  Add
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsUrlMode(false)}
                className="text-xs"
              >
                Back to upload
              </Button>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'relative border-2 border-dashed rounded-lg transition-colors cursor-pointer hover:border-primary hover:bg-muted/50',
                  aspectRatioClass[aspectRatio] || 'min-h-[120px]',
                  isLoading && 'pointer-events-none opacity-50'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  ) : (
                    <>
                      <div className="rounded-full bg-muted p-3">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">Click to upload</p>
                        <p className="text-xs text-muted-foreground">
                          Compressed &amp; stored on server · Max {maxSizeKB}KB
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsUrlMode(true)}
                className="text-xs w-full"
              >
                <Link className="h-3 w-3 mr-1" />
                Use URL instead
              </Button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
};
