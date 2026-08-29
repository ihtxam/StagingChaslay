// @ts-nocheck
'use client';

import React, { useState, useCallback } from 'react';
import { useEditor } from '@craftjs/core';
import { ScrollArea } from '@/chaslay-pagebuilder/ui/scroll-area';
import { Settings, Layers, Trash2, Save } from 'lucide-react';
import { useTranslations } from '@/lib/chaslay-pagebuilder/i18n-stub';
import { toast } from 'react-hot-toast';

interface SettingsPanelProps {
  onSave?: (state: string) => void | Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSave }) => {
  const t = useTranslations('homepageBuilder');
  const [isSaving, setIsSaving] = useState(false);

  const { selected, actions, query } = useEditor((state, query) => {
    const currentNodeId = query.getEvent('selected').first();
    let selected;

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId]?.data?.displayName || state.nodes[currentNodeId]?.data?.name,
        settings: state.nodes[currentNodeId]?.related?.settings,
        isDeletable: query.node(currentNodeId).isDeletable(),
      };
    }

    return { selected };
  });

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const json = query.serialize();
      if (onSave) {
        await onSave(json);
      } else {
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

  return (
    <div className="w-72 border-l bg-background flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Settings className="w-4 h-4" />
        <h2 className="font-semibold text-sm flex-1">
          {selected ? selected.name : t('settings')}
        </h2>
        {selected && selected.isDeletable && (
          <button
            onClick={() => {
              if (selected.id) {
                actions.delete(selected.id);
              }
            }}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title={t('deleteComponent')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {selected ? (
          <div className="p-4">
            {selected.settings && React.createElement(selected.settings)}
          </div>
        ) : (
          <div className="p-4 text-center">
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Layers className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">{t('selectComponent')}</p>
            </div>
          </div>
        )}
      </ScrollArea>

      {selected && (
        <div className="p-4 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
      )}
    </div>
  );
};
