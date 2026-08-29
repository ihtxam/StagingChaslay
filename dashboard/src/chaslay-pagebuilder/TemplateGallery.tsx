// @ts-nocheck
'use client';

import { useState, useCallback } from 'react';
import { Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/chaslay-pagebuilder/i18n-stub';

import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Card, CardContent } from '@/chaslay-pagebuilder/ui/card';
import { Badge } from '@/chaslay-pagebuilder/ui/badge';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { ScrollArea } from '@/chaslay-pagebuilder/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/chaslay-pagebuilder/ui/dialog';
import { templates, type TemplateDefinition } from '@/chaslay-pagebuilder/data/templates';
import { DEFAULT_EMPTY_CANVAS_STATE } from '@/chaslay-pagebuilder/constants';
import { translateMessage } from '@/lib/chaslay-pagebuilder/i18n-stub';

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, editorState?: string) => Promise<void>;
  isSaving: boolean;
}

export function TemplateGallery({ open, onOpenChange, onCreate, isSaving }: TemplateGalleryProps) {
  const t = useTranslations('homepageBuilder.templates');
  const [step, setStep] = useState<'gallery' | 'name'>('gallery');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [name, setName] = useState('');
  const [isFetchingTemplate, setIsFetchingTemplate] = useState(false);

  const resetState = useCallback(() => {
    setStep('gallery');
    setSelectedTemplate(null);
    setName('');
    setIsFetchingTemplate(false);
  }, []);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        resetState();
      }
      onOpenChange(value);
    },
    [onOpenChange, resetState]
  );

  const handleSelectTemplate = useCallback((template: TemplateDefinition | null) => {
    setSelectedTemplate(template);
    setStep('name');
  }, []);

  const handleBack = useCallback(() => {
    setStep('gallery');
    setName('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;

    // If the template uses editorStateUrl, fetch it on demand
    if (selectedTemplate?.editorStateUrl) {
      setIsFetchingTemplate(true);
      try {
        const res = await fetch(selectedTemplate.editorStateUrl);
        if (!res.ok) throw new Error('Failed to fetch template');
        const editorState = await res.text();
        const trimmed = editorState.trim();
        await onCreate(
          name.trim(),
          trimmed && trimmed !== '{}' ? editorState : DEFAULT_EMPTY_CANVAS_STATE
        );
      } catch (err) {
        console.error('Failed to load template:', err);
        await onCreate(name.trim(), DEFAULT_EMPTY_CANVAS_STATE);
      } finally {
        setIsFetchingTemplate(false);
      }
      return;
    }

    const editorState = selectedTemplate?.editorState?.trim()
      ? selectedTemplate.editorState
      : DEFAULT_EMPTY_CANVAS_STATE;
    await onCreate(name.trim(), editorState);
  }, [name, selectedTemplate, onCreate]);

  const isCreating = isSaving || isFetchingTemplate;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        {step === 'gallery' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('subtitle')}</DialogDescription>
            </DialogHeader>

            {/* Template grid */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {/* Start from Scratch card */}
                <Card
                  className="cursor-pointer border-2 border-dashed hover:border-primary transition-colors group"
                  onClick={() => handleSelectTemplate(null)}
                >
                  <CardContent className="p-0">
                    <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
                      <Plus className="h-10 w-10" />
                      <div className="text-center px-4">
                        <p className="font-medium text-sm">{t('startFromScratch')}</p>
                        <p className="text-xs mt-1">{t('startFromScratchDesc')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Template cards */}
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:ring-2 hover:ring-primary transition-all group overflow-hidden"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <CardContent className="p-0">
                      <div className="aspect-[4/3] relative bg-muted overflow-hidden">
                        <img
                          src={template.thumbnail}
                          alt={translateMessage(template.nameKey)}
                          className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <Badge className="absolute top-2 right-2 capitalize" variant="secondary">
                          {t(`categories.${template.category}`)}
                        </Badge>
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-sm">{translateMessage(template.nameKey)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {translateMessage(template.descriptionKey)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('enterName')}</DialogTitle>
              <DialogDescription>{t('enterNameDesc')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedTemplate && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="w-16 h-12 relative rounded overflow-hidden bg-background">
                    <img
                      src={selectedTemplate.thumbnail}
                      alt={translateMessage(selectedTemplate.nameKey)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {translateMessage(selectedTemplate.nameKey)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {translateMessage(selectedTemplate.descriptionKey)}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('homepageName')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && !isCreating && handleCreate()}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleBack} disabled={isCreating}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('backToTemplates')}
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('createAndEdit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
