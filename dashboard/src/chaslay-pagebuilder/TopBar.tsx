// @ts-nocheck
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useEditor, Element } from '@craftjs/core';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Save, Undo2, Redo2, ArrowLeft, Eye, FileArchive } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useTranslations } from '@/lib/chaslay-pagebuilder/i18n-stub';
import JSZip from 'jszip';
import { CustomHTML } from './components/CustomHTML';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
const CSS_EXTENSIONS = ['.css'];
const JS_EXTENSIONS = ['.js'];

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

interface TopBarProps {
  onSave?: (state: string) => void | Promise<void>;
  onFullPreview?: () => void;
  homepageName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ onSave, onFullPreview, homepageName }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('homepageBuilder');

  const { actions, query, canUndo, canRedo } = useEditor((state, query) => ({
    canUndo: state.options.enabled && query.history.canUndo(),
    canRedo: state.options.enabled && query.history.canRedo(),
  }));

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const json = query.serialize();

      if (onSave) {
        await onSave(json);
      } else {
        // Save to localStorage as fallback
        localStorage.setItem('homepage-builder-state', json);
        toast.success('Homepage saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save homepage');
    } finally {
      setIsSaving(false);
    }
  }, [query, onSave]);

  const handleZipImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Find the HTML file (prefer index.html, otherwise first .html at root)
      let htmlFileName: string | null = null;
      let htmlContent: string | null = null;

      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        const lower = relativePath.toLowerCase();
        if (!lower.endsWith('.html')) return;
        // Only root-level files (no subdirectory separators in path)
        const isRoot = !relativePath.includes('/') || relativePath.split('/').length <= 2;
        if (isRoot) {
          if (lower === 'index.html' || lower.endsWith('/index.html')) {
            htmlFileName = relativePath;
          } else if (!htmlFileName) {
            htmlFileName = relativePath;
          }
        }
      });

      if (!htmlFileName) {
        toast.error('No HTML file found in the ZIP archive');
        return;
      }

      htmlContent = await zip.file(htmlFileName)!.async('string');

      // Collect asset files by type
      const imageFiles: { path: string; ext: string }[] = [];
      const cssFiles: { path: string; ext: string }[] = [];
      const jsFiles: { path: string; ext: string }[] = [];

      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        const ext = '.' + relativePath.split('.').pop()!.toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) imageFiles.push({ path: relativePath, ext });
        else if (CSS_EXTENSIONS.includes(ext)) cssFiles.push({ path: relativePath, ext });
        else if (JS_EXTENSIONS.includes(ext)) jsFiles.push({ path: relativePath, ext });
      });

      // Convert images to base64 data URIs and build path→dataURI map
      const pathDataMap: Record<string, string> = {};

      for (const img of imageFiles) {
        const base64 = await zip.file(img.path)!.async('base64');
        const mime = MIME_TYPES[img.ext] || 'application/octet-stream';
        const dataUri = `data:${mime};base64,${base64}`;
        pathDataMap[img.path] = dataUri;
        pathDataMap[img.path.split('/').pop()!] = dataUri;
      }

      let processedHtml = htmlContent;

      // Replace image src="..." and href="..." references with data URIs
      processedHtml = processedHtml.replace(
        /(src|href)=["']([^"']+)["']/g,
        (match, attr, originalPath) => {
          const fileName = originalPath.split('/').pop()!;
          const dataUri = pathDataMap[originalPath] || pathDataMap[fileName];
          if (dataUri) {
            return `${attr}="${dataUri}"`;
          }
          return match;
        }
      );

      // Build inlined CSS <style> tags
      let cssInline = '';
      if (cssFiles.length > 0) {
        for (const cssFile of cssFiles) {
          const cssContent = await zip.file(cssFile.path)!.async('string');
          // Rewrite url() references inside CSS to data URIs
          const rewrittenCss = cssContent.replace(
            /url\(["']?([^"')]+)["']?\)/g,
            (urlMatch, urlPath) => {
              const urlFileName = urlPath.split('/').pop()!;
              const dataUri = pathDataMap[urlPath] || pathDataMap[urlFileName];
              return dataUri ? `url("${dataUri}")` : urlMatch;
            }
          );
          cssInline += `<style>\n${rewrittenCss}\n</style>\n`;
        }
        // Remove all <link> stylesheet tags — CSS is now inlined
        processedHtml = processedHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*\/?>/gi, '');
        processedHtml = processedHtml.replace(/<link[^>]*href=["'][^"']*\.css["'][^>]*\/?>/gi, '');
      }

      // Build inlined JS <script> tags
      let jsInline = '';
      if (jsFiles.length > 0) {
        for (const jsFile of jsFiles) {
          const jsContent = await zip.file(jsFile.path)!.async('string');
          jsInline += `<script>\n${jsContent}\n</script>\n`;
        }
        // Remove all external <script src="..."> tags — JS is now inlined
        processedHtml = processedHtml.replace(/<script[^>]*src=["'][^"']*\.js["'][^>]*>\s*<\/script>/gi, '');
      }

      // Extract body content — strip <html>, <head>, <body> wrappers
      // Keep only what's inside <body>...</body>
      const bodyMatch = processedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        processedHtml = bodyMatch[1].trim();
      } else {
        // No <body> tag — strip <html>, <head>...</head>, <!DOCTYPE> if present
        processedHtml = processedHtml
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .trim();
      }

      // Prepend styles and append scripts to the body content
      processedHtml = cssInline + processedHtml + jsInline;

      // Add processed HTML as a CustomHTML node to the canvas
      const nodeTree = query.parseReactElement(
        <Element is={CustomHTML} htmlContent={processedHtml} canvas />
      ).toNodeTree();
      actions.addNodeTree(nodeTree, 'ROOT');

      toast.success('HTML imported successfully!');
    } catch (error) {
      console.error('Failed to import ZIP:', error);
      toast.error('Failed to import ZIP file. Please ensure it is a valid ZIP archive.');
    } finally {
      setIsImporting(false);
      // Reset input so the same file can be re-imported
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [actions, query]);

  return (
    <div className="h-14 border-b bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Link to="/merchant/chaslay-page-builder">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </Button>
        </Link>
        <div className="h-6 w-px bg-border" />
        <h1 className="text-lg font-semibold">{homepageName || 'Homepage Builder'}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 mr-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => actions.history.undo()}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => actions.history.redo()}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Import HTML */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".zip"
          hidden
          onChange={handleZipImport}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="gap-2"
        >
          <FileArchive className="w-4 h-4" />
          {isImporting ? 'Importing...' : 'Import HTML'}
        </Button>

        {/* Preview */}
        {onFullPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFullPreview}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {t('preview')}
          </Button>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
};
