// @ts-nocheck
'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Upload, X, Image as ImageIcon, Link } from 'lucide-react';
import { cn } from '@/lib/chaslay-pagebuilder/utils';

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

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      setIsLoading(false);
      return;
    }

    // Check file size
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > maxSizeKB) {
      setError(`Image too large. Max size: ${maxSizeKB}KB`);
      setIsLoading(false);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      onChange(base64);
    } catch (err) {
      setError('Failed to process image');
    } finally {
      setIsLoading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
                          Max {maxSizeKB}KB, JPG/PNG/GIF
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
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
