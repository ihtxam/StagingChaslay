// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { ProcessStepsProps, ProcessStep } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';

const defaultSteps: ProcessStep[] = [
  { title: 'Choose Your Dish', description: 'Browse our menu and pick your favorite dishes from our wide selection', icon: '🍽️', stepNumber: 1 },
  { title: 'Place Your Order', description: 'Order online or call us directly — it\'s quick and easy', icon: '📱', stepNumber: 2 },
  { title: 'Enjoy Your Meal', description: 'Sit back and enjoy freshly prepared food delivered to your table or door', icon: '😋', stepNumber: 3 },
];

const defaultProps: ProcessStepsProps = {
  title: 'How It Works',
  subtitle: 'Simple steps to your perfect meal',
  steps: defaultSteps,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
};

export const ProcessSteps: React.FC<ProcessStepsProps> & {
  craft: {
    props: ProcessStepsProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '64px 20px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        {mergedProps.title && (
          <h3 style={{ color: mergedProps.textColor, fontSize: '28px', fontWeight: 600, marginBottom: '12px' }}>
            {mergedProps.title}
          </h3>
        )}
        {mergedProps.subtitle && (
          <p style={{ color: mergedProps.textColor, opacity: 0.6, fontSize: '16px' }}>
            {mergedProps.subtitle}
          </p>
        )}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
        flexWrap: 'wrap',
      }}>
        {(mergedProps.steps || []).map((step, i) => (
          <React.Fragment key={i}>
            <div style={{ flex: '1 1 200px', maxWidth: '280px', textAlign: 'center' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: `${mergedProps.accentColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '28px',
                position: 'relative',
              }}>
                {step.icon || step.stepNumber}
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: mergedProps.accentColor,
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {step.stepNumber || i + 1}
                </div>
              </div>
              <h4 style={{ color: mergedProps.textColor, fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                {step.title}
              </h4>
              <p style={{ color: mergedProps.textColor, opacity: 0.6, fontSize: '14px', lineHeight: 1.6 }}>
                {step.description}
              </p>
            </div>
            {i < (mergedProps.steps || []).length - 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: '32px',
                color: mergedProps.accentColor,
                fontSize: '24px',
                opacity: 0.4,
              }}>
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const ProcessStepsSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    subtitle: node.data.props.subtitle ?? defaultProps.subtitle,
    steps: node.data.props.steps ?? defaultProps.steps,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  const addStep = () => setProp((props: ProcessStepsProps) => {
    const num = (props.steps || []).length + 1;
    props.steps = [...(props.steps || []), { title: 'New Step', description: 'Describe the step...', icon: '✨', stepNumber: num }];
  });
  const removeStep = (i: number) => setProp((props: ProcessStepsProps) => {
    props.steps = (props.steps || []).filter((_, idx) => idx !== i);
  });

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: ProcessStepsProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: ProcessStepsProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: ProcessStepsProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: ProcessStepsProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: ProcessStepsProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Steps</Label>
          <Button variant="outline" size="sm" onClick={addStep}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(p.steps || []).map((step: ProcessStep, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Step {step.stepNumber || i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeStep(i)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TranslatableArrayInput propKey="title" arrayPropKey="steps" index={i} nodeProps={p.nodeProps} setProp={setProp} value={step.title} onChange={(v) => setProp((props: ProcessStepsProps) => { if (props.steps) props.steps[i].title = v; })} placeholder="Title" className="h-8 text-xs" />
                <Input value={step.icon || ''} onChange={(e) => setProp((props: ProcessStepsProps) => { if (props.steps) props.steps[i].icon = e.target.value; })} placeholder="Icon/Emoji" className="h-8 text-xs" />
              </div>
              <TranslatableArrayInput propKey="description" arrayPropKey="steps" index={i} nodeProps={p.nodeProps} setProp={setProp} value={step.description} onChange={(v) => setProp((props: ProcessStepsProps) => { if (props.steps) props.steps[i].description = v; })} placeholder="Description" className="text-xs" multiline rows={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

ProcessSteps.craft = {
  props: defaultProps,
  related: { settings: ProcessStepsSettings },
  displayName: 'Process Steps',
};
